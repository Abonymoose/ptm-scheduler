"""Teacher provisioning shared by POST /admin/teachers and /demo/add-teacher,
plus the slot-grid helpers /demo/reset-slots also uses."""
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# Fresh-grid shape — mirrors the existing seeded data (seed.py).
PTM_START = datetime(2026, 4, 9, 8, 10, tzinfo=timezone.utc)  # 08:10 on PTM day
SLOT_DURATION = timedelta(minutes=7)
SLOTS_PER_TEACHER = 45


async def ptm_start_for_school(db: AsyncSession, school_id: str) -> datetime:
    """08:10 (UTC) on the school's configured PTM date. Falls back to the module
    default if the column is somehow null."""
    row = (await db.execute(
        text("SELECT ptm_date FROM schools WHERE id = :sid"),
        {"sid": school_id}
    )).fetchone()
    d = row.ptm_date if row and row.ptm_date else PTM_START.date()
    return datetime(d.year, d.month, d.day, 8, 10, tzinfo=timezone.utc)


async def generate_grid(db: AsyncSession, teacher_id: str, school_id: str) -> int:
    ptm_start = await ptm_start_for_school(db, school_id)
    rows, params = [], {}
    for i in range(SLOTS_PER_TEACHER):
        start = ptm_start + i * SLOT_DURATION
        rows.append(f"(:id{i}, :tid{i}, :sid{i}, :start{i}, :end{i}, 1)")
        params[f"id{i}"] = str(uuid.uuid4())
        params[f"tid{i}"] = teacher_id
        params[f"sid{i}"] = school_id
        params[f"start{i}"] = start
        params[f"end{i}"] = start + SLOT_DURATION
    await db.execute(
        text("INSERT INTO slots (id, teacher_id, school_id, start_time, end_time, capacity)"
             " VALUES " + ", ".join(rows)),
        params,
    )
    return SLOTS_PER_TEACHER


async def create_teacher(db: AsyncSession, school_id: str, name: str, email: str, subject: str | None) -> dict:
    """Create a teacher in school_id and generate their slot grid; commits.

    school_id must come from the caller's JWT, never the request body.

    Email uniqueness is checked across ALL schools, not just this one: the DB
    index is only (email, school_id), but login looks users up by email alone,
    so the same address in two schools would sign in to whichever row Postgres
    returns first. The advisory lock makes the check-then-insert race-proof
    (see the OTP lock in routers/auth.py for why NOT EXISTS alone isn't)."""
    email = email.strip().lower()
    name = name.strip()
    if not name or not email:
        raise HTTPException(status_code=400, detail="Name and email are required")

    await db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:k)::bigint)"), {"k": f"user-email:{email}"})
    dup = (await db.execute(text("SELECT 1 FROM users WHERE lower(email) = :e"), {"e": email})).fetchone()
    if dup:
        await db.rollback()
        # Generic on purpose: don't tell one school's admin which addresses
        # are registered at another school.
        raise HTTPException(status_code=409, detail="That email is already in use")

    tid = str(uuid.uuid4())
    await db.execute(
        text("INSERT INTO users (id, school_id, name, email, hashed_password, role, subject)"
             " VALUES (:id, :sid, :n, :e, 'x', 'teacher', :subj)"),
        {"id": tid, "sid": school_id, "n": name, "e": email, "subj": subject}
    )
    slots = await generate_grid(db, tid, school_id)
    await db.commit()
    return {"id": tid, "name": name, "email": email, "subject": subject, "slots_created": slots}
