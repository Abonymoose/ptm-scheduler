"""Ensure demo@inventureacademy.com exists as a real admin account.

Usage:  python ensure_demo_user.py prod   (or 'test')
Idempotent — safe to re-run. The demo user logs in via DEMO_SECRET_CODE, so the
stored password is irrelevant (a random hash).
"""
import asyncio, os, sys, uuid, secrets
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from sqlalchemy.pool import NullPool

HERE = os.path.dirname(__file__)
load_dotenv(os.path.join(HERE, ".env"))
load_dotenv(os.path.join(HERE, ".env.test"))
os.environ.setdefault("SECRET_KEY", "provision")
from auth import hash_password  # noqa: E402

DEMO_EMAIL = "demo@inventureacademy.com"


async def main(target):
    raw = os.getenv("TEST_DATABASE_URL") if target == "test" else os.getenv("DATABASE_URL")
    if not raw:
        raise SystemExit(f"No connection string for target '{target}'")
    url = raw.replace("postgresql://", "postgresql+asyncpg://").split("?")[0]
    engine = create_async_engine(url, poolclass=NullPool, connect_args={"ssl": "require"})
    async with engine.begin() as c:
        row = (await c.execute(text("SELECT id, role FROM users WHERE email = :e"), {"e": DEMO_EMAIL})).fetchone()
        if row:
            if row.role != "admin":
                await c.execute(text("UPDATE users SET role = 'admin' WHERE email = :e"), {"e": DEMO_EMAIL})
                print(f"[{target}] demo user existed with role {row.role} -> updated to admin")
            else:
                print(f"[{target}] demo user already exists as admin ({row.id})")
        else:
            school = (await c.execute(text("SELECT id FROM schools ORDER BY created_at LIMIT 1"))).fetchone()
            if not school:
                raise SystemExit("No school found to attach the demo user to")
            uid = str(uuid.uuid4())
            await c.execute(
                text("INSERT INTO users (id, school_id, name, email, hashed_password, role)"
                     " VALUES (:id, :sid, 'Demo Admin', :e, :p, 'admin')"),
                {"id": uid, "sid": str(school.id), "e": DEMO_EMAIL, "p": hash_password(secrets.token_hex(16))}
            )
            print(f"[{target}] created demo admin {uid} in school {school.id}")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "prod"))
