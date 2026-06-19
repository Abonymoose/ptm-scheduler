from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from database import get_db
from auth import get_current_user
from datetime import datetime
import uuid

router = APIRouter(prefix="/slots", tags=["slots"])

class SlotCreate(BaseModel):
    start_time: datetime
    end_time: datetime
    capacity: int = 1

@router.post("/")
async def create_slot(
    body: SlotCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can create slots")

    slot_id = str(uuid.uuid4())
    await db.execute(
        text(
            "INSERT INTO slots (id, teacher_id, school_id, start_time, end_time, capacity)"
            " VALUES (:id, :tid, :sid, :start, :end, :cap)"
        ),
        {
            "id": slot_id,
            "tid": current_user["sub"],
            "sid": current_user["school_id"],
            "start": body.start_time,
            "end": body.end_time,
            "cap": body.capacity
        }
    )
    await db.commit()
    return {"slot_id": slot_id, "message": "Slot created"}

@router.get("/")
async def get_slots(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    result = await db.execute(
        text(
            "SELECT s.id, s.start_time, s.end_time, s.capacity,"
            " s.teacher_id, u.name as teacher_name,"
            " COUNT(b.id) FILTER (WHERE b.status = 'confirmed') as booked_count,"
            " COALESCE(BOOL_OR(b.status = 'blocked'), false) as is_blocked"
            " FROM slots s"
            " JOIN users u ON s.teacher_id = u.id"
            " LEFT JOIN bookings b ON s.id = b.slot_id AND b.status != 'cancelled'"
            " WHERE s.school_id = :sid"
            " GROUP BY s.id, s.teacher_id, u.name"
            " ORDER BY s.start_time"
        ),
        {"sid": current_user["school_id"]}
    )
    rows = result.fetchall()
    return [dict(r._mapping) for r in rows]

@router.get("/mine")
async def get_my_slots(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Teachers only")

    result = await db.execute(
        text(
            "SELECT s.id, s.start_time, s.end_time, s.capacity,"
            " COUNT(b.id) FILTER (WHERE b.status = 'confirmed') as booked_count,"
            " COALESCE(BOOL_OR(b.status = 'blocked'), false) as is_blocked,"
            " COALESCE(json_agg("
            "   json_build_object('booking_id', b.id, 'student_name', b.student_name, 'section', b.section, 'parent_name', u.parent_name, 'status', b.status, 'attendance', b.attendance)"
            "   ORDER BY b.created_at"
            " ) FILTER (WHERE b.status = 'confirmed'), '[]') as bookings"
            " FROM slots s"
            " LEFT JOIN bookings b ON s.id = b.slot_id AND b.status != 'cancelled'"
            " LEFT JOIN users u ON b.parent_id = u.id"
            " WHERE s.teacher_id = :tid"
            " GROUP BY s.id"
            " ORDER BY s.start_time"
        ),
        {"tid": current_user["sub"]}
    )
    rows = result.fetchall()
    return [dict(r._mapping) for r in rows]

@router.get("/all")
async def get_all_slots(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only")

    result = await db.execute(
        text(
            "SELECT s.id, s.start_time, s.end_time, s.capacity,"
            " s.teacher_id, u.name as teacher_name, u.email as teacher_email,"
            " u.subject as subject, u.venue as venue,"
            " COUNT(b.id) FILTER (WHERE b.status = 'confirmed') as booked_count,"
            " COALESCE(BOOL_OR(b.status = 'blocked'), false) as is_blocked"
            " FROM slots s"
            " JOIN users u ON s.teacher_id = u.id"
            " LEFT JOIN bookings b ON s.id = b.slot_id AND b.status != 'cancelled'"
            " WHERE s.school_id = :sid"
            " GROUP BY s.id, s.teacher_id, u.name, u.email, u.subject, u.venue"
            " ORDER BY s.start_time"
        ),
        {"sid": current_user["school_id"]}
    )
    rows = result.fetchall()
    return [dict(r._mapping) for r in rows]


async def _load_slot_for_block(db: AsyncSession, slot_id: str, current_user: dict):
    """Fetch a slot and authorise the caller (owning teacher or same-school admin)."""
    result = await db.execute(
        text("SELECT id, teacher_id, school_id FROM slots WHERE id = :sid FOR UPDATE"),
        {"sid": slot_id}
    )
    slot = result.fetchone()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    role = current_user["role"]
    if role == "teacher":
        if str(slot.teacher_id) != current_user["sub"]:
            raise HTTPException(status_code=403, detail="Not your slot")
    elif role == "admin":
        if str(slot.school_id) != current_user["school_id"]:
            raise HTTPException(status_code=403, detail="Not your school")
    else:
        raise HTTPException(status_code=403, detail="Only teachers or admins can block slots")
    return slot


@router.post("/{slot_id}/block")
async def block_slot(
    slot_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    await _load_slot_for_block(db, slot_id, current_user)

    # Only a fully-free slot can be blocked.
    result = await db.execute(
        text("SELECT status FROM bookings WHERE slot_id = :sid AND status != 'cancelled'"),
        {"sid": slot_id}
    )
    existing = result.fetchall()
    if any(r.status == "blocked" for r in existing):
        raise HTTPException(status_code=400, detail="Slot is already blocked")
    if existing:
        raise HTTPException(status_code=400, detail="Slot is already booked")

    # Marker booking: no parent, status 'blocked'. Excluded from all real-booking views.
    await db.execute(
        text("INSERT INTO bookings (id, slot_id, parent_id, status) VALUES (:id, :sid, NULL, 'blocked')"),
        {"id": str(uuid.uuid4()), "sid": slot_id}
    )
    await db.commit()
    return {"message": "Slot blocked"}


@router.post("/{slot_id}/unblock")
async def unblock_slot(
    slot_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    await _load_slot_for_block(db, slot_id, current_user)

    result = await db.execute(
        text("DELETE FROM bookings WHERE slot_id = :sid AND status = 'blocked' RETURNING id"),
        {"sid": slot_id}
    )
    removed = result.fetchall()
    await db.commit()
    if not removed:
        raise HTTPException(status_code=400, detail="Slot is not blocked")
    return {"message": "Slot unblocked"}