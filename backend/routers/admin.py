import uuid
import asyncio
import logging
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from database import get_db
from auth import get_current_user
from email_service import send_cancellation_email
from routers.demo import _generate_grid

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger("ptm.admin")


class TeacherUpdate(BaseModel):
    name: str
    email: str
    subject: str | None = None
    venue: str | None = None
    room: str | None = None
    room_location: str | None = None


class TeacherCreate(BaseModel):
    name: str
    email: str
    subject: str | None = None


class PtmDateUpdate(BaseModel):
    ptm_date: date


class CancelSlotOptions(BaseModel):
    # Both default True to match the confirm dialog's checkboxes, which are
    # checked by default. A client (or a plain DELETE with no body at all)
    # that sends neither still notifies both parties, same as today's
    # cancel-without-asking behaviour.
    notify_parent: bool = True
    notify_teacher: bool = True


def _require_admin(current_user: dict):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admins only")


@router.get("/ptm-date")
async def get_ptm_date(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """The admin's school's configured PTM date (YYYY-MM-DD)."""
    _require_admin(current_user)
    row = (await db.execute(
        text("SELECT ptm_date FROM schools WHERE id = :sid"),
        {"sid": current_user["school_id"]}
    )).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="School not found")
    return {"ptm_date": row.ptm_date.isoformat() if row.ptm_date else None}


@router.patch("/ptm-date")
async def update_ptm_date(
    body: PtmDateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Set the school's PTM date AND shift every existing slot to the new date,
    preserving each slot's time of day. Slots are UPDATED in place (never
    deleted+recreated), so bookings — which reference slot_id and carry no
    timestamps of their own — move with their slots automatically. All in one
    transaction."""
    _require_admin(current_user)
    sid = current_user["school_id"]

    row = (await db.execute(
        text("SELECT ptm_date FROM schools WHERE id = :sid"),
        {"sid": sid}
    )).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="School not found")
    old_date = row.ptm_date
    new_date = body.ptm_date
    delta_days = (new_date - old_date).days if old_date else 0

    await db.execute(
        text("UPDATE schools SET ptm_date = :d WHERE id = :sid"),
        {"d": new_date, "sid": sid}
    )

    # Whole-day shift preserves hours/minutes (and, since slots are stored in UTC,
    # the exact time of day). No-op when the date is unchanged.
    slots_shifted = 0
    if delta_days != 0:
        res = await db.execute(
            text("UPDATE slots"
                 " SET start_time = start_time + make_interval(days => :days),"
                 "     end_time   = end_time   + make_interval(days => :days)"
                 " WHERE school_id = :sid"
                 " RETURNING id"),
            {"days": delta_days, "sid": sid}
        )
        slots_shifted = len(res.fetchall())

    await db.commit()
    return {"ptm_date": new_date.isoformat(), "slots_shifted": slots_shifted}


@router.get("/unbooked-parents")
async def get_unbooked_parents(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Parents in this school with ZERO confirmed bookings — so the school can
    follow up. Cancelled/blocked bookings don't count as booked."""
    _require_admin(current_user)

    result = await db.execute(
        text(
            "SELECT u.id, u.name, u.email, u.parent_name, u.section, u.grade"
            " FROM users u"
            " WHERE u.role = 'parent' AND u.school_id = :sid"
            " AND NOT EXISTS ("
            "   SELECT 1 FROM bookings b"
            "   WHERE b.parent_id = u.id AND b.status = 'confirmed'"
            " )"
            " ORDER BY u.name"
        ),
        {"sid": current_user["school_id"]}
    )
    rows = result.fetchall()
    parents = [
        {
            "id": str(r.id),
            "parent_name": r.parent_name or r.name,
            "student_name": r.name,
            "email": r.email,
            "section": r.section,
            "grade": r.grade,
        }
        for r in rows
    ]
    return {"count": len(parents), "parents": parents}


async def _teacher_day_slots(db: AsyncSession, teacher_id: str) -> list[dict]:
    """A teacher's full slot grid with each booked slot's parent/student info.
    Shared by the manage-teacher panel and the export endpoint below."""
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

    return await _teacher_day_slots(db, teacher_id)


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
        text("UPDATE users SET name = :name, email = :email, subject = :subject, venue = :venue,"
             " room = :room, room_location = :room_location WHERE id = :tid"),
        {"name": body.name, "email": body.email, "subject": body.subject, "venue": body.venue,
         "room": body.room, "room_location": body.room_location, "tid": teacher_id}
    )
    await db.commit()

    result = await db.execute(
        text("SELECT id, name, email, subject, venue, room, room_location FROM users WHERE id = :tid"),
        {"tid": teacher_id}
    )
    row = result.fetchone()
    return dict(row._mapping)


