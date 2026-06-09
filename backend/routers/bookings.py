from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel
from database import get_db
from auth import get_current_user
from collections import defaultdict
import uuid

router = APIRouter(prefix="/bookings", tags=["bookings"])

class BookingCreate(BaseModel):
    slot_id: str

class AutoScheduleRequest(BaseModel):
    teacher_ids: list[str]

@router.post("/auto-schedule")
async def auto_schedule(
    body: AutoScheduleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "parent":
        raise HTTPException(status_code=403, detail="Only parents can use auto-schedule")
    if not body.teacher_ids:
        return {"booked": [], "conflicts": []}

    parent_id = current_user["sub"]
    school_id = current_user["school_id"]
    placeholders = ", ".join(f":t{i}" for i in range(len(body.teacher_ids)))
    base_params = {f"t{i}": tid for i, tid in enumerate(body.teacher_ids)}

    name_result = await db.execute(
        text(f"SELECT id, name FROM users WHERE id IN ({placeholders}) AND school_id = :sid"),
        {**base_params, "sid": school_id}
    )
    teacher_names = {str(r.id): r.name for r in name_result.fetchall()}

    slot_result = await db.execute(
        text(
            f"SELECT s.id, s.start_time, s.end_time, s.capacity, s.teacher_id"
            f" FROM slots s"
            f" LEFT JOIN bookings b ON s.id = b.slot_id AND b.status != 'cancelled'"
            f" WHERE s.teacher_id IN ({placeholders})"
            f"   AND s.school_id = :sid"
            f"   AND s.id NOT IN ("
            f"     SELECT slot_id FROM bookings"
            f"     WHERE parent_id = :pid AND status != 'cancelled'"
            f"   )"
            f" GROUP BY s.id"
            f" HAVING COUNT(b.id) < s.capacity"
            f" ORDER BY s.start_time"
        ),
        {**base_params, "sid": school_id, "pid": parent_id}
    )
    rows = slot_result.fetchall()

    # Pre-load existing bookings so we don't overlap with other child's meetings
    existing_result = await db.execute(
        text(
            "SELECT s.start_time, s.end_time FROM bookings b "
            "JOIN slots s ON b.slot_id = s.id "
            "WHERE b.parent_id = :pid AND b.status != 'cancelled'"
        ),
        {"pid": parent_id}
    )
    existing_bookings = existing_result.fetchall()

    teacher_slots: dict[str, list] = defaultdict(list)
    for row in rows:
        teacher_slots[str(row.teacher_id)].append(row)

    blocked_times: list[dict] = [{"start_time": eb.start_time, "end_time": eb.end_time} for eb in existing_bookings]
    assigned: list[dict] = []
    conflicts: list[str] = []

    for teacher_id in body.teacher_ids:
        teacher_name = teacher_names.get(teacher_id, teacher_id)
        available = teacher_slots.get(teacher_id, [])
        chosen = None
        for slot in available:
            if not any(
                slot.start_time < a["end_time"] and slot.end_time > a["start_time"]
                for a in assigned + blocked_times
            ):
                chosen = slot
                break
        if chosen:
            assigned.append({
                "teacher_id": teacher_id,
                "teacher_name": teacher_name,
                "slot_id": str(chosen.id),
                "start_time": chosen.start_time,
                "end_time": chosen.end_time,
            })
        else:
            conflicts.append(teacher_name)

    booked: list[dict] = []
    if assigned:
        for i, a in enumerate(assigned):
            res = await db.execute(
                text("SELECT id, capacity FROM slots WHERE id = :sid FOR UPDATE"),
                {"sid": a["slot_id"]}
            )
            slot = res.fetchone()
            if not slot:
                conflicts.append(a["teacher_name"])
                continue
            res = await db.execute(
                text("SELECT COUNT(*) FROM bookings WHERE slot_id = :sid AND status != 'cancelled'"),
                {"sid": a["slot_id"]}
            )
            if res.scalar() >= slot.capacity:
                conflicts.append(a["teacher_name"])
                continue
            res = await db.execute(
                text("SELECT id FROM bookings WHERE slot_id = :sid AND parent_id = :pid AND status != 'cancelled'"),
                {"sid": a["slot_id"], "pid": parent_id}
            )
            if res.fetchone():
                conflicts.append(a["teacher_name"])
                continue
            booking_id = str(uuid.uuid4())
            try:
                await db.execute(text(f"SAVEPOINT sp_{i}"))
                await db.execute(
                    text("INSERT INTO bookings (id, slot_id, parent_id, status) VALUES (:id, :sid, :pid, 'confirmed')"),
                    {"id": booking_id, "sid": a["slot_id"], "pid": parent_id}
                )
                await db.execute(text(f"RELEASE SAVEPOINT sp_{i}"))
                booked.append({
                    "teacher_name": a["teacher_name"],
                    "slot_id": a["slot_id"],
                    "start_time": a["start_time"].isoformat(),
                    "end_time": a["end_time"].isoformat(),
                })
            except IntegrityError:
                await db.execute(text(f"ROLLBACK TO SAVEPOINT sp_{i}"))
                conflicts.append(a["teacher_name"])
                continue
        await db.commit()

    return {"booked": booked, "conflicts": conflicts}


@router.post("/")
async def create_booking(
    body: BookingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "parent":
        raise HTTPException(status_code=403, detail="Only parents can book slots")

    result = await db.execute(
        text("SELECT id, capacity FROM slots WHERE id = :sid FOR UPDATE"),
        {"sid": body.slot_id}
    )
    slot = result.fetchone()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    result = await db.execute(
        text("SELECT COUNT(*) FROM bookings WHERE slot_id = :sid AND status != 'cancelled'"),
        {"sid": body.slot_id}
    )
    booked_count = result.scalar()

    if booked_count >= slot.capacity:
        raise HTTPException(status_code=400, detail="Slot is full")

    result = await db.execute(
        text("SELECT id FROM bookings WHERE slot_id = :sid AND parent_id = :pid AND status != 'cancelled'"),
        {"sid": body.slot_id, "pid": current_user["sub"]}
    )
    if result.fetchone():
        raise HTTPException(status_code=400, detail="Already booked this slot")

    booking_id = str(uuid.uuid4())
    await db.execute(
        text("INSERT INTO bookings (id, slot_id, parent_id, status) VALUES (:id, :sid, :pid, 'confirmed')"),
        {"id": booking_id, "sid": body.slot_id, "pid": current_user["sub"]}
    )
    await db.commit()

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
