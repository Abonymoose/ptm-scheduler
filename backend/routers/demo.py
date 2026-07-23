from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from database import get_db
from auth import get_current_user, create_access_token
import logging
from datetime import datetime, timezone, timedelta
from collections import OrderedDict
import subprocess
import os
import uuid
import random

router = APIRouter(prefix="/demo", tags=["demo"])

# Hidden seed parent — every fake booking hangs off this account so demo data is
# separately wipeable (delete by parent_id). One per school.
SEED_PARENT_EMAIL = "seed@demo.local"

# Separate first/last pools → 30 x 24 = 720 base combinations, so a single seed
# run of a teacher's ~45 slots never has to repeat a name.
_FIRST_NAMES = [
    "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Reyansh", "Kabir", "Ishaan",
    "Dhruv", "Advait", "Rehan", "Aryan", "Kiaan", "Rudra", "Shaurya",
    "Ananya", "Diya", "Saanvi", "Aadhya", "Myra", "Aisha", "Prisha", "Navya",
    "Kiara", "Anika", "Ira", "Riya", "Sara", "Meera", "Tara",
]
_LAST_NAMES = [
    "Sharma", "Patel", "Reddy", "Iyer", "Nair", "Rao", "Gupta", "Menon",
    "Singh", "Joshi", "Khan", "Pillai", "Desai", "Bose", "Mehta", "Chettri",
    "Das", "Kapoor", "Naidu", "Verma", "Shetty", "Malhotra", "Bhat", "Sinha",
]
_INITIALS = "ABCDEFGHJKLMNPRSTVY"


def _unique_name_generator(used: set):
    """Return a callable that yields student names never seen in `used`. Falls back
    to inserting a distinguishing middle initial rather than duplicating."""
    def gen():
        for _ in range(60):
            n = f"{random.choice(_FIRST_NAMES)} {random.choice(_LAST_NAMES)}"
            if n not in used:
                used.add(n)
                return n
        for _ in range(300):
            n = f"{random.choice(_FIRST_NAMES)} {random.choice(_INITIALS)}. {random.choice(_LAST_NAMES)}"
            if n not in used:
                used.add(n)
                return n
        i = 0  # extremely defensive — cycle initials until unique
        while True:
            n = f"{random.choice(_FIRST_NAMES)} {random.choice(_LAST_NAMES)} {chr(65 + i % 26)}."
            if n not in used:
                used.add(n)
                return n
            i += 1
    return gen

# Weighted attendance picks: mostly one parent, sometimes both, occasionally other.
_ATTENDANCE_CHOICES = [["Mother"], ["Father"], ["Mother", "Father"], ["Other"]]
_ATTENDANCE_WEIGHTS = [35, 35, 20, 10]

_FAKE_NOTES = [
    "Discussed progress in algebra; needs more practice with word problems.",
    "Parent raised concerns about homework load.",
    "Great improvement this term — keep it up.",
    "Reading fluency is strong; working on comprehension depth.",
    "A little distracted in class lately — agreed to check in weekly.",
    "Excellent participation; encouraged to attempt the extension problems.",
    "Handwriting has improved; still rushing on longer questions.",
    "Confident with fractions now; moving on to decimals next.",
    "Needs to revise before assessments — shared a study plan with the parent.",
    "Very creative in projects; guiding on structuring written work.",
]


class AddTeacher(BaseModel):
    name: str
    email: str
    subject: str | None = None


class SeedData(BaseModel):
    teacher_id: str
    fill_percent: int = 50
    realistic: bool = False
    realistic_percent: int = 60
    grade_min: int = 4
    grade_max: int = 8
    sections: list[str] = ["A", "B", "C", "D"]


class Impersonate(BaseModel):
    user_id: str


_impersonation_log = logging.getLogger("ptm.impersonation")
IMPERSONATION_EXPIRE_MINUTES = 60


async def _get_or_create_seed_parent(db: AsyncSession, school_id: str) -> str:
    row = (await db.execute(
        text("SELECT id FROM users WHERE email = :e AND school_id = :sid"),
        {"e": SEED_PARENT_EMAIL, "sid": school_id}
    )).fetchone()
    if row:
        return str(row.id)
    uid = str(uuid.uuid4())
    await db.execute(
        text("INSERT INTO users (id, school_id, name, email, hashed_password, role, parent_name)"
             " VALUES (:id, :sid, 'Demo Seed', :e, 'x', 'parent', 'Demo Seed')"),
        {"id": uid, "sid": school_id, "e": SEED_PARENT_EMAIL}
    )
    return uid