@router.post("/teachers")
async def create_teacher(
    body: TeacherCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a real teacher in the admin's school + generate their 45-slot grid.
    Same logic as /demo/add-teacher, exposed on the normal admin route."""
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


@router.get("/teachers/{teacher_id}/impact")
async def get_teacher_impact(
    teacher_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Counts for the remove-teacher confirmation: total slots and confirmed
    bookings that would be destroyed. Target must be a teacher in the admin's school."""
    _require_admin(current_user)
    row = (await db.execute(
        text("SELECT name FROM users WHERE id = :tid AND role = 'teacher' AND school_id = :sid"),
        {"tid": teacher_id, "sid": current_user["school_id"]}
    )).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Teacher not found")
    slots = (await db.execute(
        text("SELECT COUNT(*) FROM slots WHERE teacher_id = :tid"),
        {"tid": teacher_id}
    )).scalar()
    booked = (await db.execute(
        text("SELECT COUNT(*) FROM bookings b JOIN slots s ON b.slot_id = s.id"
             " WHERE s.teacher_id = :tid AND b.status = 'confirmed'"),
        {"tid": teacher_id}
    )).scalar()
    return {"teacher_name": row.name, "slots": slots, "booked": booked}


@router.delete("/teachers/{teacher_id}")
async def delete_teacher(
    teacher_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Permanently remove a teacher and everything hanging off them. The user row
    delete cascades slots -> bookings -> meeting_notes; we delete the teacher's
    authored notes first because meeting_notes.author_id is ON DELETE NO ACTION.
    One transaction; rolls back on any failure. Teacher must be in the admin's school."""
    _require_admin(current_user)
    row = (await db.execute(
        text("SELECT id FROM users WHERE id = :tid AND role = 'teacher' AND school_id = :sid"),
        {"tid": teacher_id, "sid": current_user["school_id"]}
    )).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Teacher not found")

    try:
        # Counts (before deletion) for the response.
        slots_removed = (await db.execute(
            text("SELECT COUNT(*) FROM slots WHERE teacher_id = :tid"),
            {"tid": teacher_id}
        )).scalar()
        bookings_cancelled = (await db.execute(
            text("SELECT COUNT(*) FROM bookings b JOIN slots s ON b.slot_id = s.id"
                 " WHERE s.teacher_id = :tid AND b.status = 'confirmed'"),
            {"tid": teacher_id}
        )).scalar()

        # Notes authored by this teacher (author_id FK is NO ACTION, so clear first).
        await db.execute(text("DELETE FROM meeting_notes WHERE author_id = :tid"), {"tid": teacher_id})
        # Deleting the user cascades slots -> bookings -> (booking-linked) notes.
        await db.execute(text("DELETE FROM users WHERE id = :tid"), {"tid": teacher_id})
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to remove teacher. No changes were made.")

    return {"deleted": True, "slots_removed": slots_removed, "bookings_cancelled": bookings_cancelled}


@router.delete("/slots/{slot_id}")
async def delete_slot(
    slot_id: str,
    body: CancelSlotOptions | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    _require_admin(current_user)
    notify_parent = body.notify_parent if body else True
    notify_teacher = body.notify_teacher if body else True

    result = await db.execute(
        text("SELECT id, school_id FROM slots WHERE id = :sid FOR UPDATE"),
        {"sid": slot_id}
    )
    slot = result.fetchone()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    if str(slot.school_id) != current_user["school_id"]:
        raise HTTPException(status_code=403, detail="Not your school")

    # Full details of every confirmed booking on this slot, captured before
    # the DELETE cascades it all away -- there's no second chance to look
    # this up afterward. (Normally at most one; the query doesn't assume it.)
    result = await db.execute(
        text(
            "SELECT b.id, b.student_name, b.section,"
            " s.start_time,"
            " t.name AS teacher_name, t.subject AS teacher_subject, t.email AS teacher_email,"
            " p.name AS parent_login_name, p.parent_name, p.email AS parent_email"
            " FROM bookings b"
            " JOIN slots s ON b.slot_id = s.id"
            " JOIN users t ON s.teacher_id = t.id"
            " JOIN users p ON b.parent_id = p.id"
            " WHERE b.slot_id = :sid AND b.status = 'confirmed'"
        ),
        {"sid": slot_id}
    )
    confirmed_bookings = result.fetchall()
    had_confirmed = len(confirmed_bookings) > 0

    # Deleting the slot cascades to its bookings (confirmed/blocked markers alike),
    # so no orphan rows remain. Atomic single transaction.
    await db.execute(text("DELETE FROM slots WHERE id = :sid"), {"sid": slot_id})
    await db.commit()

    # Notifications after commit, per the requested checkboxes. Cancelled-by
    # is always "the school" here -- never the specific admin's name. A
    # failed send is logged, never raised: the deletion already committed
    # above and must not be undone by a mail failure.
    for bk in confirmed_bookings:
        try:
            if notify_parent:
                sent = await asyncio.to_thread(
                    send_cancellation_email,
                    bk.parent_email,
                    bk.parent_name or bk.parent_login_name,
                    "parent",
                    bk.teacher_name, bk.teacher_subject,
                    bk.student_name, bk.section,
                    bk.start_time,
                    "the school",
                )
                if not sent:
                    logger.error("Admin-cancel parent notification failed for booking %s", bk.id)
            if notify_teacher:
                sent = await asyncio.to_thread(
                    send_cancellation_email,
                    bk.teacher_email,
                    bk.teacher_name,
                    "teacher",
                    bk.teacher_name, bk.teacher_subject,
                    bk.student_name, bk.section,
                    bk.start_time,
                    "the school",
                )
                if not sent:
                    logger.error("Admin-cancel teacher notification failed for booking %s", bk.id)
        except Exception:
            logger.exception("Admin-cancel notification raised for booking %s", bk.id)

    return {"cancelled_booking": had_confirmed}


@router.get("/teachers/{teacher_id}/export")
async def export_teacher_day(
    teacher_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Teacher header info + full day, for the admin export picker (any
    teacher in the school, not just the caller). Cross-school access is a
    hard 403 here, unlike the 404-by-obscurity other admin teacher lookups
    use -- this endpoint's cross-school behaviour is explicitly tested."""
    _require_admin(current_user)
    row = (await db.execute(
        text("SELECT id, school_id, name, subject, room, room_location"
             " FROM users WHERE id = :tid AND role = 'teacher'"),
        {"tid": teacher_id}
    )).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Teacher not found")
    if str(row.school_id) != current_user["school_id"]:
        raise HTTPException(status_code=403, detail="Not your school")

    slots = await _teacher_day_slots(db, teacher_id)
    return {
        "id": str(row.id),
        "name": row.name,
        "subject": row.subject,
        "room": row.room,
        "room_location": row.room_location,
        "slots": slots,
    }


@router.get("/parents/{parent_id}/export")
async def export_parent_schedule(
    parent_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Parent header info + their confirmed bookings, for the admin export
    picker (any parent in the school). Cross-school access is a hard 403,
    same reasoning as the teacher export endpoint above."""
    _require_admin(current_user)
    row = (await db.execute(
        text("SELECT id, school_id, name, parent_name, grade, section"
             " FROM users WHERE id = :pid AND role = 'parent'"),
        {"pid": parent_id}
    )).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Parent not found")
    if str(row.school_id) != current_user["school_id"]:
        raise HTTPException(status_code=403, detail="Not your school")

    result = await db.execute(
        text(
            "SELECT b.id, b.student_name, b.section,"
            " s.start_time, s.end_time,"
            " t.name AS teacher_name, t.subject AS teacher_subject,"
            " t.room, t.room_location"
            " FROM bookings b"
            " JOIN slots s ON b.slot_id = s.id"
            " JOIN users t ON s.teacher_id = t.id"
            " WHERE b.parent_id = :pid AND b.status = 'confirmed'"
            " ORDER BY s.start_time"
        ),
        {"pid": parent_id}
    )
    bookings = [dict(r._mapping) for r in result.fetchall()]
    return {
        "id": str(row.id),
        "name": row.name,
        "parent_name": row.parent_name,
        "grade": row.grade,
        "section": row.section,
        "bookings": bookings,
    }
