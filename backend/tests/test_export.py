"""Schedule export coverage: own-data scoping (parent/teacher) and the two
new admin export endpoints (role + cross-school guards)."""
import asyncio
import uuid
from sqlalchemy import text
from conftest import auth, seed_engine


def test_parent_bookings_scoped_to_self(client, seed):
    a, e = seed["slots"]["A"], seed["slots"]["E"]
    client.post("/bookings/", json={"slot_id": a}, headers=auth(seed["tokens"]["parent"]))
    client.post("/bookings/", json={"slot_id": e}, headers=auth(seed["tokens"]["parent2"]))

    r = client.get("/bookings/", headers=auth(seed["tokens"]["parent"]))
    assert r.status_code == 200
    slot_ids = {b["slot_id"] for b in r.json()}
    assert slot_ids == {a}


def test_my_bookings_include_export_fields(client, seed):
    a = seed["slots"]["A"]
    client.post("/bookings/", json={"slot_id": a}, headers=auth(seed["tokens"]["parent"]))
    r = client.get("/bookings/", headers=auth(seed["tokens"]["parent"]))
    body = r.json()[0]
    for k in ("teacher_subject", "room", "room_location"):
        assert k in body


def test_teacher_slots_scoped_to_self(client, seed):
    r1 = client.get("/slots/mine", headers=auth(seed["tokens"]["t1"]))
    r2 = client.get("/slots/mine", headers=auth(seed["tokens"]["t2"]))
    ids1 = {s["id"] for s in r1.json()}
    ids2 = {s["id"] for s in r2.json()}
    assert ids1.isdisjoint(ids2)
    assert seed["slots"]["A"] in ids1
    assert seed["slots"]["E"] in ids2


def test_admin_teacher_export_shape(client, seed):
    r = client.get(f"/admin/teachers/{seed['ids']['t1']}/export", headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 200
    body = r.json()
    for k in ("id", "name", "subject", "room", "room_location", "slots"):
        assert k in body
    assert body["name"] == "Ms. Teacher One"
    assert {s["id"] for s in body["slots"]} == {
        seed["slots"]["A"], seed["slots"]["B"], seed["slots"]["C"], seed["slots"]["D"],
    }


def test_admin_parent_export_shape(client, seed):
    a = seed["slots"]["A"]
    client.post("/bookings/", json={"slot_id": a}, headers=auth(seed["tokens"]["parent"]))
    r = client.get(f"/admin/parents/{seed['ids']['parent']}/export", headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 200
    body = r.json()
    for k in ("id", "name", "parent_name", "grade", "section", "bookings"):
        assert k in body
    assert len(body["bookings"]) == 1
    for k in ("teacher_name", "teacher_subject", "room", "room_location", "start_time", "end_time"):
        assert k in body["bookings"][0]


def test_admin_export_endpoints_non_admin_forbidden(client, seed):
    for path in (f"/admin/teachers/{seed['ids']['t1']}/export", f"/admin/parents/{seed['ids']['parent']}/export"):
        r_parent = client.get(path, headers=auth(seed["tokens"]["parent"]))
        assert r_parent.status_code == 403
        r_teacher = client.get(path, headers=auth(seed["tokens"]["t1"]))
        assert r_teacher.status_code == 403


def _make_other_school_admin():
    """A second school with its own admin, for cross-school 403 checks."""
    other_school, other_admin = str(uuid.uuid4()), str(uuid.uuid4())

    async def _mk():
        async with seed_engine.begin() as c:
            await c.execute(
                text("INSERT INTO schools (id, name, invite_code, slug) VALUES (:i,'Other','OTHER-EXPORT','other-export')"),
                {"i": other_school},
            )
            await c.execute(
                text("INSERT INTO users (id, school_id, name, email, hashed_password, role)"
                     " VALUES (:i,:s,'Other Admin','other-admin@x.edu','x','admin')"),
                {"i": other_admin, "s": other_school},
            )
    asyncio.run(_mk())
    from auth import create_access_token
    token = create_access_token({"sub": other_admin, "role": "admin", "school_id": other_school, "name": "Other Admin"})
    return token


def test_admin_teacher_export_cross_school_forbidden(client, seed):
    other_admin_token = _make_other_school_admin()
    r = client.get(f"/admin/teachers/{seed['ids']['t1']}/export", headers=auth(other_admin_token))
    assert r.status_code == 403


def test_admin_parent_export_cross_school_forbidden(client, seed):
    other_admin_token = _make_other_school_admin()
    r = client.get(f"/admin/parents/{seed['ids']['parent']}/export", headers=auth(other_admin_token))
    assert r.status_code == 403


def test_admin_export_endpoints_not_found(client, seed):
    missing = str(uuid.uuid4())
    r = client.get(f"/admin/teachers/{missing}/export", headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 404
    r = client.get(f"/admin/parents/{missing}/export", headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 404


def test_room_fields_roundtrip_through_update_teacher(client, seed):
    r = client.patch(
        f"/admin/teachers/{seed['ids']['t1']}",
        json={"name": "Ms. Teacher One", "email": seed["emails"]["t1"], "subject": "Math",
              "venue": "Room 1", "room": "7A", "room_location": "Middle School · 1st floor"},
        headers=auth(seed["tokens"]["admin"]),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["room"] == "7A"
    assert body["room_location"] == "Middle School · 1st floor"

    r = client.get(f"/admin/teachers/{seed['ids']['t1']}/export", headers=auth(seed["tokens"]["admin"]))
    body = r.json()
    assert body["room"] == "7A"
    assert body["room_location"] == "Middle School · 1st floor"
