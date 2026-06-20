"""Admin endpoint coverage: teacher slots view, teacher update, slot delete."""
import asyncio
from sqlalchemy import text
from conftest import auth, seed_engine


def test_teacher_slots_states(client, seed):
    a, b, c = seed["slots"]["A"], seed["slots"]["B"], seed["slots"]["C"]
    client.post("/bookings/", json={"slot_id": a}, headers=auth(seed["tokens"]["parent"]))  # A booked
    client.post(f"/slots/{b}/block", headers=auth(seed["tokens"]["t1"]))                     # B blocked
    r = client.get(f"/admin/teachers/{seed['ids']['t1']}/slots", headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 200
    states = {s["id"]: s["state"] for s in r.json()}
    assert states[a] == "booked"
    assert states[b] == "blocked"
    assert states[c] == "free"


def test_teacher_slots_shape(client, seed):
    r = client.get(f"/admin/teachers/{seed['ids']['t1']}/slots", headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 200
    for k in ("id", "start_time", "end_time", "state", "is_booked"):
        assert k in r.json()[0]


def test_teacher_slots_non_admin_forbidden(client, seed):
    r = client.get(f"/admin/teachers/{seed['ids']['t1']}/slots", headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 403


def test_update_teacher(client, seed):
    r = client.patch(f"/admin/teachers/{seed['ids']['t1']}",
                     json={"name": "Ms. Renamed", "email": "renamed@test.edu", "subject": "Physics", "venue": "Lab 3"},
                     headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "Ms. Renamed"
    assert body["email"] == "renamed@test.edu"
    assert body["subject"] == "Physics"
    assert body["venue"] == "Lab 3"


def test_update_teacher_duplicate_email_rejected(client, seed):
    r = client.patch(f"/admin/teachers/{seed['ids']['t1']}",
                     json={"name": "X", "email": seed["emails"]["t2"]},
                     headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 400


def test_update_teacher_non_admin_forbidden(client, seed):
    r = client.patch(f"/admin/teachers/{seed['ids']['t1']}",
                     json={"name": "X", "email": "x@test.edu"},
                     headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 403


def test_delete_slot_with_booking_atomic(client, seed):
    a = seed["slots"]["A"]
    client.post("/bookings/", json={"slot_id": a}, headers=auth(seed["tokens"]["parent"]))
    r = client.delete(f"/admin/slots/{a}", headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 200
    assert r.json()["cancelled_booking"] is True

    async def _counts():
        async with seed_engine.connect() as c:
            s = (await c.execute(text("SELECT COUNT(*) FROM slots WHERE id = :i"), {"i": a})).scalar()
            b = (await c.execute(text("SELECT COUNT(*) FROM bookings WHERE slot_id = :i"), {"i": a})).scalar()
            return s, b
    slot_count, booking_count = asyncio.run(_counts())
    assert slot_count == 0           # slot removed
    assert booking_count == 0        # no orphan bookings


def test_delete_slot_free(client, seed):
    d = seed["slots"]["D"]
    r = client.delete(f"/admin/slots/{d}", headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 200
    assert r.json()["cancelled_booking"] is False


def test_delete_slot_non_admin_forbidden(client, seed):
    d = seed["slots"]["D"]
    r = client.delete(f"/admin/slots/{d}", headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 403
