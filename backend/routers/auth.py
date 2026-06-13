from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel, EmailStr
from database import get_db
from auth import hash_password, verify_password, create_access_token, get_current_user
import uuid
import asyncio

router = APIRouter(prefix="/auth", tags=["auth"])

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str  # parent, teacher, admin
    invite_code: str

class LoginRequest(BaseModel):
    email: str
    password: str

class VenueRequest(BaseModel):
    venue: str

@router.post("/signup")
async def signup(body: SignupRequest, db: AsyncSession = Depends(get_db)):
    # Find school by invite code
    result = await db.execute(
        text("SELECT id FROM schools WHERE invite_code = :code"),
        {"code": body.invite_code}
    )
    school = result.fetchone()
    if not school:
        raise HTTPException(status_code=400, detail="Invalid invite code")

    # Check if user already exists in this school
    result = await db.execute(
        text("SELECT id FROM users WHERE email = :email AND school_id = :sid"),
        {"email": body.email, "sid": school.id}
    )
    if result.fetchone():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create user
    user_id = str(uuid.uuid4())
    await db.execute(
        text("""
            INSERT INTO users (id, school_id, name, email, hashed_password, role)
            VALUES (:id, :sid, :name, :email, :pwd, :role)
        """),
        {
            "id": user_id,
            "sid": school.id,
            "name": body.name,
            "email": body.email,
            "pwd": hash_password(body.password),
            "role": body.role
        }
    )
    await db.commit()

    token = create_access_token({"sub": user_id, "role": body.role, "school_id": str(school.id), "name": body.name})
    return {"access_token": token, "token_type": "bearer"}

@router.post("/login")
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = None
    for attempt in range(3):
        try:
            result = await db.execute(
                text("SELECT id, hashed_password, role, school_id, name, section, grade, family_id, parent_name FROM users WHERE email = :email"),
                {"email": body.email}
            )
            user = result.fetchone()
            break
        except Exception:
            if attempt < 2:
                await asyncio.sleep(1)
                continue
            raise
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({
        "sub": str(user.id), "role": user.role, "school_id": str(user.school_id),
        "name": user.name, "section": user.section, "grade": user.grade,
        "family_id": user.family_id, "parent_name": user.parent_name,
    })
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me")
async def get_me(db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    result = await db.execute(
        text("SELECT id, name, email, role, venue, section, grade, family_id, parent_name FROM users WHERE id = :uid"),
        {"uid": current_user["sub"]}
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(row._mapping)


@router.patch("/venue")
async def update_venue(body: VenueRequest, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can update venue")
    await db.execute(
        text("UPDATE users SET venue = :venue WHERE id = :uid"),
        {"venue": body.venue, "uid": current_user["sub"]}
    )
    await db.commit()
    return {"venue": body.venue}