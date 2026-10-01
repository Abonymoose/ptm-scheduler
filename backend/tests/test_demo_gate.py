"""The /demo router gate: DEMO_ENABLED kill switch, DEMO_ADMIN_EMAILS
allowlist, role checks, and school scoping of the destructive routes."""
import asyncio
import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import text

from conftest import auth, seed_engine, hash_password
from auth import create_access_token
from routers.demo import router as demo_router


def _demo_routes():
    """Every (method, path) on the demo router — read from the router itself,
    so a newly added route is covered without editing this file."""
    return [(m, r.path) for r in demo_router.routes for m in r.methods if m != "HEAD"]


def _call(client, method, path, token=None):
    headers = auth(token) if token else {}
    return client.request(method, path, json={}, headers=headers)


def _demo_admin_token(seed):
    return create_access_token({"sub": seed["ids"]["demo"], "role": "admin",
                                "school_id": seed["school_id"], "name": "Demo Admin"})


def test_router_has_routes():
    assert len(_demo_routes()) >= 10   # guards the parametrised tests below against an empty list


# --- kill switch -------------------------------------------------------------
@pytest.mark.parametrize("value", [None, "", "false", "0", "yes"])
def test_disabled_every_route_404_even_for_allowlisted_admin(client, seed, monkeypatch, value):
    if value is None:
        monkeypatch.delenv("DEMO_ENABLED", raising=False)
    else:
        monkeypatch.setenv("DEMO_ENABLED", value)
    monkeypatch.setenv("DEMO_ADMIN_EMAILS", "admin@test.edu")
    for method, path in _demo_routes():
        r = _call(client, method, path, seed["tokens"]["admin"])
        assert r.status_code == 404, (method, path, r.status_code)
        assert r.json() == {"detail": "Not Found"}


def test_disabled_404_without_any_token(client, seed, monkeypatch):
    monkeypatch.delenv("DEMO_ENABLED", raising=False)
    for method, path in _demo_routes():
        assert _call(client, method, path).status_code == 404, (method, path)


def test_disabled_routes_absent_from_openapi(client, seed):
    paths = client.get("/openapi.json").json()["paths"]
    assert not [p for p in paths if p.startswith("/demo")]


# --- allowlist + roles (enabled) ---------------------------------------------
def test_enabled_no_token_401(client, seed, demo_on):
    for method, path in _demo_routes():
        assert _call(client, method, path).status_code == 401, (method, path)


def test_enabled_admin_not_on_allowlist_403(client, seed, demo_on):
    token = _demo_admin_token(seed)   # a real admin of the same school, not allowlisted
    for method, path in _demo_routes():
        assert _call(client, method, path, token).status_code == 403, (method, path)


def test_enabled_empty_allowlist_403(client, seed, monkeypatch):
    monkeypatch.setenv("DEMO_ENABLED", "true")
    monkeypatch.delenv("DEMO_ADMIN_EMAILS", raising=False)
    assert _call(client, "GET", "/demo/status", seed["tokens"]["admin"]).status_code == 403


@pytest.mark.parametrize("who", ["parent", "t1"])
def test_enabled_parent_and_teacher_403(client, seed, demo_on, who):
    for method, path in _demo_routes():
        assert _call(client, method, path, seed["tokens"][who]).status_code == 403, (method, path)


