"""Bookings endpoint coverage: create, cancel, batch cart, auto-schedule, attendance."""
from conftest import auth


# --- create_booking ----------------------------------------------------------
def test_create_booking_success(client, seed):
    a = seed["slots"]["A"]
    r = client.post("/bookings/", json={"slot_id": a, "student_name": "Kid", "section": "5A"},
                    headers=auth(seed["tokens"]["parent"]))
    assert r.status_code == 200
    assert "booking_id" in r.json()


def test_create_booking_non_parent_forbidden(client, seed):
    a = seed["slots"]["A"]
    r = client.post("/bookings/", json={"slot_id": a}, headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 403


def test_double_book_rejected(client, seed):
    a = seed["slots"]["A"]
    client.post("/bookings/", json={"slot_id": a}, headers=auth(seed["tokens"]["parent"]))
    r = client.post("/bookings/", json={"slot_id": a}, headers=auth(seed["tokens"]["parent"]))
    assert r.status_code == 400


def test_full_slot_rejected(client, seed):
    a = seed["slots"]["A"]
    client.post("/bookings/", json={"slot_id": a}, headers=auth(seed["tokens"]["parent"]))
    r = client.post("/bookings/", json={"slot_id": a}, headers=auth(seed["tokens"]["parent2"]))
    assert r.status_code == 400  # capacity 1 → full


def test_blocked_slot_rejected(client, seed):
    d = seed["slots"]["D"]
    client.post(f"/slots/{d}/block", headers=auth(seed["tokens"]["t1"]))
    r = client.post("/bookings/", json={"slot_id": d}, headers=auth(seed["tokens"]["parent"]))
    assert r.status_code == 400


def test_time_overlap_same_parent_rejected(client, seed):
    a, e = seed["slots"]["A"], seed["slots"]["E"]  # overlapping times, different teachers
    client.post("/bookings/", json={"slot_id": a}, headers=auth(seed["tokens"]["parent"]))
    r = client.post("/bookings/", json={"slot_id": e}, headers=auth(seed["tokens"]["parent"]))
    assert r.status_code == 400


def test_create_booking_saves_fields(client, seed):
    a = seed["slots"]["A"]
    client.post("/bookings/", json={"slot_id": a, "student_name": "Kiddo", "section": "5A"},
                headers=auth(seed["tokens"]["parent"]))
    mine = client.get("/bookings/", headers=auth(seed["tokens"]["parent"])).json()
    assert any(b["student_name"] == "Kiddo" and b["section"] == "5A" for b in mine)


# --- cancel ------------------------------------------------------------------
def test_cancel_frees_slot_not_delete(client, seed):
    a = seed["slots"]["A"]
    bid = client.post("/bookings/", json={"slot_id": a}, headers=auth(seed["tokens"]["parent"])).json()["booking_id"]
    r = client.delete(f"/bookings/{bid}", headers=auth(seed["tokens"]["parent"]))
    assert r.status_code == 200
    slots = client.get("/slots/", headers=auth(seed["tokens"]["parent"])).json()
    slot = next(s for s in slots if s["id"] == a)
    assert slot["booked_count"] == 0           # freed
    r2 = client.post("/bookings/", json={"slot_id": a}, headers=auth(seed["tokens"]["parent"]))
    assert r2.status_code == 200               # and re-bookable


# --- batch (cart) ------------------------------------------------------------
def test_batch_all_free(client, seed):
    a, b = seed["slots"]["A"], seed["slots"]["B"]
    r = client.post("/bookings/batch", json={"items": [{"slot_id": a}, {"slot_id": b}]},
                    headers=auth(seed["tokens"]["parent"]))
    assert r.status_code == 200
    body = r.json()
    assert len(body["booked"]) == 2 and body["failed"] == []


def test_batch_partial_one_pretaken(client, seed):
    a, b = seed["slots"]["A"], seed["slots"]["B"]
    client.post("/bookings/", json={"slot_id": b}, headers=auth(seed["tokens"]["parent2"]))  # B taken
    r = client.post("/bookings/batch", json={"items": [{"slot_id": a}, {"slot_id": b}]},
                    headers=auth(seed["tokens"]["parent"]))
    assert r.status_code == 200
    body = r.json()
    assert [x["slot_id"] for x in body["booked"]] == [a]
    assert any(f["slot_id"] == b for f in body["failed"])


def test_batch_non_parent_forbidden(client, seed):
    a = seed["slots"]["A"]
    r = client.post("/bookings/batch", json={"items": [{"slot_id": a}]}, headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 403


# --- auto-schedule -----------------------------------------------------------
def test_auto_schedule_dry_run_no_write(client, seed):
    r = client.post("/bookings/auto-schedule",
                    json={"teacher_ids": [seed["ids"]["t1"], seed["ids"]["t2"]], "dry_run": True},
                    headers=auth(seed["tokens"]["parent"]))
    assert r.status_code == 200
    body = r.json()
    assert "picks" in body and len(body["picks"]) == 2
    assert client.get("/bookings/", headers=auth(seed["tokens"]["parent"])).json() == []


def test_auto_schedule_writes(client, seed):
    r = client.post("/bookings/auto-schedule",
                    json={"teacher_ids": [seed["ids"]["t1"], seed["ids"]["t2"]]},
                    headers=auth(seed["tokens"]["parent"]))
    assert r.status_code == 200
    body = r.json()
    assert "booked" in body and len(body["booked"]) == 2
    assert len(client.get("/bookings/", headers=auth(seed["tokens"]["parent"])).json()) == 2


def test_auto_schedule_non_parent_forbidden(client, seed):
    r = client.post("/bookings/auto-schedule", json={"teacher_ids": [seed["ids"]["t1"]]},
                    headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 403


# --- attendance --------------------------------------------------------------
def _book_a(client, seed):
    a = seed["slots"]["A"]
    return client.post("/bookings/", json={"slot_id": a}, headers=auth(seed["tokens"]["parent"])).json()["booking_id"]


def test_attendance_valid(client, seed):
    bid = _book_a(client, seed)
    r = client.patch(f"/bookings/{bid}/attendance", json={"attendance": ["Mother"]},
                     headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 200 and r.json()["attendance"] == ["Mother"]


def test_attendance_invalid_value(client, seed):
    bid = _book_a(client, seed)
    r = client.patch(f"/bookings/{bid}/attendance", json={"attendance": ["Alien"]},
                     headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 400


def test_attendance_non_owner_forbidden(client, seed):
    bid = _book_a(client, seed)
    r = client.patch(f"/bookings/{bid}/attendance", json={"attendance": ["Mother"]},
                     headers=auth(seed["tokens"]["t2"]))
    assert r.status_code == 403


def test_attendance_confirmed_only(client, seed):
    bid = _book_a(client, seed)
    client.delete(f"/bookings/{bid}", headers=auth(seed["tokens"]["parent"]))  # cancel it
    r = client.patch(f"/bookings/{bid}/attendance", json={"attendance": ["Mother"]},
                     headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 400


def test_attendance_clear(client, seed):
    bid = _book_a(client, seed)
    client.patch(f"/bookings/{bid}/attendance", json={"attendance": ["Mother"]}, headers=auth(seed["tokens"]["t1"]))
    r = client.patch(f"/bookings/{bid}/attendance", json={"attendance": []}, headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 200 and r.json()["attendance"] == []


# --- listing endpoints -------------------------------------------------------
def test_get_all_bookings_admin(client, seed):
    a = seed["slots"]["A"]
    client.post("/bookings/", json={"slot_id": a, "student_name": "Kid"}, headers=auth(seed["tokens"]["parent"]))
    r = client.get("/bookings/all", headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1
    for k in ("id", "status", "student_name", "teacher_name", "start_time"):
        assert k in data[0]


def test_get_all_bookings_non_admin_forbidden(client, seed):
    r = client.get("/bookings/all", headers=auth(seed["tokens"]["parent"]))
    assert r.status_code == 403


def test_get_my_bookings(client, seed):
    a = seed["slots"]["A"]
    client.post("/bookings/", json={"slot_id": a}, headers=auth(seed["tokens"]["parent"]))
    r = client.get("/bookings/", headers=auth(seed["tokens"]["parent"]))
    assert r.status_code == 200
    assert len(r.json()) == 1
