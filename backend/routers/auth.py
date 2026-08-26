from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel, EmailStr
from database import get_db
from auth import hash_password, verify_password, create_access_token, get_current_user
from email_service import send_otp_email
import os
import uuid
import secrets
import asyncio

router = APIRouter(prefix="/auth", tags=["auth"])


def generate_otp() -> str:
    """Random 6-digit login code. Always random — no dev/test fallback."""
    return f"{secrets.randbelow(1_000_000):06d}"


# Max OTP requests allowed per email address within the sliding window.
OTP_RATE_LIMIT = 3
OTP_RATE_WINDOW_MINUTES = 15

# Minimum gap between two OTP requests for the same email (separate from, and
# in addition to, the 15-minute cap above — this catches rapid-fire resends
# within that window rather than the count over the whole window).
OTP_RESEND_COOLDOWN_SECONDS = 30

# Wrong verification guesses allowed against one issued code before it's
# invalidated outright.
OTP_MAX_ATTEMPTS = 5


async def lock_otp_email(db: AsyncSession, email: str) -> None:
    """Per-email advisory lock, transaction-scoped (auto-released on commit
    or rollback) — serializes concurrent OTP-issuing requests for the SAME
    email so the rate-limit/cooldown checks below and the eventual INSERT
    can't race. This is the real fix for double-click-sends-two-emails: a
    bare "INSERT ... WHERE NOT EXISTS (...)" is NOT atomic against two
    concurrent transactions under Postgres's default READ COMMITTED
    isolation, even combined into one statement — a plain SELECT-based
    existence check takes no lock, so two simultaneous requests can each
    see "no recent code" before either commits, and both insert. This is
    different from /verify-otp's attempt counter, which IS safe as a bare
    atomic UPDATE: that targets an EXISTING row, and Postgres's row-level
    locking genuinely serializes concurrent UPDATEs on the same row. Here
    there's no existing row to lock — the lock has to be explicit.
    Different emails aren't serialized against each other."""
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:email)::bigint)"),
        {"email": email},
    )


async def enforce_otp_rate_limit(db: AsyncSession, email: str) -> None:
    """Raise HTTP 429 if this email has requested too many OTPs recently.

    Counts rows in the otps table created within the last
    OTP_RATE_WINDOW_MINUTES; caps at OTP_RATE_LIMIT. Guards our email quota and
    keeps a single address from being used to spam login codes."""
    result = await db.execute(
        text(
            "SELECT COUNT(*) FROM otps"
            " WHERE email = :email"
            f" AND created_at > NOW() - INTERVAL '{OTP_RATE_WINDOW_MINUTES} minutes'"
        ),
        {"email": email},
    )
    if (result.scalar() or 0) >= OTP_RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail="Too many login code requests. Please wait a few minutes and try again.",
        )


async def enforce_otp_resend_cooldown(db: AsyncSession, email: str) -> None:
    """Raise HTTP 429 if a code was requested for this email within the last
    OTP_RESEND_COOLDOWN_SECONDS. Computed DB-side (not in Python) to avoid
    app/DB clock skew. Looks at the most recent row regardless of used/expired
    state — this guards request frequency, not code validity."""
    result = await db.execute(
        text(
            "SELECT GREATEST(0, CEIL(EXTRACT(EPOCH FROM"
            f" (created_at + INTERVAL '{OTP_RESEND_COOLDOWN_SECONDS} seconds' - NOW()))))"
            " AS remaining FROM otps WHERE email = :email"
            " ORDER BY created_at DESC LIMIT 1"
        ),
        {"email": email},
    )
    row = result.fetchone()
    if row is not None and row.remaining and row.remaining > 0:
        raise HTTPException(
            status_code=429,
            detail=f"Please wait {int(row.remaining)} seconds before requesting a new code.",
        )


async def invalidate_outstanding_otps(db: AsyncSession, email: str) -> None:
    """Mark all previous unused codes for this email as used, so only the
    newest one can verify. Must run strictly before the new row is inserted —
    otherwise this would invalidate the code being minted."""
    await db.execute(
        text("UPDATE otps SET used = true WHERE email = :email AND used = false"),
        {"email": email},
    )

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str
    invite_code: str
    # NOTE: role is intentionally NOT accepted here. Public self-signup can only
    # ever create a 'parent' (forced server-side). Teacher/admin accounts are
    # created via seed/admin flows only. Any `role` sent in the body is ignored.

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

    # Self-signup always creates a parent. Never trust a client-supplied role.
    role = "parent"
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
            "role": role
        }
    )
    await db.commit()

    token = create_access_token({"sub": user_id, "role": role, "school_id": str(school.id), "name": body.name})
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
        text("SELECT id, role, name FROM users WHERE email = :email"),
        {"email": body.email}
    )
    user = result.fetchone()
    if not user:
        raise HTTPException(status_code=404, detail="No account found for this email")
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Admins use password login")

    # Everything from here through the INSERT is one serialized critical
    # section per email — closes the double-click-sends-two-emails race.
    await lock_otp_email(db, body.email)
    await enforce_otp_rate_limit(db, body.email)
    await enforce_otp_resend_cooldown(db, body.email)
    await invalidate_outstanding_otps(db, body.email)
    code = generate_otp()
    await db.execute(
        text(
            "INSERT INTO otps (email, code, expires_at, used)"
            " VALUES (:email, :code, NOW() + INTERVAL '10 minutes', false)"
        ),
        {"email": body.email, "code": code}
    )
    await db.commit()
    # DB owns verification; SendGrid only delivers. Off-thread so we don't block the loop.
    sent = await asyncio.to_thread(send_otp_email, body.email, user.name, code)
    if not sent:
        raise HTTPException(status_code=502, detail="Couldn't send the login code. Please try again.")
    return {"message": "OTP sent"}


