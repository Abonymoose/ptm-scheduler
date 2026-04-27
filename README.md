# PTM Scheduler

A Parent-Teacher Meeting scheduling app for schools. Schools onboard via invite codes; parents book 7-minute slots with teachers; admins oversee everything.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, inline styles |
| Backend | FastAPI, SQLAlchemy 2 (async), asyncpg |
| Database | PostgreSQL via Neon (serverless) |
| Auth | JWT (python-jose), bcrypt passwords |

## Running Locally

### Backend

```bash
cd backend

# 1. Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL and SECRET_KEY

# 4. Start the dev server
uvicorn main:app --reload
# Runs at http://localhost:8000
# Swagger docs at http://localhost:8000/docs
```

### Frontend

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env if your backend runs somewhere other than localhost:8000

# 3. Start the dev server
npm run dev
# Runs at http://localhost:5173
```

## Environment Variables

### `backend/.env`

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (e.g. from Neon). Must start with `postgresql://`. |
| `SECRET_KEY` | Yes | Random secret for signing JWTs. Generate with: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `FRONTEND_URL` | No | Deployed frontend URL added to CORS allowlist. Defaults to `http://localhost:5173`. |

### `frontend/.env`

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | No | Backend API base URL. Defaults to `http://localhost:8000`. |

## Seeding the Database

To seed teachers and time slots for Inventure Academy:

```bash
cd backend
venv\Scripts\activate
python seed.py
```

Requires `INVENT-2026` school to exist in the DB (created separately via a one-time SQL insert).

## Features

| Feature | Status |
|---|---|
| School invite-code signup | Done |
| JWT auth (login/logout) | Done |
| Teacher: create time slots | Done |
| Teacher: view own schedule + booked parents | Done |
| Parent: grid view of all slots | Done |
| Parent: book a slot (SELECT FOR UPDATE concurrency) | Done |
| Parent: cancel a booking | Done |
| Admin: overview of all teachers + fill rates | Done |
| Admin: view all bookings, search by name | Done |
| Admin: copy school invite code | Done |
| Auto-scheduler (AI-assisted booking) | Phase 4 |
| Google Calendar integration | Phase 4 |

## Project Structure

```
ptm-scheduler/
├── backend/
│   ├── main.py           # FastAPI app, CORS, router mounts
│   ├── auth.py           # JWT utilities, password hashing, get_current_user
│   ├── database.py       # Async SQLAlchemy engine (Neon/PostgreSQL)
│   ├── seed.py           # One-time seed script for teachers + slots
│   ├── requirements.txt
│   ├── .env.example
│   └── routers/
│       ├── auth.py       # POST /auth/signup, POST /auth/login
│       ├── slots.py      # GET/POST /slots/, GET /slots/mine, GET /slots/all
│       └── bookings.py   # POST/GET /bookings/, DELETE /bookings/{id}, GET /bookings/all
└── frontend/
    ├── src/
    │   ├── api/          # axios wrappers (auth, slots, bookings)
    │   ├── context/      # AuthContext (JWT decode, login/logout)
    │   └── pages/
    │       ├── ParentDashboard.jsx
    │       ├── TeacherDashboard.jsx
    │       └── AdminDashboard.jsx
    └── .env.example
```
