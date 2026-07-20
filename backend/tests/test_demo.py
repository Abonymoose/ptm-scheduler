"""Demo control panel: server-side admin guard + demo login via DEMO_SECRET_CODE."""
import asyncio
import uuid
import time
from sqlalchemy import text
from conftest import auth, seed_engine
from auth import decode_token


def _teacher_slot_ids(client, seed, teacher_id):
    slots = client.get("/slots/all", headers=auth(seed["tokens"]["admin"])).json()
    return [s["id"] for s in slots if s["teacher_id"] == teacher_id]


def _seed_parent_id():
    async def _q():
        async with seed_engine.connect() as c:
            return (await c.execute(text("SELECT id FROM users WHERE email = 'seed@demo.local'"))).scalar()
    return asyncio.run(_q())


def _book(client, seed, slot="A"):
    r = client.post("/bookings/", json={"slot_id": seed["slots"][slot], "student_name": "Kid", "section": "7C"},
                    headers=auth(seed["tokens"]["parent"]))
    assert r.status_code == 200
    return r.json()["booking_id"]


# --- admin guard (server-side, on every endpoint) ----------------------------
def test_wipe_bookings_non_admin_forbidden(client, seed):
    assert client.post("/demo/wipe-bookings", headers=auth(seed["tokens"]["parent"])).status_code == 403
    assert client.post("/demo/wipe-bookings", headers=auth(seed["tokens"]["t1"])).status_code == 403


def test_reset_slots_non_admin_forbidden(client, seed):
    assert client.post("/demo/reset-slots", headers=auth(seed["tokens"]["parent"])).status_code == 403
    assert client.post("/demo/reset-slots", headers=auth(seed["tokens"]["t1"])).status_code == 403


def test_changelog_non_admin_forbidden(client, seed):
    assert client.get("/demo/changelog", headers=auth(seed["tokens"]["t1"])).status_code == 403


def test_demo_endpoints_require_auth(client, seed):
    assert client.post("/demo/wipe-bookings").status_code in (401, 403)
    assert client.get("/demo/changelog").status_code in (401, 403)


