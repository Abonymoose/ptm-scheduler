"""
Pilot seed: one Mehta family at Inventure with its students and the
teacher_sections rows that drive GET /parent/children.

Run with:  cd backend && python seed_pilot.py
Writes to DATABASE_URL from backend/.env. Requires migration 008.

Idempotent: the family and student ids are uuid5s derived from the school id,
so re-running updates the same rows instead of duplicating them.
"""
import asyncio
import asyncpg
import os
import uuid
from dotenv import load_dotenv

load_dotenv()

RAW_URL = os.getenv("DATABASE_URL")
DATABASE_URL = RAW_URL.replace("postgresql+asyncpg://", "postgresql://").split("?")[0]

SCHOOL_ID = "21627bd2-7469-425a-bd2b-401e1eaccc44"   # Inventure Academy
_NS = uuid.UUID(SCHOOL_ID)
FAMILY_ID = str(uuid.uuid5(_NS, "family:mehta"))

# (name, section, grade)
STUDENTS = [
    ("Parshv Mehta", "7C", 7),
    ("Dhriti Mehta", "4A", 4),
]

# Teacher names as stored (titles like "Ms." are matched loosely).
SECTION_TEACHERS = {
    "7C": ["Sandhya Chhetri", "Helen Gilbert", "Priya Naidu", "Susan Christi", "Anwesha Basu",
           "Anthony Samuel", "Sunaina Naugain", "Shubha S", "Muneezah Mattu"],
    "4A": ["Kavya Sharma", "Rina Patel", "Deepa Nair", "Preethi Rao", "Anjali Menon", "Swati Joshi"],
}

# Parent accounts that belong to this family, matched by name within the school.
# Paras Mehta is the real account holding the family's live bookings; Demo Seed
# is the demo-tab account.
FAMILY_PARENTS = ["Paras Mehta", "Demo Seed"]


async def main():
    conn = await asyncpg.connect(DATABASE_URL, ssl="require")
    try:
        async with conn.transaction():
            await conn.execute(
                "INSERT INTO families (id, school_id) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
                FAMILY_ID, SCHOOL_ID,
            )
            print(f"[family]   {FAMILY_ID}")

            for name, section, grade in STUDENTS:
                sid = str(uuid.uuid5(_NS, f"student:{name}"))
                await conn.execute(
                    "INSERT INTO students (id, school_id, family_id, name, section, grade)"
                    " VALUES ($1, $2, $3, $4, $5, $6)"
                    " ON CONFLICT (id) DO UPDATE SET family_id = EXCLUDED.family_id,"
                    "   name = EXCLUDED.name, section = EXCLUDED.section, grade = EXCLUDED.grade",
                    sid, SCHOOL_ID, FAMILY_ID, name, section, grade,
                )
                print(f"[student]  {name} — {section}, grade {grade}")

            for section, names in SECTION_TEACHERS.items():
                for tname in names:
                    rows = await conn.fetch(
                        "SELECT id, name FROM users"
                        " WHERE school_id = $1 AND role = 'teacher' AND name ILIKE $2",
                        SCHOOL_ID, f"%{tname}%",
                    )
                    if len(rows) != 1:
                        raise SystemExit(f"Expected exactly one teacher matching {tname!r}, found {len(rows)}")
                    await conn.execute(
                        "INSERT INTO teacher_sections (teacher_id, school_id, section)"
                        " VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
                        rows[0]["id"], SCHOOL_ID, section,
                    )
                    print(f"[section]  {section} ← {rows[0]['name']}")

            for pname in FAMILY_PARENTS:
                updated = await conn.fetch(
                    "UPDATE users SET family_id = $1"
                    " WHERE school_id = $2 AND role = 'parent' AND name = $3 RETURNING id",
                    FAMILY_ID, SCHOOL_ID, pname,
                )
                if len(updated) != 1:
                    raise SystemExit(f"Expected exactly one parent named {pname!r}, found {len(updated)}")
                print(f"[parent]   {pname} → family")
    finally:
        await conn.close()
    print("\nDone.")


if __name__ == "__main__":
    asyncio.run(main())
