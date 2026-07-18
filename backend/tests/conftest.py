"""
Shared pytest fixtures for the PTM Scheduler backend suite.

SAFETY: this suite runs ONLY against the Neon test branch. It reads
TEST_DATABASE_URL from backend/.env.test (or the environment). If that variable
is missing it HARD FAILS — it never falls back to the production DATABASE_URL.

The test DB is fully reset (TRUNCATE … CASCADE) and re-seeded before *every*
test, so tests are independent of each other and of run order.
"""
import os
import sys
import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest
from dotenv import load_dotenv

# --- Resolve paths: backend/ is the import root, backend/.env.test holds creds.
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# --- Load test env BEFORE importing the app (database.py reads DATABASE_URL at import).
load_dotenv(BACKEND_DIR / ".env.test")

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")
if not TEST_DATABASE_URL:
    raise RuntimeError(
        "TEST_DATABASE_URL is not set. Create backend/.env.test with the Neon "
        "TEST BRANCH connection string. Refusing to run — will NOT fall back to "
        "the production DATABASE_URL."
    )

# Guard: make the app point at the test DB, and never let a stray .env prod URL win.
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")

# Quiet SQLAlchemy's echo=True so test output stays readable.
import logging
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

# --- Now it is safe to import the app + helpers (they bind to the test DB).
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from sqlalchemy.pool import NullPool
from fastapi.testclient import TestClient

from main import app                       # noqa: E402
from auth import create_access_token, hash_password  # noqa: E402

# Safety: tests must never send a real email. Even if the dev machine has a
# provider key in its environment/.env, force it off so OTP stays 000000 and
# send_otp_email() only logs. (database.py's load_dotenv runs during the import
# above, so we pop AFTER it.)
os.environ.pop("MSG91_AUTH_KEY", None)
# Same for the demo secret — tests set it per-case via monkeypatch; default off.
os.environ.pop("DEMO_SECRET_CODE", None)

# --- A dedicated seeding engine (NullPool → a fresh connection per asyncio.run,
#     so it never reuses a connection across event loops).
_seed_url = TEST_DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://").split("?")[0]
seed_engine = create_async_engine(_seed_url, poolclass=NullPool, connect_args={"ssl": "require"})


# ----------------------------------------------------------------------------
# Seed data — fixed UUIDs so tests can reference rows directly.
# ----------------------------------------------------------------------------
SCHOOL_ID = str(uuid.uuid4())
ADMIN_ID = str(uuid.uuid4())
T1_ID = str(uuid.uuid4())
T2_ID = str(uuid.uuid4())
PARENT_ID = str(uuid.uuid4())
PARENT2_ID = str(uuid.uuid4())
DEMO_ID = str(uuid.uuid4())
DEMO_EMAIL = "demo@inventureacademy.com"

INVITE_CODE = "TEST-2026"
ADMIN_PASSWORD = "admin123"
PARENT_PASSWORD = "parent123"

_D = lambda h, m: datetime(2026, 4, 9, h, m, tzinfo=timezone.utc)
# label -> (teacher_id, start, end)
SLOT_DEFS = {
    "A": (T1_ID, _D(8, 10), _D(8, 17)),
    "B": (T1_ID, _D(8, 17), _D(8, 24)),
    "C": (T1_ID, _D(8, 24), _D(8, 31)),
    "D": (T1_ID, _D(8, 31), _D(8, 38)),
    "E": (T2_ID, _D(8, 10), _D(8, 17)),   # overlaps A (different teacher)
    "F": (T2_ID, _D(8, 17), _D(8, 24)),
}
SLOT_IDS = {label: str(uuid.uuid4()) for label in SLOT_DEFS}


