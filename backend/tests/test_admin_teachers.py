"""POST /admin/teachers — teacher provisioning that works with demo routes off."""
import asyncio
import uuid

import pytest
from sqlalchemy import text

from conftest import auth, seed_engine, hash_password
from auth import create_access_token


def _row(sql, params):
    async def _q():
        async with seed_engine.connect() as c:
            return (await c.execute(text(sql), params)).fetchone()
    return asyncio.run(_q())


def _other_school():
    sid, admin = str(uuid.uuid4()), str(uuid.uuid4())

    async def _go():
        async with seed_engine.begin() as c:
            await c.execute(text("INSERT INTO schools (id, name, invite_code, slug) VALUES (:id, 'School B', 'B-1', 'school-b')"),
                            {"id": sid})
            await c.execute(text("INSERT INTO users (id, school_id, name, email, hashed_password, role)"
                                 " VALUES (:id, :sid, 'B Admin', 'admin@b.edu', :p, CAST('admin' AS user_role))"),
                            {"id": admin, "sid": sid, "p": hash_password("unused-pw")})
    asyncio.run(_go())
    return {"school": sid, "token": create_access_token({"sub": admin, "role": "admin", "school_id": sid, "name": "B Admin"})}


def test_admin_creates_teacher_201_with_grid(client, seed, monkeypatch):
    monkeypatch.delenv("DEMO_ENABLED", raising=False)   # must work with demo routes off
    r = client.post("/admin/teachers", json={"name": "Ms. New Teacher", "email": " New.Teacher@Test.edu ", "subject": "Art"},
                    headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 201
    body = r.json()
    assert body["email"] == "new.teacher@test.edu" and body["slots_created"] == 45

    row = _row("SELECT school_id, role, subject FROM users WHERE id = :id", {"id": body["id"]})
    assert (str(row.school_id), row.role, row.subject) == (seed["school_id"], "teacher", "Art")
    n = _row("SELECT count(*) AS n FROM slots WHERE teacher_id = :id AND school_id = :sid",
             {"id": body["id"], "sid": seed["school_id"]}).n
    assert n == 45


@pytest.mark.parametrize("who", ["t1", "parent"])
def test_non_admin_403(client, seed, who):
    r = client.post("/admin/teachers", json={"name": "X", "email": "x@test.edu"}, headers=auth(seed["tokens"][who]))
    assert r.status_code == 403
    assert _row("SELECT 1 FROM users WHERE email = 'x@test.edu'", {}) is None


def test_requires_auth(client, seed):
    assert client.post("/admin/teachers", json={"name": "X", "email": "x@test.edu"}).status_code == 401


def test_school_comes_from_token_not_body(client, seed):
    """A school_id smuggled into the body is ignored; the teacher lands in the
    caller's own school."""
    other = _other_school()
    r = client.post("/admin/teachers",
                    json={"name": "Sneaky", "email": "sneaky@test.edu", "school_id": other["school"]},
                    headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 201
    row = _row("SELECT school_id FROM users WHERE id = :id", {"id": r.json()["id"]})
    assert str(row.school_id) == seed["school_id"]
    assert _row("SELECT 1 FROM slots WHERE teacher_id = :id AND school_id = :sid",
                {"id": r.json()["id"], "sid": other["school"]}) is None


def test_other_school_admin_creates_in_their_own_school(client, seed):
    other = _other_school()
    r = client.post("/admin/teachers", json={"name": "B Teacher", "email": "bt@b.edu"}, headers=auth(other["token"]))
    assert r.status_code == 201
    assert str(_row("SELECT school_id FROM users WHERE id = :id", {"id": r.json()["id"]}).school_id) == other["school"]


def test_duplicate_email_same_school_409(client, seed):
    r = client.post("/admin/teachers", json={"name": "Dup", "email": seed["emails"]["t1"].upper()},
                    headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 409


def test_duplicate_email_other_school_409(client, seed):
    """Login looks users up by email alone, so an address may exist only once
    across all schools — and the message doesn't reveal where it's used."""
    other = _other_school()
    r = client.post("/admin/teachers", json={"name": "Dup", "email": seed["emails"]["t1"]}, headers=auth(other["token"]))
    assert r.status_code == 409
    assert "test" not in r.json()["detail"].lower()


def test_blank_name_or_email_400(client, seed):
    r = client.post("/admin/teachers", json={"name": "  ", "email": "ok@test.edu"}, headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 400