DEMO_EMAIL = "demo@inventureacademy.com"


@router.post("/verify-otp")
async def verify_otp(body: VerifyOtpRequest, db: AsyncSession = Depends(get_db)):
    # Demo login: only active when DEMO_SECRET_CODE is set (prod). The code is
    # checked against the env secret, NOT the otps table. Disabled otherwise, so
    # tests/local fall through to the normal OTP flow below. Never touches
    # otps, so it's exempt from attempt-limiting below — by design, not an
    # oversight.
    demo_secret = os.getenv("DEMO_SECRET_CODE")
    if demo_secret and body.email == DEMO_EMAIL:
        if body.code != demo_secret:
            raise HTTPException(status_code=400, detail="Invalid or expired OTP")
        result = await db.execute(
            text("SELECT id, role, school_id, name, section, grade, family_id, parent_name FROM users WHERE email = :email"),
            {"email": body.email}
        )
        user = result.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="No account found for this email")
        token = create_access_token({
            "sub": str(user.id), "role": user.role, "school_id": str(user.school_id),
            "name": user.name, "section": user.section, "grade": user.grade,
            "family_id": user.family_id, "parent_name": user.parent_name,
        })
        return {"access_token": token, "token_type": "bearer", "role": user.role, "name": user.name}

    result = await db.execute(
        text(
            "SELECT id, code, attempts FROM otps"
            " WHERE email = :email AND used = false AND expires_at > NOW()"
            " ORDER BY created_at DESC LIMIT 1"
        ),
        {"email": body.email}
    )
    otp = result.fetchone()
    if not otp:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    if otp.code != body.code:
        # Atomic UPDATE ... RETURNING: increments and (in the same statement,
        # once the post-increment count reaches the cap) invalidates the code
        # in one round trip, so two concurrent wrong guesses can't race and
        # silently lose an increment the way a separate SELECT-then-UPDATE
        # would.
        attempt_result = await db.execute(
            text(
                "UPDATE otps SET attempts = attempts + 1,"
                " used = CASE WHEN attempts + 1 >= :max THEN true ELSE used END"
                " WHERE id = :id AND used = false"
                " RETURNING attempts, used"
            ),
            {"id": str(otp.id), "max": OTP_MAX_ATTEMPTS},
        )
        attempt_row = attempt_result.fetchone()
        await db.commit()
        if attempt_row is not None and attempt_row.used:
            raise HTTPException(
                status_code=400,
                detail="Too many incorrect attempts. Please request a new code.",
            )
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
        text("SELECT id, hashed_password, role, name FROM users WHERE email = :email"),
        {"email": body.email}
    )
    user = result.fetchone()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.role != "admin":
        raise HTTPException(status_code=400, detail="Not an admin account")

    # Everything from here through the INSERT is one serialized critical
    # section per email — closes the double-click-sends-two-emails race.
    await lock_otp_email(db, body.email)
    await enforce_otp_rate_limit(db, body.email)
    await enforce_otp_resend_cooldown(db, body.email)
    await invalidate_outstanding_otps(db, body.email)
    code = generate_otp()
    await db.execute(
        text(
            "INSERT INTO otps (email, code, expires_at, used)"
            " VALUES (:email, :code, NOW() + INTERVAL '10 minutes', false)"
        ),
        {"email": body.email, "code": code}
    )
    await db.commit()
    sent = await asyncio.to_thread(send_otp_email, body.email, user.name, code)
    if not sent:
        raise HTTPException(status_code=502, detail="Couldn't send the login code. Please try again.")
    return {"message": "OTP sent to admin email"}


@router.get("/me")
async def get_me(db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    result = await db.execute(
        text("SELECT u.id, u.name, u.email, u.role, u.venue, u.section, u.grade,"
             " u.family_id, u.parent_name, u.subject, u.room, u.room_location, s.ptm_date"
             " FROM users u JOIN schools s ON u.school_id = s.id WHERE u.id = :uid"),
        {"uid": current_user["sub"]}
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    m = dict(row._mapping)
    if m.get("ptm_date") is not None:
        m["ptm_date"] = m["ptm_date"].isoformat()  # 'YYYY-MM-DD'
    return m


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