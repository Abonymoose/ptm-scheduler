"""
One-time script: replace the old single 'Paras' parent account with two
student/parent accounts (Parshv 7C, Dhriti 4A) under the Mehta family.

Run once with:  cd backend && python create_students.py
Safe to re-run (idempotent on the student accounts).
"""
import asyncio
import asyncpg
import bcrypt
import uuid
import os
from dotenv import load_dotenv

load_dotenv()

RAW_URL = os.getenv("DATABASE_URL")
# asyncpg uses postgresql:// (not postgresql+asyncpg://)
DATABASE_URL = RAW_URL.replace("postgresql+asyncpg://", "postgresql://").split("?")[0]

SCHOOL_ID = "21627bd2-7469-425a-bd2b-401e1eaccc44"
STUDENT_PASSWORD = "student123"

# (name, email, section, grade, family_id)
STUDENTS = [
    ("Parshv Mehta", "parshv.mehta@inventureacademy.com", "7C", 7, "mehta"),
    ("Dhriti Mehta", "dhriti.mehta@inventureacademy.com", "4A", 4, "mehta"),
]

OLD_PARENT_ID = "4c2f7b36-af66-454f-94de-3c6d7dbf28d4"   # Paras
OLD_PARENT_EMAIL = "parasmehta64@gmail.com"


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


async def main():
    print("Connecting to database...")
    conn = await asyncpg.connect(DATABASE_URL, ssl="require")
    print("Connected.\n")

    # --- Step 0: make sure the student columns exist ---
    # The base users table (see seed.py) has no section/grade/family_id columns,
    # so add them idempotently before inserting.
    await conn.execute(
        """
        ALTER TABLE users ADD COLUMN IF NOT EXISTS section   TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS grade     INTEGER;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS family_id TEXT;
        """
    )
    print("[schema] ensured section / grade / family_id columns exist\n")

    # --- Step 1: create the two student accounts ---
    hashed = hash_password(STUDENT_PASSWORD)
    parshv_id = None
    print("Creating student accounts...")
    for name, email, section, grade, family_id in STUDENTS:
        existing = await conn.fetchrow(
            "SELECT id FROM users WHERE email = $1", email
        )
        if existing:
            new_id = existing["id"]
            print(f"  [skip]   {name} ({email}) — already exists")
        else:
            new_id = str(uuid.uuid4())
            await conn.execute(
                """
                INSERT INTO users
                    (id, school_id, name, email, hashed_password, role,
                     section, grade, family_id)
                VALUES ($1, $2, $3, $4, $5, 'parent', $6, $7, $8)
                ON CONFLICT DO NOTHING
                """,
                new_id, SCHOOL_ID, name, email, hashed, section, grade, family_id,
            )
            print(f"  [added]  {name} ({email}) — {section}, grade {grade}")
        if email == "parshv.mehta@inventureacademy.com":
            parshv_id = new_id
    print(f"  Parshv id: {parshv_id}\n")

    # --- Safety check: id and email must be the same user before deleting ---
    print("Verifying old parent id/email match...")
    old = await conn.fetchrow(
        "SELECT id, email FROM users WHERE id = $1", OLD_PARENT_ID
    )
    if old is None:
        print(f"  [warn] No user with id {OLD_PARENT_ID} — nothing to delete. Aborting deletes.\n")
        await conn.close()
        print("Done (students created; no deletes performed).")
        return
    if old["email"] != OLD_PARENT_EMAIL:
        print(
            f"  [warn] id {OLD_PARENT_ID} belongs to '{old['email']}', "
            f"not '{OLD_PARENT_EMAIL}'. Aborting deletes to avoid touching the wrong user.\n"
        )
        await conn.close()
        print("Done (students created; no deletes performed).")
        return
    print(f"  [ok] id {OLD_PARENT_ID} matches {OLD_PARENT_EMAIL}\n")

    # --- Step 2: delete all bookings for the old Paras account ---
    print("Deleting old parent's bookings...")
    result = await conn.execute(
        "DELETE FROM bookings WHERE parent_id = $1", OLD_PARENT_ID
    )
    print(f"  {result}   (parent_id={OLD_PARENT_ID})\n")

    # --- Step 3: delete the old parent account (after its bookings are gone) ---
    print("Deleting old parent account...")
    result = await conn.execute(
        "DELETE FROM users WHERE email = $1", OLD_PARENT_EMAIL
    )
    print(f"  {result}   (email={OLD_PARENT_EMAIL})\n")

    await conn.close()
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
