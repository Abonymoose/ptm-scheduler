from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from database import get_db
from auth import get_current_user
import uuid

router = APIRouter(prefix="/notes", tags=["notes"])


class NoteBody(BaseModel):
    note_text: str


async def _authorize_booking(db: AsyncSession, booking_id: str, current_user: dict):
    """Return the booking row if the caller may write a note on it.

    Only the teacher who owns the slot, or the parent who owns the booking, may
    write. Raises 404 if the booking doesn't exist, 403 if the caller isn't a
    party to this meeting.
    """
    role = current_user["role"]
    if role not in ("teacher", "parent"):
        raise HTTPException(status_code=403, detail="Only teachers or parents can write meeting notes")

    result = await db.execute(
        text(
            "SELECT b.id, b.parent_id, s.teacher_id"
            " FROM bookings b JOIN slots s ON b.slot_id = s.id"
            " WHERE b.id = :bid"
        ),
        {"bid": booking_id}
    )
    booking = result.fetchone()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if role == "teacher" and str(booking.teacher_id) == current_user["sub"]:
        return booking
    if role == "parent" and booking.parent_id is not None and str(booking.parent_id) == current_user["sub"]:
        return booking
    raise HTTPException(status_code=403, detail="Not your meeting")


@router.put("/{booking_id}")
async def upsert_note(
    booking_id: str,
    body: NoteBody,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    await _authorize_booking(db, booking_id, current_user)

    # Blanking the note (empty / whitespace-only) clears it.
    if body.note_text.strip() == "":
        await db.execute(
            text("DELETE FROM meeting_notes WHERE booking_id = :bid AND author_id = :uid"),
            {"bid": booking_id, "uid": current_user["sub"]}
        )
        await db.commit()
        return {"booking_id": booking_id, "note_text": "", "exists": False}

    await db.execute(
        text(
            "INSERT INTO meeting_notes (id, booking_id, author_id, author_role, note_text, updated_at)"
            " VALUES (:id, :bid, :uid, :role, :txt, NOW())"
            " ON CONFLICT (booking_id, author_id)"
            " DO UPDATE SET note_text = EXCLUDED.note_text,"
            "               author_role = EXCLUDED.author_role,"
            "               updated_at = NOW()"
        ),
        {
            "id": str(uuid.uuid4()),
            "bid": booking_id,
            "uid": current_user["sub"],
            "role": current_user["role"],
            "txt": body.note_text,
        }
    )
    await db.commit()
    return {"booking_id": booking_id, "note_text": body.note_text, "exists": True}


@router.get("/{booking_id}")
async def get_note(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    # Filtered by author_id, so this can only ever return the caller's own note.
    result = await db.execute(
        text("SELECT note_text FROM meeting_notes WHERE booking_id = :bid AND author_id = :uid"),
        {"bid": booking_id, "uid": current_user["sub"]}
    )
    row = result.fetchone()
    return {"booking_id": booking_id, "note_text": row.note_text if row else "", "exists": row is not None}


@router.get("")
async def list_my_notes(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    # Only the caller's own notes, joined with meeting context for display/search.
    result = await db.execute(
        text(
            "SELECT n.booking_id, n.note_text, n.updated_at,"
            " b.student_name, b.section,"
            " p.grade AS grade, p.parent_name AS parent_name,"
            " t.name AS teacher_name,"
            " s.start_time, s.end_time"
            " FROM meeting_notes n"
            " JOIN bookings b ON n.booking_id = b.id"
            " JOIN slots s ON b.slot_id = s.id"
            " JOIN users t ON s.teacher_id = t.id"
            " LEFT JOIN users p ON b.parent_id = p.id"
            " WHERE n.author_id = :uid"
            " ORDER BY s.start_time"
        ),
        {"uid": current_user["sub"]}
    )
    return [dict(r._mapping) for r in result.fetchall()]
