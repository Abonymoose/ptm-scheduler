"""Slots endpoint coverage, including the regression-prone /slots/batch-action."""
from conftest import auth


# --- create + list -----------------------------------------------------------
def test_create_slot_teacher(client, seed):
    body = {"start_time": "2026-04-09T09:00:00+00:00", "end_time": "2026-04-09T09:07:00+00:00", "capacity": 1}
    r = client.post("/slots/", json=body, headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 200
    assert "slot_id" in r.json()


def test_create_slot_non_teacher_forbidden(client, seed):
    body = {"start_time": "2026-04-09T09:00:00+00:00", "end_time": "2026-04-09T09:07:00+00:00"}
    r = client.post("/slots/", json=body, headers=auth(seed["tokens"]["parent"]))
    assert r.status_code == 403


def test_list_slots(client, seed):
    r = client.get("/slots/", headers=auth(seed["tokens"]["parent"]))
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 6
    for k in ("id", "start_time", "end_time", "capacity", "teacher_id", "teacher_name", "booked_count", "is_blocked"):
        assert k in data[0]


def test_slots_mine_teacher(client, seed):
    r = client.get("/slots/mine", headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 4  # T1 owns A-D
    assert "bookings" in data[0]


def test_slots_mine_non_teacher_forbidden(client, seed):
    r = client.get("/slots/mine", headers=auth(seed["tokens"]["parent"]))
    assert r.status_code == 403


def test_slots_all_admin(client, seed):
    r = client.get("/slots/all", headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 6
    for k in ("subject", "venue", "teacher_email"):
        assert k in data[0]


def test_slots_all_non_admin_forbidden(client, seed):
    r = client.get("/slots/all", headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 403


# --- block / unblock ---------------------------------------------------------
def test_block_free_slot(client, seed):
    sid = seed["slots"]["A"]
    r = client.post(f"/slots/{sid}/block", headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 200


def test_block_booked_slot_rejected(client, seed):
    sid = seed["slots"]["A"]
    client.post("/bookings/", json={"slot_id": sid}, headers=auth(seed["tokens"]["parent"]))
    r = client.post(f"/slots/{sid}/block", headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 400


def test_block_non_owner_teacher_forbidden(client, seed):
    sid = seed["slots"]["A"]  # owned by t1
    r = client.post(f"/slots/{sid}/block", headers=auth(seed["tokens"]["t2"]))
    assert r.status_code == 403


def test_block_admin_allowed(client, seed):
    sid = seed["slots"]["A"]
    r = client.post(f"/slots/{sid}/block", headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 200


def test_unblock(client, seed):
    sid = seed["slots"]["A"]
    client.post(f"/slots/{sid}/block", headers=auth(seed["tokens"]["t1"]))
    r = client.post(f"/slots/{sid}/unblock", headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 200


# --- /slots/batch-action  (REGRESSED ONCE — must exist + work) ---------------
def test_batch_action_endpoint_exists(client, seed):
    r = client.post("/slots/batch-action", json={"slot_ids": [], "action": "block"},
                    headers=auth(seed["tokens"]["t1"]))
    assert r.status_code != 404, "/slots/batch-action is missing — regression!"
    assert r.status_code == 200
    assert r.json() == {"done": [], "skipped": []}


def test_batch_block(client, seed):
    ids = [seed["slots"]["A"], seed["slots"]["B"]]
    r = client.post("/slots/batch-action", json={"slot_ids": ids, "action": "block"},
                    headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 200
    body = r.json()
    assert set(body["done"]) == set(ids)
    assert body["skipped"] == []


def test_batch_block_skips_booked_and_already_blocked(client, seed):
    a, b, c = seed["slots"]["A"], seed["slots"]["B"], seed["slots"]["C"]
    client.post("/bookings/", json={"slot_id": c}, headers=auth(seed["tokens"]["parent"]))  # booked
    client.post(f"/slots/{a}/block", headers=auth(seed["tokens"]["t1"]))                     # already blocked
    r = client.post("/slots/batch-action", json={"slot_ids": [a, b, c], "action": "block"},
                    headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 200
    body = r.json()
    assert b in body["done"]
    reasons = {x["slot_id"]: x["reason"] for x in body["skipped"]}
    assert reasons.get(a) == "already_blocked"
    assert reasons.get(c) == "booked"


def test_batch_unblock(client, seed):
    a = seed["slots"]["A"]
    client.post(f"/slots/{a}/block", headers=auth(seed["tokens"]["t1"]))
    r = client.post("/slots/batch-action", json={"slot_ids": [a], "action": "unblock"},
                    headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 200
    assert a in r.json()["done"]


def test_batch_cancel_deletes_slot(client, seed):
    d = seed["slots"]["D"]
    r = client.post("/slots/batch-action", json={"slot_ids": [d], "action": "cancel"},
                    headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 200
    assert d in r.json()["done"]
    remaining = [s["id"] for s in client.get("/slots/", headers=auth(seed["tokens"]["t1"])).json()]
    assert d not in remaining


def test_batch_action_invalid_target_skipped(client, seed):
    bogus = "00000000-0000-0000-0000-000000000000"
    r = client.post("/slots/batch-action", json={"slot_ids": [bogus], "action": "block"},
                    headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 200
    reasons = {x["slot_id"]: x["reason"] for x in r.json()["skipped"]}
    assert reasons.get(bogus) == "not_found"


def test_batch_action_non_owner_teacher_skipped(client, seed):
    a = seed["slots"]["A"]  # t1's slot
    r = client.post("/slots/batch-action", json={"slot_ids": [a], "action": "block"},
                    headers=auth(seed["tokens"]["t2"]))
    assert r.status_code == 200
    reasons = {x["slot_id"]: x["reason"] for x in r.json()["skipped"]}
    assert reasons.get(a) == "forbidden"
    assert a not in r.json()["done"]


def test_batch_action_parent_forbidden(client, seed):
    a = seed["slots"]["A"]
    r = client.post("/slots/batch-action", json={"slot_ids": [a], "action": "block"},
                    headers=auth(seed["tokens"]["parent"]))
    assert r.status_code == 403


def test_batch_action_admin_allowed(client, seed):
    a = seed["slots"]["A"]
    r = client.post("/slots/batch-action", json={"slot_ids": [a], "action": "block"},
                    headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 200
    assert a in r.json()["done"]


def test_batch_action_invalid_action(client, seed):
    a = seed["slots"]["A"]
    r = client.post("/slots/batch-action", json={"slot_ids": [a], "action": "explode"},
                    headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 400
