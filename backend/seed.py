import asyncio
import asyncpg
import bcrypt
import uuid
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv()

RAW_URL = os.getenv("DATABASE_URL")
# asyncpg uses postgresql:// (not postgresql+asyncpg://)
DATABASE_URL = RAW_URL.replace("postgresql+asyncpg://", "postgresql://").split("?")[0]

TEACHERS = [
    ("Sandhya Chhetri", "sandhya.chhetri@inventure.edu"),
    ("Anwesha Basu",    "anwesha.basu@inventure.edu"),
    ("Shubha S",        "shubha.s@inventure.edu"),
    ("Anthony Samuel",  "anthony.samuel@inventure.edu"),
    ("Priya Naidu",     "priya.naidu@inventure.edu"),
    ("Sunaina Naugain", "sunaina.naugain@inventure.edu"),
    ("Helen Gilbert",   "helen.gilbert@inventure.edu"),
    ("Muneezah Mattu",  "muneezah.mattu@inventure.edu"),
]

PTM_DATE = datetime(2026, 4, 9, 8, 10)   # 08:10 on PTM day
SLOT_DURATION = timedelta(minutes=7)
NUM_SLOTS = 15
TEACHER_PASSWORD = "teacher123"


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


async def main():
    print(f"Connecting to database...")
    conn = await asyncpg.connect(DATABASE_URL, ssl="require")
    print("Connected.\n")

    # --- Get school ---
    school = await conn.fetchrow("SELECT id FROM schools WHERE invite_code = 'INVENT-2026'")
    if not school:
        print("ERROR: school with invite_code INVENT-2026 not found. Run the DB setup first.")
        await conn.close()
        return
    school_id = school["id"]
    print(f"School id: {school_id}\n")

    # --- Upsert 8 new teachers ---
    hashed = hash_password(TEACHER_PASSWORD)
    teacher_ids = {}

    for name, email in TEACHERS:
        existing = await conn.fetchrow(
            "SELECT id FROM users WHERE email = $1 AND school_id = $2",
            email, school_id
        )
        if existing:
            teacher_ids[email] = existing["id"]
            print(f"  [skip]   {name} ({email}) — already exists")
        else:
            uid = str(uuid.uuid4())
            await conn.execute(
                """
                INSERT INTO users (id, school_id, name, email, hashed_password, role)
                VALUES ($1, $2, $3, $4, $5, 'teacher')
                """,
                uid, school_id, name, email, hashed
            )
            teacher_ids[email] = uid
            print(f"  [added]  {name} ({email})")

    # --- Also get Susan Christi who was seeded earlier ---
    susan = await conn.fetchrow(
        "SELECT id FROM users WHERE email = 'susan.christi@inventure.edu' AND school_id = $1",
        school_id
    )
    if susan:
        teacher_ids["susan.christi@inventure.edu"] = susan["id"]
        print(f"  [found]  Susan Christi — already exists")
    else:
        uid = str(uuid.uuid4())
        await conn.execute(
            """
            INSERT INTO users (id, school_id, name, email, hashed_password, role)
            VALUES ($1, $2, 'Susan Christi', 'susan.christi@inventure.edu', $3, 'teacher')
            """,
            uid, school_id, hashed
        )
        teacher_ids["susan.christi@inventure.edu"] = uid
        print(f"  [added]  Susan Christi")

    print(f"\nSeeding slots ({NUM_SLOTS} per teacher, starting {PTM_DATE.strftime('%H:%M')}, 7-min intervals)...\n")

    all_emails = [email for _, email in TEACHERS] + ["susan.christi@inventure.edu"]

    for email in all_emails:
        teacher_id = teacher_ids[email]

        # Check how many slots this teacher already has on PTM day
        existing_count = await conn.fetchval(
            """
            SELECT COUNT(*) FROM slots
            WHERE teacher_id = $1
              AND start_time::date = $2
            """,
            teacher_id, PTM_DATE.date()
        )
        if existing_count >= NUM_SLOTS:
            print(f"  [skip]   {email} — {existing_count} slots already exist")
            continue

        created = 0
        for i in range(NUM_SLOTS):
            start = PTM_DATE + i * SLOT_DURATION
            end   = start + SLOT_DURATION
            slot_id = str(uuid.uuid4())
            await conn.execute(
                """
                INSERT INTO slots (id, teacher_id, school_id, start_time, end_time, capacity)
                VALUES ($1, $2, $3, $4, $5, 1)
                """,
                slot_id, teacher_id, school_id, start, end
            )
            created += 1

        print(f"  [done]   {email} — {created} slots created")

    await conn.close()
    print("\nSeeding complete.")


if __name__ == "__main__":
    asyncio.run(main())
