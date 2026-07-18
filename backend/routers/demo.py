from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from database import get_db
from auth import get_current_user
from datetime import datetime, timezone, timedelta
from collections import OrderedDict
import subprocess
import os
import uuid

router = APIRouter(prefix="/demo", tags=["demo"])

# Repo root = two levels up from this file (backend/routers/demo.py -> repo/).
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Fresh-grid shape — mirrors the existing seeded data (seed.py).
PTM_START = datetime(2026, 4, 9, 8, 10, tzinfo=timezone.utc)  # 08:10 on PTM day
SLOT_DURATION = timedelta(minutes=7)
SLOTS_PER_TEACHER = 45


def _require_admin(current_user: dict):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only")


@router.post("/wipe-bookings")
async def wipe_bookings(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete every booking (confirmed, cancelled, and blocked markers) for the
    admin's school. Returns how many rows were deleted."""
    _require_admin(current_user)
    result = await db.execute(
        text(
            "DELETE FROM bookings"
            " WHERE slot_id IN (SELECT id FROM slots WHERE school_id = :sid)"
            " RETURNING id"
        ),
        {"sid": current_user["school_id"]}
    )
    deleted = len(result.fetchall())
    await db.commit()
    return {"deleted": deleted}


@router.post("/reset-slots")
async def reset_slots(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete all slots for the school (cascading their bookings) and regenerate a
    clean grid: 45 x 7-min slots per teacher starting 08:10 on the PTM date."""
    _require_admin(current_user)
    sid = current_user["school_id"]

    del_res = await db.execute(
        text("DELETE FROM slots WHERE school_id = :sid RETURNING id"),
        {"sid": sid}
    )
    slots_deleted = len(del_res.fetchall())

    teachers = (await db.execute(
        text("SELECT id FROM users WHERE role = 'teacher' AND school_id = :sid"),
        {"sid": sid}
    )).fetchall()

    slots_created = 0
    for t in teachers:
        for i in range(SLOTS_PER_TEACHER):
            start = PTM_START + i * SLOT_DURATION
            end = start + SLOT_DURATION
            await db.execute(
                text("INSERT INTO slots (id, teacher_id, school_id, start_time, end_time, capacity)"
                     " VALUES (:id, :tid, :sid, :start, :end, 1)"),
                {"id": str(uuid.uuid4()), "tid": str(t.id), "sid": sid, "start": start, "end": end}
            )
            slots_created += 1
    await db.commit()
    return {"slots_deleted": slots_deleted, "teachers": len(teachers), "slots_created": slots_created}


@router.get("/changelog")
async def changelog(current_user: dict = Depends(get_current_user)):
    """Commits from the last 7 days, grouped by date (newest first)."""
    _require_admin(current_user)
    try:
        out = subprocess.run(
            ["git", "-C", REPO_ROOT, "log", "--since=7 days ago",
             "--date=short", "--pretty=format:%h\x1f%ad\x1f%s"],
            capture_output=True, text=True, timeout=10,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not read changelog: {exc}")
    if out.returncode != 0:
        raise HTTPException(status_code=500, detail=(out.stderr or "git log failed").strip())

    grouped: "OrderedDict[str, list]" = OrderedDict()
    for line in out.stdout.splitlines():
        if not line.strip():
            continue
        parts = line.split("\x1f")
        if len(parts) != 3:
            continue
        h, date, msg = parts
        grouped.setdefault(date, []).append({"hash": h, "message": msg})

    days = [{"date": d, "commits": c} for d, c in grouped.items()]
    total = sum(len(d["commits"]) for d in days)
    return {"days": days, "total": total}