async def _generate_grid(db: AsyncSession, teacher_id: str, school_id: str) -> int:
    for i in range(SLOTS_PER_TEACHER):
        start = PTM_START + i * SLOT_DURATION
        await db.execute(
            text("INSERT INTO slots (id, teacher_id, school_id, start_time, end_time, capacity)"
                 " VALUES (:id, :tid, :sid, :start, :end, 1)"),
            {"id": str(uuid.uuid4()), "tid": teacher_id, "sid": school_id, "start": start, "end": start + SLOT_DURATION}
        )
    return SLOTS_PER_TEACHER

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


CHANGELOG_MD = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "CHANGELOG_DEMO.md")


def _read_handwritten_notes():
    """Parse CHANGELOG_DEMO.md into [{heading, items:[...]}]. Missing file -> []."""
    try:
        with open(CHANGELOG_MD, "r", encoding="utf-8") as f:
            text_body = f.read()
    except OSError:
        return []
    sections = []
    current = None
    for line in text_body.splitlines():
        s = line.strip()
        if s.startswith("## "):
            current = {"heading": s[3:].strip(), "items": []}
            sections.append(current)
        elif (s.startswith("- ") or s.startswith("* ")) and current is not None:
            current["items"].append(s[2:].strip())
    # Drop any empty sections.
    return [sec for sec in sections if sec["items"]]


@router.get("/changelog")
async def changelog(current_user: dict = Depends(get_current_user)):
    """Hand-written release notes (primary) + raw git commits from the last 7 days."""
    _require_admin(current_user)
    notes = _read_handwritten_notes()

    # Git commits are secondary — if git is unavailable, still return the notes.
    days = []
    git_error = None
    try:
        out = subprocess.run(
            ["git", "-C", REPO_ROOT, "log", "--since=7 days ago",
             "--date=short", "--pretty=format:%h\x1f%ad\x1f%s"],
            capture_output=True, text=True, timeout=10,
        )
        if out.returncode != 0:
            git_error = (out.stderr or "git log failed").strip()
        else:
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
    except Exception as exc:
        git_error = str(exc)

    total = sum(len(d["commits"]) for d in days)
    return {"notes": notes, "days": days, "total": total, "git_error": git_error}


