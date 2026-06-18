from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from database import get_db
from auth import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])


class TeacherUpdate(BaseModel):
    name: str
    email: str
    subject: str | None = None


def _require_admin(current_user: dict):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only")


@router.get("/teachers/{teacher_id}/slots")
async def get_teacher_slots(
    teacher_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    _require_admin(current_user)

    # Confirm the teacher belongs to this admin's school.
    result = await db.execute(
        text("SELECT id FROM users WHERE id = :tid AND role = 'teacher' AND school_id = :sid"),
        {"tid": teacher_id, "sid": current_user["school_id"]}
    )
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Teacher not found")

    result = await db.execute(
        text(
            "SELECT s.id, s.start_time, s.end_time, s.capacity,"
            " COUNT(b.id) FILTER (WHERE b.status = 'confirmed') as booked_count,"
            " COALESCE(BOOL_OR(b.status = 'blocked'), false) as is_blocked,"
            " COALESCE(json_agg("
            "   json_build_object('booking_id', b.id, 'student_name', b.student_name, 'section', b.section, 'parent_name', u.parent_name)"
            "   ORDER BY b.created_at"
            " ) FILTER (WHERE b.status = 'confirmed'), '[]') as bookings"
            " FROM slots s"
            " LEFT JOIN bookings b ON s.id = b.slot_id AND b.status != 'cancelled'"
            " LEFT JOIN users u ON b.parent_id = u.id"
            " WHERE s.teacher_id = :tid"
            " GROUP BY s.id"
            " ORDER BY s.start_time"
        ),
        {"tid": teacher_id}
    )
    out = []
    for r in result.fetchall():
        m = dict(r._mapping)
        is_booked = m["booked_count"] > 0 or m["is_blocked"]
        if m["is_blocked"]:
            state = "blocked"
        elif m["booked_count"] > 0:
            state = "booked"
        else:
            state = "free"
        bk = m["bookings"][0] if m["bookings"] else None
        out.append({
            "id": str(m["id"]),
            "start_time": m["start_time"],
            "end_time": m["end_time"],
            "is_booked": is_booked,
            "state": state,
            "booking_id": bk["booking_id"] if bk else None,
            "student_name": bk["student_name"] if bk else None,
            "section": bk["section"] if bk else None,
            "parent_name": bk["parent_name"] if bk else None,
        })
    return out


@router.patch("/teachers/{teacher_id}")
async def update_teacher(
    teacher_id: str,
    body: TeacherUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    _require_admin(current_user)

    result = await db.execute(
        text("SELECT id FROM users WHERE id = :tid AND role = 'teacher' AND school_id = :sid"),
        {"tid": teacher_id, "sid": current_user["school_id"]}
    )
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Teacher not found")

    # Email must not collide with another user.
    result = await db.execute(
        text("SELECT id FROM users WHERE email = :email AND id != :tid"),
        {"email": body.email, "tid": teacher_id}
    )
    if result.fetchone():
        raise HTTPException(status_code=400, detail="Email already in use by another user")

    await db.execute(
        text("UPDATE users SET name = :name, email = :email, subject = :subject WHERE id = :tid"),
        {"name": body.name, "email": body.email, "subject": body.subject, "tid": teacher_id}
    )
    await db.commit()

    result = await db.execute(
        text("SELECT id, name, email, subject, venue FROM users WHERE id = :tid"),
        {"tid": teacher_id}
    )
    row = result.fetchone()
    return dict(row._mapping)


@router.delete("/slots/{slot_id}")
async def delete_slot(
    slot_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    _require_admin(current_user)

    result = await db.execute(
        text("SELECT id, school_id FROM slots WHERE id = :sid FOR UPDATE"),
        {"sid": slot_id}
    )
    slot = result.fetchone()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    if str(slot.school_id) != current_user["school_id"]:
        raise HTTPException(status_code=403, detail="Not your school")

    # Was there a real meeting here? (for the response flag)
    result = await db.execute(
        text("SELECT COUNT(*) FROM bookings WHERE slot_id = :sid AND status = 'confirmed'"),
        {"sid": slot_id}
    )
    had_confirmed = result.scalar() > 0

    # Deleting the slot cascades to its bookings (confirmed/blocked markers alike),
    # so no orphan rows remain. Atomic single transaction.
    await db.execute(text("DELETE FROM slots WHERE id = :sid"), {"sid": slot_id})
    await db.commit()
    return {"cancelled_booking": had_confirmed}
