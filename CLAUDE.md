CLAUDE.md

Guidance for Claude Code when working in this repository.

Project Overview

PTM Now — Parent-Teacher Meeting scheduling, live at ptmnow.com and heading toward a pilot at Inventure Academy, Bangalore. Multi-tenant from day one: schools are rows, every query is scoped by school_id.

Accounts are provisioned, not self-served. There is no public signup. Parents and teachers log in with an emailed OTP; admins use password + OTP.

Commands
Backend
bash
cd backend
venv\Scripts\activate          # Windows local
source venv/bin/activate       # EC2

uvicorn main:app --reload
pip install -r requirements.txt
pytest                          # 145 tests, runs against the Neon test branch

Env vars in backend/.env (never committed):

DATABASE_URL — Neon prod branch
SECRET_KEY — JWT signing key. App refuses to start without it.
SENDGRID_API_KEY — app refuses to start without it.

Tests read TEST_DATABASE_URL from backend/.env.test. It hard-fails rather than falling back to prod — do not weaken that.

Frontend
bash
cd frontend
npm install
npm run dev
npm run build
npm run lint
Deployment

Backend: on EC2, git pull then sudo systemctl restart ptm. Always pull before restarting.

Frontend: npm run build locally, delete public_html/assets/ on the server, upload dist/ via FileZilla, then Empty Cache and Hard Reload. Vite content-hashes filenames, so old bundles accumulate instead of being overwritten.

Nginx routing — not obvious from the repo, and has caused confusion twice:

location = /, /how-it-works, /privacy, /faq → /home/ubuntu/landing/*.html. Exact matches, so they outrank the SPA fallback and never reach React.
location /api/ → proxy_pass http://127.0.0.1:8000/. The API is under /api/, not at the domain root.
location / → /home/ubuntu/public_html/, SPA fallback to index.html.

landing/ lives only on the EC2 box. Not in version control.

Architecture
Backend (backend/)
main.py — FastAPI entry, mounts routers
database.py — async SQLAlchemy engine to Neon. Strips query params, forces SSL, rewrites postgresql:// → postgresql+asyncpg://
auth.py — JWT utilities. Tokens carry sub, role, school_id; 24h TTL
email_service.py — SendGrid. send_otp_email(to, name, code)
routers/auth.py — OTP request/verify, admin login
routers/slots.py — slot CRUD
routers/bookings.py — booking with SELECT FOR UPDATE
routers/admin.py — admin operations
routers/notes.py — meeting notes
routers/schools.py — public GET /schools/by-slug/{slug} for login branding
routers/demo.py — demo control panel. One router-level gate (require_demo_access): 404 unless DEMO_ENABLED=true, then admin role + email in DEMO_ADMIN_EMAILS, else 403. New demo routes inherit it; don't add per-route auth. There is no special demo login: the demo account is an ordinary admin (password + OTP). The DEMO_SECRET_CODE shortcut was removed and must not come back.
teachers.py — create_teacher (shared by POST /admin/teachers and /demo/add-teacher) and the slot-grid helpers. Email uniqueness is checked across all schools because login looks users up by email alone.
routers/parent.py — GET /parent/children: the parent's family's students, each with their section's teachers
seed_pilot.py — idempotent seed of the Inventure pilot family, students and teacher_sections
migrations/ — hand-applied SQL, numbered
Database

Raw SQL via SQLAlchemy text() with named parameters. No ORM models. Schema lives in Neon; migrations are applied by hand to both branches.

schools   id, name, invite_code, slug
users     id, name, email, hashed_password, role, school_id,
          section, grade, family_id, parent_name, subject
slots     id, teacher_id, start_time, end_time, capacity, is_booked
bookings  id, parent_id, slot_id, status, created_at, student_name, section
otps      id, email, code, expires_at, used, created_at, attempts
families          id, school_id, created_at
students          id, school_id, family_id, name, section, grade
teacher_sections  teacher_id, school_id, section   (PK teacher_id, section)

users.family_id is a UUID FK to families (migration 008). It goes into the JWT, so stringify it there — a raw UUID makes jwt.encode raise.
Frontend (frontend/)

React 19 + Vite + Tailwind 4. Routes in App.jsx:

/:slug → BrandedLogin (e.g. /inventure). Unknown slug → 404. A non-404 lookup failure degrades to unbranded login so auth never blocks.
/parent, /teacher, /admin → role-guarded
* → real 404 page
There is no /login route. ProtectedRoute and logout go to /inventure.

Auth state in src/context/AuthContext.jsx.

Auth — read before touching
OTP is always 6 random digits from secrets.randbelow(1_000_000). There was once a 000000 fallback when no provider was configured. It let anyone log in as anyone. It is gone and must never come back.
10-minute expiry, single use.
3 requests per email per 15 min; 30-second resend cooldown; 5 wrong attempts invalidates the code.
pg_advisory_xact_lock on the email serialises the whole check-then-insert sequence in /request-otp and /admin-login. A plain INSERT ... SELECT ... WHERE NOT EXISTS is not race-proof under READ COMMITTED — both transactions can evaluate "not exists" against their own snapshot before either commits. The attempt counter is safe by contrast because UPDATE on an existing row genuinely serialises.
The code must never appear in an email subject or preheader — both render on phone lock screens.
Conventions
School scoping: filter by current_user["school_id"], never from a request body. Never query across schools.
RBAC: check the JWT role before any mutation.
UUIDs everywhere, uuid.uuid4().
Async throughout. Never sync SQLAlchemy.
One parent account per family with a child toggle, built from GET /parent/children. Bookings carry student_name and section; the dashboard maps a booking to a child by section. Per-student logins were tried and reverted.
No credentials in this repo, including in comments and test fixtures.
Known issues
apply_migration.py silently lies. asyncpg rejects multi-statement SQL, and the post-check is hardcoded to a meeting_notes table — so it reports success without applying anything. Migration 003 appeared to apply, didn't, and broke every test in the suite. Apply multi-statement migrations by hand, statement by statement, and verify against the schema.
SendGrid trial ends 20 Oct 2026 → 100 emails/day, not enough for a real PTM.
Frontend bundle is 630 kB in one chunk.
Nav header, logo SVG, and sign-out button are duplicated across several files. Extraction is scoped but not done.
Repo is public and its history contains seed passwords and a demo secret.
Roadmap

Next: cancellation emails (parent→teacher, teacher→parent, admin→parent with an admin opt-out), day-before reminders (needs a scheduler on the box), schedule export as a shareable image, database migration to Inventure's AWS RDS, landing/ into version control.

Later: block slot, flag non-bookers, attendance, cart flow. Primary-section requests from Meera Ma'am: section-based booking for grades 1–3, coaches linked to sports, a coordinator tab.

Not doing: booking confirmation emails, public school list, BIMI sender avatar.

School Data

Inventure Academy, Bangalore. school_id 21627bd2-7469-425a-bd2b-401e1eaccc44, slug inventure. Nine teachers: Susan Christi (English), Sandhya Chhetri (Chemistry), Anwesha Basu (Physics), Shubha S (Math), Anthony Samuel (Biology), Priya Naidu (History), Sunaina Naugain (French), Helen Gilbert (Computers), Muneezah Mattu (Theme). Slots are 7 minutes, 8:10am–2:00pm on PTM day.

Working style
Diagnose before fixing. Explain the why.
Push back on insecure or overengineered choices; don't cave to pushback alone, but don't relitigate the same point more than twice.
When told to apply something, apply it. The scratch-draft-then-discard pattern has silently lost work more than once.
Verify against the real filesystem and the real database rather than reporting from a summary.