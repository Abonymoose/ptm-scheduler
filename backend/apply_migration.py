"""Apply a .sql migration to a target DB.

Usage:
  python apply_migration.py migrations/001_meeting_notes.sql test   # -> TEST_DATABASE_URL
  python apply_migration.py migrations/001_meeting_notes.sql prod   # -> DATABASE_URL
"""
import asyncio
import os
import sys
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from sqlalchemy.pool import NullPool

HERE = os.path.dirname(__file__)
load_dotenv(os.path.join(HERE, ".env"))
load_dotenv(os.path.join(HERE, ".env.test"))


async def main(sql_path: str, target: str):
    if target == "test":
        raw = os.getenv("TEST_DATABASE_URL")
    elif target == "prod":
        raw = os.getenv("DATABASE_URL")
    else:
        raise SystemExit("target must be 'test' or 'prod'")
    if not raw:
        raise SystemExit(f"No connection string for target '{target}'")

    url = raw.replace("postgresql://", "postgresql+asyncpg://").split("?")[0]
    with open(os.path.join(HERE, sql_path), "r", encoding="utf-8") as f:
        ddl = f.read()

    engine = create_async_engine(url, poolclass=NullPool, connect_args={"ssl": "require"})
    async with engine.begin() as conn:
        await conn.execute(text(ddl))
        # Confirm the table exists.
        res = await conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'meeting_notes' ORDER BY ordinal_position"
        ))
        cols = [r.column_name for r in res.fetchall()]
    await engine.dispose()
    print(f"[{target}] applied {sql_path}. meeting_notes columns: {cols}")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1], sys.argv[2]))
