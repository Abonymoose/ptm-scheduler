from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel, EmailStr
from database import get_db
from auth import hash_password, verify_password, create_access_token, get_current_user
import uuid
import asyncio

router = APIRouter(prefix="/auth", tags=["auth"])

# OTP is hardcoded until SES is wired up. Replace with a random code + email send.
HARDCODED_OTP = "000000"

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str  # parent, teacher, admin
    invite_code: str

class LoginRequest(BaseModel):
    email: str
    password: str

class RequestOtpRequest(BaseModel):
    email: str

class VerifyOtpRequest(BaseModel):
    email: str
    code: str

class AdminLoginRequest(BaseModel):
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
    # Parents and teachers log in via OTP; only admins use password login here.
    if user and user.role in ("parent", "teacher"):
        raise HTTPException(status_code=400, detail="Please use OTP login")

    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({
        "sub": str(user.id), "role": user.role, "school_id": str(user.school_id),
        "name": user.name, "section": user.section, "grade": user.grade,
        "family_id": user.family_id, "parent_name": user.parent_name,
    })
    return {"access_token": token, "token_type": "bearer"}


@router.post("/request-otp")
async def request_otp(body: RequestOtpRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("SELECT id, role FROM users WHERE email = :email"),
        {"email": body.email}
    )
    user = result.fetchone()
    if not user:
        raise HTTPException(status_code=404, detail="No account found for this email")
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Admins use password login")

    code = HARDCODED_OTP
    await db.execute(
        text(
            "INSERT INTO otps (email, code, expires_at, used)"
            " VALUES (:email, :code, NOW() + INTERVAL '10 minutes', false)"
        ),
        {"email": body.email, "code": code}
    )
    await db.commit()
    print(f"OTP for {body.email}: {code}")  # TODO: send via SES instead of logging
    return {"message": "OTP sent"}


@router.post("/verify-otp")
async def verify_otp(body: VerifyOtpRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text(
            "SELECT id, code FROM otps"
            " WHERE email = :email AND used = false AND expires_at > NOW()"
            " ORDER BY created_at DESC LIMIT 1"
        ),
        {"email": body.email}
    )
    otp = result.fetchone()
    if not otp or otp.code != body.code:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    await db.execute(
        text("UPDATE otps SET used = true WHERE id = :id"),
        {"id": str(otp.id)}
    )

    result = await db.execute(
        text("SELECT id, role, school_id, name, section, grade, family_id, parent_name FROM users WHERE email = :email"),
        {"email": body.email}
    )
    user = result.fetchone()
    if not user:
        await db.rollback()
        raise HTTPException(status_code=404, detail="No account found for this email")
    await db.commit()

    token = create_access_token({
        "sub": str(user.id), "role": user.role, "school_id": str(user.school_id),
        "name": user.name, "section": user.section, "grade": user.grade,
        "family_id": user.family_id, "parent_name": user.parent_name,
    })
    return {"access_token": token, "token_type": "bearer", "role": user.role, "name": user.name}


@router.post("/admin-login")
async def admin_login(body: AdminLoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("SELECT id, hashed_password, role FROM users WHERE email = :email"),
        {"email": body.email}
    )
    user = result.fetchone()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.role != "admin":
        raise HTTPException(status_code=400, detail="Not an admin account")

    code = HARDCODED_OTP
    await db.execute(
        text(
            "INSERT INTO otps (email, code, expires_at, used)"
            " VALUES (:email, :code, NOW() + INTERVAL '10 minutes', false)"
        ),
        {"email": body.email, "code": code}
    )
    await db.commit()
    print(f"OTP for {body.email}: {code}")  # TODO: send via SES instead of logging
    return {"message": "OTP sent to admin email"}


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