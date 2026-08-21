from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from database import get_db

router = APIRouter(prefix="/schools", tags=["schools"])


@router.get("/by-slug/{slug}")
async def get_school_by_slug(slug: str, db: AsyncSession = Depends(get_db)):
    """Public, unauthenticated. Powers branded login pages only — returns just the
    school's name and id, nothing sensitive. 404 on an unknown slug."""
    result = await db.execute(
        text("SELECT id, name FROM schools WHERE slug = :slug"),
        {"slug": slug},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="School not found")
    return {"id": str(row["id"]), "name": row["name"]}