async def _reset_and_seed():
    async with seed_engine.begin() as conn:
        await conn.execute(text(
            "TRUNCATE meeting_notes, bookings, slots, otps, users, schools RESTART IDENTITY CASCADE"
        ))
        await conn.execute(
            text("INSERT INTO schools (id, name, invite_code) VALUES (:id, :n, :c)"),
            {"id": SCHOOL_ID, "n": "Test Academy", "c": INVITE_CODE},
        )
        users = [
            {"id": ADMIN_ID, "name": "Admin User", "email": "admin@test.edu",
             "pwd": hash_password(ADMIN_PASSWORD), "role": "admin",
             "subject": None, "venue": None, "section": None, "grade": None, "pn": None},
            {"id": T1_ID, "name": "Ms. Teacher One", "email": "teacher1@test.edu",
             "pwd": hash_password(PARENT_PASSWORD), "role": "teacher",
             "subject": "Math", "venue": "Room 1", "section": None, "grade": None, "pn": None},
            {"id": T2_ID, "name": "Mr. Teacher Two", "email": "teacher2@test.edu",
             "pwd": hash_password(PARENT_PASSWORD), "role": "teacher",
             "subject": "Science", "venue": "Room 2", "section": None, "grade": None, "pn": None},
            {"id": PARENT_ID, "name": "Parent One", "email": "parent@test.edu",
             "pwd": hash_password(PARENT_PASSWORD), "role": "parent",
             "subject": None, "venue": None, "section": "5A", "grade": 5, "pn": "Parent One"},
            {"id": PARENT2_ID, "name": "Parent Two", "email": "parent2@test.edu",
             "pwd": hash_password(PARENT_PASSWORD), "role": "parent",
             "subject": None, "venue": None, "section": "5B", "grade": 5, "pn": "Parent Two"},
            {"id": DEMO_ID, "name": "Demo Admin", "email": DEMO_EMAIL,
             "pwd": hash_password(ADMIN_PASSWORD), "role": "admin",
             "subject": None, "venue": None, "section": None, "grade": None, "pn": None},
        ]
        for u in users:
            await conn.execute(
                text("INSERT INTO users (id, school_id, name, email, hashed_password, role,"
                     " subject, venue, section, grade, parent_name)"
                     " VALUES (:id, :sid, :name, :email, :pwd, CAST(:role AS user_role),"
                     " :subject, :venue, :section, :grade, :pn)"),
                {**u, "sid": SCHOOL_ID},
            )
        for label, (tid, start, end) in SLOT_DEFS.items():
            await conn.execute(
                text("INSERT INTO slots (id, teacher_id, school_id, start_time, end_time, capacity)"
                     " VALUES (:id, :tid, :sid, :start, :end, 1)"),
                {"id": SLOT_IDS[label], "tid": tid, "sid": SCHOOL_ID, "start": start, "end": end},
            )


def _tok(sub, role, name):
    return create_access_token({"sub": sub, "role": role, "school_id": SCHOOL_ID, "name": name})


@pytest.fixture(scope="session")
def client():
    # Context-manager form keeps a single event loop/portal for the app engine
    # across all requests (avoids asyncpg "attached to a different loop" errors).
    with TestClient(app) as c:
        yield c
    asyncio.run(seed_engine.dispose())


@pytest.fixture(autouse=True)
def seed():
    """Reset + reseed before every test. Returns the seed context."""
    asyncio.run(_reset_and_seed())
    return {
        "school_id": SCHOOL_ID,
        "invite_code": INVITE_CODE,
        "admin_password": ADMIN_PASSWORD,
        "ids": {"admin": ADMIN_ID, "t1": T1_ID, "t2": T2_ID, "parent": PARENT_ID, "parent2": PARENT2_ID, "demo": DEMO_ID},
        "emails": {"admin": "admin@test.edu", "t1": "teacher1@test.edu", "t2": "teacher2@test.edu",
                   "parent": "parent@test.edu", "parent2": "parent2@test.edu", "demo": DEMO_EMAIL},
        "slots": dict(SLOT_IDS),
        "tokens": {
            "admin": _tok(ADMIN_ID, "admin", "Admin User"),
            "t1": _tok(T1_ID, "teacher", "Ms. Teacher One"),
            "t2": _tok(T2_ID, "teacher", "Mr. Teacher Two"),
            "parent": _tok(PARENT_ID, "parent", "Parent One"),
            "parent2": _tok(PARENT2_ID, "parent", "Parent Two"),
        },
    }


def auth(token):
    """Bearer header helper, imported by test modules via `from conftest import auth`."""
    return {"Authorization": f"Bearer {token}"}


# ----------------------------------------------------------------------------
# Custom terminal summary: pass/fail counts + each failing endpoint test.
# ----------------------------------------------------------------------------
def pytest_terminal_summary(terminalreporter, exitstatus, config):
    tr = terminalreporter
    passed = len(tr.stats.get("passed", []))
    failed = tr.stats.get("failed", [])
    errors = tr.stats.get("error", [])
    tr.write_line("")
    tr.write_line("=" * 70)
    tr.write_line(f"ENDPOINT TEST SUMMARY:  {passed} passed / {len(failed)} failed"
                  + (f" / {len(errors)} errored" if errors else ""))
    if failed or errors:
        tr.write_line("Failing endpoints:")
        for rep in failed + errors:
            tr.write_line(f"  FAIL  {rep.nodeid}")
    tr.write_line("=" * 70)
