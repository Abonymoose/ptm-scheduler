from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from database import get_db
from auth import get_current_user
import uuid

router = APIRouter(prefix="/bookings", tags=["bookings"])

class BookingCreate(BaseModel):
    slot_id: str

@router.post("/")
async def create_booking(
    body: BookingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "parent":
        raise HTTPException(status_code=403, detail="Only parents can book slots")

    async with db.begin():
        # Lock the slot row — no one else can book until this transaction finishes
        result = await db.execute(
            text("SELECT id, capacity FROM slots WHERE id = :sid FOR UPDATE"),
            {"sid": body.slot_id}
        )
        slot = result.fetchone()
        if not slot:
            raise HTTPException(status_code=404, detail="Slot not found")

        # Count existing confirmed bookings
        result = await db.execute(
            text(
                "SELECT COUNT(*) FROM bookings"
                " WHERE slot_id = :sid AND status != 'cancelled'"
            ),
            {"sid": body.slot_id}
        )
        booked_count = result.scalar()

        if booked_count >= slot.capacity:
            raise HTTPException(status_code=400, detail="Slot is full")

        # Check parent hasn't already booked this slot
        result = await db.execute(
            text(
                "SELECT id FROM bookings"
                " WHERE slot_id = :sid AND parent_id = :pid AND status != 'cancelled'"
            ),
            {"sid": body.slot_id, "pid": current_user["sub"]}
        )
        if result.fetchone():
            raise HTTPException(status_code=400, detail="Already booked this slot")

        booking_id = str(uuid.uuid4())
        await db.execute(
            text(
                "INSERT INTO bookings (id, slot_id, parent_id, status)"
                " VALUES (:id, :sid, :pid, 'confirmed')"
            ),
            {
                "id": booking_id,
                "sid": body.slot_id,
                "pid": current_user["sub"]
            }
        )

    return {"booking_id": booking_id, "message": "Booking confirmed"}

@router.delete("/{booking_id}")
async def cancel_booking(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "parent":
        raise HTTPException(status_code=403, detail="Only parents can cancel bookings")

    result = await db.execute(
        text("SELECT id, parent_id, status FROM bookings WHERE id = :bid"),
        {"bid": booking_id}
    )
    booking = result.fetchone()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if str(booking.parent_id) != current_user["sub"]:
        raise HTTPException(status_code=403, detail="Not your booking")
    if booking.status == "cancelled":
        raise HTTPException(status_code=400, detail="Already cancelled")

    await db.execute(
        text("UPDATE bookings SET status = 'cancelled' WHERE id = :bid"),
        {"bid": booking_id}
    )
    await db.commit()
    return {"message": "Booking cancelled"}

@router.get("/all")
async def get_all_bookings(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only")

    result = await db.execute(
        text(
            "SELECT b.id, b.status, b.created_at,"
            " p.name as parent_name,"
            " t.name as teacher_name,"
            " s.start_time, s.end_time"
            " FROM bookings b"
            " JOIN slots s ON b.slot_id = s.id"
            " JOIN users p ON b.parent_id = p.id"
            " JOIN users t ON s.teacher_id = t.id"
            " WHERE s.school_id = :sid"
            " ORDER BY s.start_time"
        ),
        {"sid": current_user["school_id"]}
    )
    rows = result.fetchall()
    return [dict(r._mapping) for r in rows]

@router.get("/")
async def get_my_bookings(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    result = await db.execute(
        text(
            "SELECT b.id, b.slot_id, b.status, b.created_at,"
            " s.start_time, s.end_time,"
            " u.name as teacher_name"
            " FROM bookings b"
            " JOIN slots s ON b.slot_id = s.id"
            " JOIN users u ON s.teacher_id = u.id"
            " WHERE b.parent_id = :pid"
            " ORDER BY s.start_time"
        ),
        {"pid": current_user["sub"]}
    )
    rows = result.fetchall()
    return [dict(r._mapping) for r in rows]
