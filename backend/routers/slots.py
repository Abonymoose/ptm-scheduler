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
            " u.name as teacher_name,"
            " COUNT(b.id) as booked_count"
            " FROM slots s"
            " JOIN users u ON s.teacher_id = u.id"
            " LEFT JOIN bookings b ON s.id = b.slot_id AND b.status != 'cancelled'"
            " WHERE s.school_id = :sid"
            " GROUP BY s.id, u.name"
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
            " COUNT(b.id) as booked_count,"
            " COALESCE(json_agg("
            "   json_build_object('booking_id', b.id, 'parent_name', u.name, 'status', b.status)"
            "   ORDER BY b.created_at"
            " ) FILTER (WHERE b.id IS NOT NULL), '[]') as bookings"
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
            " u.name as teacher_name,"
            " COUNT(b.id) as booked_count"
            " FROM slots s"
            " JOIN users u ON s.teacher_id = u.id"
            " LEFT JOIN bookings b ON s.id = b.slot_id AND b.status != 'cancelled'"
            " WHERE s.school_id = :sid"
            " GROUP BY s.id, u.name"
            " ORDER BY s.start_time"
        ),
        {"sid": current_user["school_id"]}
    )
    rows = result.fetchall()
    return [dict(r._mapping) for r in rows]