from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from database import get_db
from auth import get_current_user

router = APIRouter(prefix="/parent", tags=["parent"])


@router.get("/children")
async def get_children(db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """The logged-in parent's students, each with the teachers of their section.

    The family comes from the parent's own users row, and every join is pinned
    to the JWT's school_id, so a family or teacher_sections row from another
    school can never leak in.
    """
    if current_user["role"] != "parent":
        raise HTTPException(status_code=403, detail="Only parents can view children")
    school_id = current_user["school_id"]

    result = await db.execute(
        text(
            "SELECT st.id, st.name, st.section, st.grade"
            " FROM users u"
            " JOIN students st ON st.family_id = u.family_id AND st.school_id = :sid"
            " WHERE u.id = :uid AND u.school_id = :sid"
            " ORDER BY st.grade DESC NULLS LAST, st.name"
        ),
        {"uid": current_user["sub"], "sid": school_id}
    )
    students = result.fetchall()
    if not students:
        return []

    sections = list({s.section for s in students})
    result = await db.execute(
        text(
            "SELECT ts.section, t.id, t.name, t.subject"
            " FROM teacher_sections ts"
            " JOIN users t ON t.id = ts.teacher_id AND t.school_id = :sid AND t.role = 'teacher'"
            " WHERE ts.school_id = :sid AND ts.section = ANY(:sections)"
            " ORDER BY t.name"
        ),
        {"sid": school_id, "sections": sections}
    )
    by_section: dict[str, list] = {}
    for r in result.fetchall():
        by_section.setdefault(r.section, []).append({"id": str(r.id), "name": r.name, "subject": r.subject})

    return [
        {
            "id": str(s.id),
            "name": s.name,
            "section": s.section,
            "grade": s.grade,
            "teachers": by_section.get(s.section, []),
        }
        for s in students
    ]