# --- wipe bookings -----------------------------------------------------------
def test_admin_wipe_bookings(client, seed):
    _book(client, seed, "A")
    _book(client, seed, "B")
    # a blocked marker too — should also be wiped
    client.post(f"/slots/{seed['slots']['C']}/block", headers=auth(seed["tokens"]["t1"]))

    r = client.post("/demo/wipe-bookings", headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 200
    assert r.json()["deleted"] >= 3

    # Afterwards no bookings remain in the school.
    allb = client.get("/bookings/all", headers=auth(seed["tokens"]["admin"])).json()
    assert len(allb) == 0
    # And slots read back with zero booked_count.
    slots = client.get("/slots/all", headers=auth(seed["tokens"]["admin"])).json()
    assert sum(s["booked_count"] for s in slots) == 0
    assert not any(s["is_blocked"] for s in slots)


# --- reset slots -------------------------------------------------------------
def test_admin_reset_slots(client, seed):
    r = client.post("/demo/reset-slots", headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 200
    body = r.json()
    assert body["teachers"] == 2                       # T1 + T2 in the seed
    assert body["slots_created"] == 2 * 45             # 45 per teacher
    slots = client.get("/slots/all", headers=auth(seed["tokens"]["admin"])).json()
    assert len(slots) == 90


# --- changelog ---------------------------------------------------------------
def test_admin_changelog(client, seed):
    r = client.get("/demo/changelog", headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 200
    body = r.json()
    assert "days" in body and "total" in body
    assert isinstance(body["days"], list)
    for day in body["days"]:
        assert "date" in day and isinstance(day["commits"], list)
        for c in day["commits"]:
            assert "hash" in c and "message" in c


def test_changelog_includes_handwritten_notes(client, seed):
    body = client.get("/demo/changelog", headers=auth(seed["tokens"]["admin"])).json()
    assert isinstance(body["notes"], list)
    # CHANGELOG_DEMO.md ships with sections; each has a heading + non-empty items.
    assert len(body["notes"]) >= 1
    for sec in body["notes"]:
        assert sec["heading"] and isinstance(sec["items"], list) and len(sec["items"]) >= 1


# --- Stage 2: add teacher / seed data / wipe seed data -----------------------
def test_demo_stage2_endpoints_non_admin_forbidden(client, seed):
    assert client.post("/demo/add-teacher", json={"name": "X", "email": "x@t.edu"}, headers=auth(seed["tokens"]["t1"])).status_code == 403
    assert client.post("/demo/seed-data", json={"teacher_id": seed["ids"]["t1"], "fill_percent": 50}, headers=auth(seed["tokens"]["parent"])).status_code == 403
    assert client.post("/demo/wipe-seed-data", headers=auth(seed["tokens"]["t1"])).status_code == 403


def test_add_teacher_creates_teacher_with_slots(client, seed):
    r = client.post("/demo/add-teacher", json={"name": "New Teacher", "email": "newteach@test.edu", "subject": "Art"},
                    headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 200
    body = r.json()
    assert body["slots_created"] == 45 and body["email"] == "newteach@test.edu"
    assert len(_teacher_slot_ids(client, seed, body["id"])) == 45


def test_add_teacher_rejects_duplicate_email(client, seed):
    r = client.post("/demo/add-teacher", json={"name": "Dup", "email": seed["emails"]["t1"]},
                    headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 400


def test_seed_data_fills_half_without_touching_real_or_blocked(client, seed):
    tid = client.post("/demo/add-teacher", json={"name": "Seed Target", "email": "seedtarget@test.edu"},
                      headers=auth(seed["tokens"]["admin"])).json()["id"]
    slot_ids = _teacher_slot_ids(client, seed, tid)
    # one REAL booking (by the real parent) and one BLOCKED slot — must be untouched.
    real_slot, blocked_slot = slot_ids[0], slot_ids[1]
    client.post("/bookings/", json={"slot_id": real_slot, "student_name": "REAL KID", "section": "7C"}, headers=auth(seed["tokens"]["parent"]))
    client.post(f"/slots/{blocked_slot}/block", headers=auth(seed["tokens"]["admin"]))

    r = client.post("/demo/seed-data", json={"teacher_id": tid, "fill_percent": 50}, headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 200
    body = r.json()
    assert body["free_before"] == 43                      # 45 - 1 booked - 1 blocked
    assert abs(body["created"] - body["free_before"] / 2) <= 1   # ~half

    sp = _seed_parent_id()

    async def _checks():
        async with seed_engine.connect() as c:
            # every seeded booking belongs to the seed parent
            seeded = (await c.execute(text(
                "SELECT COUNT(*) FROM bookings WHERE parent_id = :sp AND status='confirmed'"), {"sp": sp})).scalar()
            # the real booking is intact and NOT the seed parent
            real_ok = (await c.execute(text(
                "SELECT parent_id FROM bookings WHERE slot_id = :s AND status='confirmed'"), {"s": real_slot})).scalar()
            # blocked slot still blocked
            blocked_ok = (await c.execute(text(
                "SELECT COUNT(*) FROM bookings WHERE slot_id = :s AND status='blocked'"), {"s": blocked_slot})).scalar()
            return seeded, str(real_ok), blocked_ok
    seeded, real_parent, blocked = asyncio.run(_checks())
    assert seeded == body["created"]
    assert real_parent == seed["ids"]["parent"] and real_parent != str(sp)
    assert blocked == 1


def test_wipe_seed_data_removes_only_seed_bookings(client, seed):
    tid = client.post("/demo/add-teacher", json={"name": "Wipe Target", "email": "wipetarget@test.edu"},
                      headers=auth(seed["tokens"]["admin"])).json()["id"]
    slot_ids = _teacher_slot_ids(client, seed, tid)
    real_slot = slot_ids[0]
    client.post("/bookings/", json={"slot_id": real_slot, "student_name": "REAL", "section": "7C"}, headers=auth(seed["tokens"]["parent"]))
    seeded = client.post("/demo/seed-data", json={"teacher_id": tid, "fill_percent": 60}, headers=auth(seed["tokens"]["admin"])).json()["created"]
    assert seeded > 0

    w = client.post("/demo/wipe-seed-data", headers=auth(seed["tokens"]["admin"]))
    assert w.status_code == 200
    assert w.json()["deleted"] == seeded            # only the seeded ones

    # The real booking survives.
    async def _real():
        async with seed_engine.connect() as c:
            return (await c.execute(text(
                "SELECT COUNT(*) FROM bookings WHERE slot_id = :s AND status='confirmed'"), {"s": real_slot})).scalar()
    assert asyncio.run(_real()) == 1


# --- Stage 3: impersonation ("View as") --------------------------------------
def test_impersonate_non_admin_forbidden(client, seed):
    r = client.post("/demo/impersonate", json={"user_id": seed["ids"]["parent"]}, headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 403


def test_impersonate_teacher_and_parent_same_school(client, seed):
    for who in ("t1", "parent"):
        r = client.post("/demo/impersonate", json={"user_id": seed["ids"][who]}, headers=auth(seed["tokens"]["admin"]))
        assert r.status_code == 200, who
        body = r.json()
        assert "access_token" in body
        assert body["target_role"] == ("teacher" if who == "t1" else "parent")


def test_impersonate_admin_forbidden(client, seed):
    r = client.post("/demo/impersonate", json={"user_id": seed["ids"]["admin"]}, headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 403


def test_impersonate_different_school_forbidden(client, seed):
    # create a user in a DIFFERENT school
    other_school, other_user = str(uuid.uuid4()), str(uuid.uuid4())

    async def _mk():
        async with seed_engine.begin() as c:
            await c.execute(text("INSERT INTO schools (id, name, invite_code) VALUES (:i,'Other','OTHER-1')"), {"i": other_school})
            await c.execute(text("INSERT INTO users (id, school_id, name, email, hashed_password, role)"
                                 " VALUES (:i,:s,'Other Teacher','other@x.edu','x','teacher')"),
                            {"i": other_user, "s": other_school})
    asyncio.run(_mk())
    r = client.post("/demo/impersonate", json={"user_id": other_user}, headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 403


def test_impersonation_token_claims_and_expiry(client, seed):
    r = client.post("/demo/impersonate", json={"user_id": seed["ids"]["t1"]}, headers=auth(seed["tokens"]["admin"]))
    claims = decode_token(r.json()["access_token"])
    assert claims["sub"] == seed["ids"]["t1"]
    assert claims["role"] == "teacher"
    assert claims["impersonated_by"] == seed["ids"]["admin"]
    # ~60 min expiry (not 24h)
    ttl = claims["exp"] - int(time.time())
    assert 3400 < ttl <= 3600


def test_impersonation_token_works_on_target_endpoints(client, seed):
    token = client.post("/demo/impersonate", json={"user_id": seed["ids"]["t1"]}, headers=auth(seed["tokens"]["admin"])).json()["access_token"]
    # A teacher token can hit /slots/mine.
    r = client.get("/slots/mine", headers=auth(token))
    assert r.status_code == 200


def test_demo_users_lists_teachers_and_parents(client, seed):
    r = client.get("/demo/users", headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 200
    roles = {u["role"] for u in r.json()}
    assert roles <= {"teacher", "parent"} and "teacher" in roles and "parent" in roles
    # the admin itself must not be listed
    assert seed["ids"]["admin"] not in [u["id"] for u in r.json()]


def test_demo_users_non_admin_forbidden(client, seed):
    assert client.get("/demo/users", headers=auth(seed["tokens"]["parent"])).status_code == 403


# --- demo login (DEMO_SECRET_CODE) -------------------------------------------
def test_demo_login_correct_code(client, seed, monkeypatch):
    monkeypatch.setenv("DEMO_SECRET_CODE", "LETME6")
    r = client.post("/auth/verify-otp", json={"email": seed["emails"]["demo"], "code": "LETME6"})
    assert r.status_code == 200
    body = r.json()
    assert "access_token" in body and body["role"] == "admin"


def test_demo_login_wrong_code(client, seed, monkeypatch):
    monkeypatch.setenv("DEMO_SECRET_CODE", "LETME6")
    r = client.post("/auth/verify-otp", json={"email": seed["emails"]["demo"], "code": "NOPE99"})
    assert r.status_code == 400


def test_demo_login_disabled_when_secret_unset(client, seed, monkeypatch):
    # No DEMO_SECRET_CODE → demo path off → falls back to normal OTP (no otp row → 400).
    monkeypatch.delenv("DEMO_SECRET_CODE", raising=False)
    r = client.post("/auth/verify-otp", json={"email": seed["emails"]["demo"], "code": "LETME6"})
    assert r.status_code == 400


def test_demo_secret_does_not_affect_other_emails(client, seed, monkeypatch):
    # A normal user still uses the otps table even when the demo secret is set.
    monkeypatch.setenv("DEMO_SECRET_CODE", "LETME6")
    client.post("/auth/request-otp", json={"email": seed["emails"]["parent"]})
    ok = client.post("/auth/verify-otp", json={"email": seed["emails"]["parent"], "code": "000000"})
    assert ok.status_code == 200 and ok.json()["role"] == "parent"
    # The demo secret must NOT log a normal user in.
    bad = client.post("/auth/verify-otp", json={"email": seed["emails"]["parent"], "code": "LETME6"})
    assert bad.status_code == 400