def test_enabled_allowlisted_admin_works(client, seed, demo_on):
    r = client.get("/demo/status", headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 200 and r.json() == {"enabled": True}
    assert client.get("/demo/users", headers=auth(seed["tokens"]["admin"])).status_code == 200
    assert client.post("/demo/wipe-bookings", headers=auth(seed["tokens"]["admin"])).status_code == 200


def test_allowlist_is_case_insensitive_and_trimmed(client, seed, monkeypatch):
    monkeypatch.setenv("DEMO_ENABLED", " TRUE ")
    monkeypatch.setenv("DEMO_ADMIN_EMAILS", " someone@else.org ,  ADMIN@Test.EDU  ,")
    assert client.get("/demo/status", headers=auth(seed["tokens"]["admin"])).status_code == 200


def test_allowlist_matches_db_email_not_token_claims(client, seed, demo_on):
    """A token whose sub is allowlisted but whose school_id is wrong doesn't pass:
    the email is looked up by (sub, school_id)."""
    forged = create_access_token({"sub": seed["ids"]["admin"], "role": "admin",
                                  "school_id": str(uuid.uuid4()), "name": "x"})
    assert client.get("/demo/status", headers=auth(forged)).status_code == 403


# --- school scoping of destructive routes ------------------------------------
def _other_school_with_booking():
    """School B with an admin, teacher, slot, a real booking and a seed-parent
    booking. Returns ids plus a token for B's admin."""
    sid, admin, teacher, parent, seed_parent, slot, slot2, b1, b2 = (str(uuid.uuid4()) for _ in range(9))
    start = datetime(2026, 4, 9, 9, 0, tzinfo=timezone.utc)
    end = datetime(2026, 4, 9, 9, 7, tzinfo=timezone.utc)
    pwd = hash_password("unused-pw")

    async def _go():
        async with seed_engine.begin() as c:
            await c.execute(text("INSERT INTO schools (id, name, invite_code, slug) VALUES (:id, 'School B', 'B-1', 'school-b')"), {"id": sid})
            for uid, name, email, role in ((admin, "B Admin", "admin@b.edu", "admin"),
                                           (teacher, "B Teacher", "t@b.edu", "teacher"),
                                           (parent, "B Parent", "p@b.edu", "parent"),
                                           (seed_parent, "Demo Seed", "seed@demo.local", "parent")):
                await c.execute(text("INSERT INTO users (id, school_id, name, email, hashed_password, role)"
                                     " VALUES (:id, :sid, :n, :e, :p, CAST(:r AS user_role))"),
                                {"id": uid, "sid": sid, "n": name, "e": email, "p": pwd, "r": role})
            for s_id in (slot, slot2):
                await c.execute(text("INSERT INTO slots (id, teacher_id, school_id, start_time, end_time, capacity)"
                                     " VALUES (:id, :t, :sid, :s, :e, 1)"),
                                {"id": s_id, "t": teacher, "sid": sid, "s": start, "e": end})
            await c.execute(text("INSERT INTO bookings (id, slot_id, parent_id, status, student_name, section)"
                                 " VALUES (:id, :s, :p, 'confirmed', 'B Kid', '5A')"), {"id": b1, "s": slot, "p": parent})
            await c.execute(text("INSERT INTO bookings (id, slot_id, parent_id, status, student_name, section)"
                                 " VALUES (:id, :s, :p, 'confirmed', 'B Seed Kid', '5A')"), {"id": b2, "s": slot2, "p": seed_parent})
    asyncio.run(_go())
    return {"school": sid, "slots": {slot, slot2}, "bookings": {b1, b2}}


def _rows(sql, params):
    async def _q():
        async with seed_engine.connect() as c:
            return {str(r[0]) for r in (await c.execute(text(sql), params)).fetchall()}
    return asyncio.run(_q())


@pytest.fixture
def both_admins_allowlisted(monkeypatch):
    monkeypatch.setenv("DEMO_ENABLED", "true")
    monkeypatch.setenv("DEMO_ADMIN_EMAILS", "admin@test.edu,admin@b.edu")


@pytest.mark.parametrize("path", ["/demo/wipe-bookings", "/demo/reset-slots", "/demo/wipe-seed-data"])
def test_destructive_routes_leave_other_school_untouched(client, seed, both_admins_allowlisted, path):
    b = _other_school_with_booking()
    # school A has its own booking too, so the route has something to do
    r = client.post("/bookings/", json={"slot_id": seed["slots"]["A"], "student_name": "Kid", "section": "7C"},
                    headers=auth(seed["tokens"]["parent"]))
    assert r.status_code == 200

    assert client.post(path, headers=auth(seed["tokens"]["admin"])).status_code == 200

    assert _rows("SELECT id FROM bookings WHERE slot_id IN (SELECT id FROM slots WHERE school_id = :sid)",
                 {"sid": b["school"]}) == b["bookings"]
    assert _rows("SELECT id FROM slots WHERE school_id = :sid", {"sid": b["school"]}) == b["slots"]


def test_wipe_bookings_clears_own_school(client, seed, both_admins_allowlisted):
    _other_school_with_booking()
    client.post("/bookings/", json={"slot_id": seed["slots"]["A"], "student_name": "Kid", "section": "7C"},
                headers=auth(seed["tokens"]["parent"]))
    client.post("/demo/wipe-bookings", headers=auth(seed["tokens"]["admin"]))
    assert _rows("SELECT id FROM bookings WHERE slot_id IN (SELECT id FROM slots WHERE school_id = :sid)",
                 {"sid": seed["school_id"]}) == set()
