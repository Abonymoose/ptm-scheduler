from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from database import get_db
from routers import auth, slots, bookings, admin, notes
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI()

_frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
_allowed_origins = list({_frontend_url, "https://ptmnow.com", "https://www.ptmnow.com", "http://localhost:5173"})

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

app.include_router(auth.router)
app.include_router(slots.router)
app.include_router(bookings.router)
app.include_router(admin.router)
app.include_router(notes.router)

@app.get("/")
async def health_check():
    return {"status": "ok"}

@app.get("/db-test")
async def db_test(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT COUNT(*) FROM schools"))
    count = result.scalar()
    return {"schools_in_db": count}