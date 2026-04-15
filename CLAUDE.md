# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PTM Scheduler — a Parent-Teacher Meeting (PTM) scheduling app. Schools onboard via invite codes; users (parents, teachers, admins) sign up scoped to a school. Teachers create time slots; parents book them.

## Commands

### Backend
```bash
cd backend
# Activate venv first (Windows)
venv\Scripts\activate

# Run dev server
uvicorn main:app --reload

# Install dependencies
pip install -r requirements.txt   # (file doesn't exist yet — install manually and freeze)
```

Required env var in `backend/.env`:
- `DATABASE_URL` — Neon PostgreSQL connection string (postgresql://...)
- `SECRET_KEY` — JWT signing key

### Frontend
```bash
cd frontend
npm install
npm run dev      # Vite dev server
npm run build    # Production build
npm run lint     # ESLint
```

## Architecture

### Backend (`backend/`)
- **`main.py`** — FastAPI app entry point; mounts routers
- **`database.py`** — Async SQLAlchemy engine connecting to Neon. Strips query params and forces SSL. Rewrites `postgresql://` → `postgresql+asyncpg://` automatically.
- **`auth.py`** — JWT utilities (`create_access_token`, `decode_token`, `get_current_user` dependency). Tokens carry `sub` (user UUID), `role`, and `school_id`. TTL is 24 hours.
- **`routers/auth.py`** — `/auth/signup` and `/auth/login`. Signup requires an `invite_code` that maps to a school; users are scoped per school.
- **`routers/slots.py`** — `/slots` CRUD. Teachers create slots; all authenticated users in the same school can list slots. Listings join `slots → users → bookings` to include `teacher_name` and `booked_count`.

### Database (raw SQL, no ORM models)
All queries use SQLAlchemy `text()` with named parameters — there are no SQLAlchemy ORM models or migrations in the repo. Schema lives in Neon directly. Known tables: `schools`, `users`, `slots`, `bookings`.

**Multi-tenancy**: Every query scopes by `school_id` pulled from the JWT. Never query across schools.

### Frontend (`frontend/`)
React 19 + Vite + Tailwind CSS 4. Currently a skeleton (`App.jsx` renders a placeholder). No routing library yet.

## Key Conventions

- **Role-based access**: JWT `role` field (`parent`, `teacher`, `admin`) — check it in routers before mutating data.
- **UUIDs**: All primary keys are UUID strings generated with `uuid.uuid4()`.
- **Async throughout**: All DB calls are `async/await` via `AsyncSession`. Never use sync SQLAlchemy.
- **School scoping**: Always filter by `school_id` from `current_user["school_id"]`, not from request bodies.

## Key Decisions

- No Redis: use PostgreSQL `SELECT FOR UPDATE` for booking concurrency
- No Docker for MVP
- No TypeScript for MVP
- Invite code required at signup (not after)
- JWT tokens: 24hr expiry, carry `sub` (user_id), `role`, `school_id`
- All queries scoped by `school_id` from JWT

## Current State

- Phase 0 complete: repo setup, Vite+React+Tailwind frontend, FastAPI skeleton
- Phase 1 in progress: DB connected to Neon, auth working (signup/login with JWT)
- Seeded data: school "Inventure Academy" with invite_code `INVENT-2026`
- Test users: paras.mehta@gmail.com (parent, password: `test1234`), susan.christi@inventure.edu (teacher, password: `teacher123`)

## Immediate Next Task

Fix Swagger UI auth: remove `OAuth2PasswordBearer` from `routers/auth.py`, ensure only `HTTPBearer` is used. Then test `POST /slots/` with teacher token.

## Build Phases

- Phase 0 (done): repo, DB, FastAPI skeleton
- Phase 1 (in progress): auth system
- Phase 2 (next): slot creation + booking logic + `SELECT FOR UPDATE` concurrency
- Phase 3: dashboards for parent/teacher/admin roles
- Phase 4: auto-scheduler + Google Calendar integration

## School Data

Real PTM data from Inventure Academy (Bangalore). 9 teachers:
Susan Christi (English), Sandhya Chhetri (Chemistry), Anwesha Basu (Physics),
Shubha S (Math), Anthony Samuel (Biology), Priya Naidu (History),
Sunaina Naugain (French), Helen Gilbert (Computers), Muneezah Mattu (Theme)

Slots are 7 minutes each, 8:10am–2:00pm on PTM day.