@router.post("/add-teacher")
async def add_teacher(
    body: AddTeacher,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a real teacher in the admin's school + generate their slot grid."""
    _require_admin(current_user)
    sid = current_user["school_id"]
    email = body.email.strip().lower()
    name = body.name.strip()
    if not name or not email:
        raise HTTPException(status_code=400, detail="Name and email are required")

    dup = (await db.execute(text("SELECT 1 FROM users WHERE email = :e"), {"e": email})).fetchone()
    if dup:
        raise HTTPException(status_code=400, detail=f"A user with email {email} already exists")

    tid = str(uuid.uuid4())
    await db.execute(
        text("INSERT INTO users (id, school_id, name, email, hashed_password, role, subject)"
             " VALUES (:id, :sid, :n, :e, 'x', 'teacher', :subj)"),
        {"id": tid, "sid": sid, "n": name, "e": email, "subj": body.subject}
    )
    slots = await _generate_grid(db, tid, sid)
    await db.commit()
    return {"id": tid, "name": name, "email": email, "subject": body.subject, "slots_created": slots}


@router.post("/seed-data")
async def seed_data(
    body: SeedData,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Fill a teacher's FREE slots with fake confirmed bookings (seed parent),
    randomly spread, up to fill_percent. Never touches real or blocked slots."""
    _require_admin(current_user)
    sid = current_user["school_id"]
    pct = max(0, min(100, body.fill_percent))

    teacher = (await db.execute(
        text("SELECT id FROM users WHERE id = :tid AND role = 'teacher' AND school_id = :sid"),
        {"tid": body.teacher_id, "sid": sid}
    )).fetchone()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found in your school")

    # FREE = no live booking of any kind (no confirmed, no blocked marker).
    free = (await db.execute(
        text("SELECT s.id FROM slots s"
             " WHERE s.teacher_id = :tid AND s.school_id = :sid"
             " AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.slot_id = s.id AND b.status != 'cancelled')"),
        {"tid": body.teacher_id, "sid": sid}
    )).fetchall()
    free_ids = [str(r.id) for r in free]

    n_to_fill = round(len(free_ids) * pct / 100)
    chosen = random.sample(free_ids, n_to_fill) if n_to_fill else []

    # Grade range + section letters (with sensible defaults, clamped/ordered).
    gmin, gmax = sorted((body.grade_min, body.grade_max))
    gmin = max(1, gmin)
    gmax = min(12, max(gmin, gmax))
    letters = [s.strip().upper() for s in body.sections if s and s.strip()] or ["A", "B", "C", "D"]

    def gen_section():
        return f"{random.randint(gmin, gmax)}{random.choice(letters)}"

    # Names must be unique within this run AND not collide with students already
    # booked on this teacher's other slots.
    existing = (await db.execute(
        text("SELECT DISTINCT b.student_name FROM bookings b JOIN slots s ON b.slot_id = s.id"
             " WHERE s.teacher_id = :tid AND b.status != 'cancelled' AND b.student_name IS NOT NULL"),
        {"tid": body.teacher_id}
    )).fetchall()
    used_names = {r.student_name for r in existing}
    gen_name = _unique_name_generator(used_names)

    seed_parent = await _get_or_create_seed_parent(db, sid)
    booking_ids = []
    for slot_id in chosen:
        bid = str(uuid.uuid4())
        await db.execute(
            text("INSERT INTO bookings (id, slot_id, parent_id, status, student_name, section)"
                 " VALUES (:id, :sid, :pid, 'confirmed', :sn, :sec)"),
            {"id": bid, "sid": slot_id, "pid": seed_parent, "sn": gen_name(), "sec": gen_section()}
        )
        booking_ids.append(bid)
    created = len(booking_ids)

    # "Realistic": for ~realistic_percent of the new bookings, mark attendance and
    # write a note authored by THIS teacher (so it shows up when you View-as them).
    attendance_marked = 0
    notes_created = 0
    if body.realistic and booking_ids:
        rp = max(0, min(100, body.realistic_percent))
        picked = random.sample(booking_ids, round(created * rp / 100))
        for bid in picked:
            att = random.choices(_ATTENDANCE_CHOICES, weights=_ATTENDANCE_WEIGHTS, k=1)[0]
            await db.execute(
                text("UPDATE bookings SET attendance = CAST(:att AS text[]) WHERE id = :bid"),
                {"att": att, "bid": bid}
            )
            attendance_marked += 1
            await db.execute(
                text("INSERT INTO meeting_notes (id, booking_id, author_id, author_role, note_text, updated_at)"
                     " VALUES (:id, :bid, :aid, 'teacher', :txt, NOW())"),
                {"id": str(uuid.uuid4()), "bid": bid, "aid": body.teacher_id, "txt": random.choice(_FAKE_NOTES)}
            )
            notes_created += 1

    await db.commit()
    return {
        "created": created, "free_before": len(free_ids), "fill_percent": pct,
        "attendance_marked": attendance_marked, "notes_created": notes_created,
    }


@router.get("/users")
async def demo_users(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Teachers + parents in the admin's school, for the 'View as' picker.
    (Admins are excluded — they can't be impersonated. Seed parent hidden.)"""
    _require_admin(current_user)
    rows = (await db.execute(
        text("SELECT id, name, role, section, grade FROM users"
             " WHERE school_id = :sid AND role IN ('teacher','parent') AND email != :seed"
             " ORDER BY role, name"),
        {"sid": current_user["school_id"], "seed": SEED_PARENT_EMAIL}
    )).fetchall()
    return [{"id": str(r.id), "name": r.name, "role": r.role, "section": r.section, "grade": r.grade} for r in rows]


@router.post("/impersonate")
async def impersonate(
    body: Impersonate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Issue a short-lived token for a teacher/parent in the admin's own school.
    Every guard is server-enforced — the frontend is never trusted."""
    _require_admin(current_user)

    target = (await db.execute(
        text("SELECT id, role, school_id, name, section, grade, family_id, parent_name"
             " FROM users WHERE id = :uid"),
        {"uid": body.user_id}
    )).fetchone()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if str(target.school_id) != current_user["school_id"]:
        raise HTTPException(status_code=403, detail="That user is in a different school")
    if target.role not in ("teacher", "parent"):
        raise HTTPException(status_code=403, detail="Can only view as a teacher or parent")

    token = create_access_token(
        {
            "sub": str(target.id), "role": target.role, "school_id": str(target.school_id),
            "name": target.name, "section": target.section, "grade": target.grade,
            "family_id": target.family_id, "parent_name": target.parent_name,
            "impersonated_by": current_user["sub"],
        },
        expires_minutes=IMPERSONATION_EXPIRE_MINUTES,
    )
    _impersonation_log.warning(
        "IMPERSONATION admin=%s target=%s role=%s at %s",
        current_user["sub"], target.id, target.role, datetime.now(timezone.utc).isoformat(),
    )
    return {"access_token": token, "target_name": target.name, "target_role": target.role}


@router.post("/wipe-seed-data")
async def wipe_seed_data(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete ONLY seeded bookings (parent_id = seed parent). Real bookings survive."""
    _require_admin(current_user)
    sid = current_user["school_id"]
    seed_row = (await db.execute(
        text("SELECT id FROM users WHERE email = :e AND school_id = :sid"),
        {"e": SEED_PARENT_EMAIL, "sid": sid}
    )).fetchone()
    if not seed_row:
        return {"deleted": 0}
    res = await db.execute(
        text("DELETE FROM bookings WHERE parent_id = :pid RETURNING id"),
        {"pid": str(seed_row.id)}
    )
    deleted = len(res.fetchall())
    await db.commit()
    return {"deleted": deleted}
