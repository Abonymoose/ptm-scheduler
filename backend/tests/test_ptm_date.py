"""Per-school configurable PTM date: GET/PATCH /admin/ptm-date, the in-place
slot shift (preserving time of day), booking survival, and that slot-generating
endpoints (reset-slots, add-teacher) honour the school's date."""
import asyncio
from sqlalchemy import text
from conftest import auth, seed_engine, SCHOOL_ID


def _rows(sql, params=None):
    async def go():
        async with seed_engine.connect() as c:
            return (await c.execute(text(sql), params or {})).fetchall()
    return asyncio.run(go())


def test_get_ptm_date_default(client, seed):
    r = client.get("/admin/ptm-date", headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 200
    assert r.json()["ptm_date"] == "2026-04-09"


def test_get_ptm_date_non_admin_forbidden(client, seed):
    r = client.get("/admin/ptm-date", headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 403


def test_patch_non_admin_forbidden(client, seed):
    r = client.patch("/admin/ptm-date", json={"ptm_date": "2026-05-20"},
                     headers=auth(seed["tokens"]["parent"]))
    assert r.status_code == 403


def test_patch_shifts_all_slots_preserving_time_of_day(client, seed):
    # Capture the original (label -> HH:MM) before shifting.
    before = _rows("SELECT id, start_time, end_time FROM slots WHERE school_id = :sid", {"sid": SCHOOL_ID})
    before_times = {str(r.id): (r.start_time.hour, r.start_time.minute,
                                r.end_time.hour, r.end_time.minute) for r in before}
    assert len(before_times) == 6

    r = client.patch("/admin/ptm-date", json={"ptm_date": "2026-05-20"},
                     headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 200
    body = r.json()
    assert body["ptm_date"] == "2026-05-20"
    assert body["slots_shifted"] == 6

    after = _rows("SELECT id, start_time, end_time FROM slots WHERE school_id = :sid", {"sid": SCHOOL_ID})
    assert len(after) == 6  # no slots deleted or created
    for row in after:
        # date moved…
        assert row.start_time.date().isoformat() == "2026-05-20"
        assert row.end_time.date().isoformat() == "2026-05-20"
        # …but time of day preserved exactly, per-slot.
        assert (row.start_time.hour, row.start_time.minute,
                row.end_time.hour, row.end_time.minute) == before_times[str(row.id)]

    # And the school row reflects the new date.
    assert client.get("/admin/ptm-date", headers=auth(seed["tokens"]["admin"])).json()["ptm_date"] == "2026-05-20"


def test_patch_same_date_is_noop(client, seed):
    r = client.patch("/admin/ptm-date", json={"ptm_date": "2026-04-09"},
                     headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 200
    assert r.json()["slots_shifted"] == 0


def test_booking_survives_shift_and_reflects_new_date(client, seed):
    slot_a = seed["slots"]["A"]
    bk = client.post("/bookings/", json={"slot_id": slot_a}, headers=auth(seed["tokens"]["parent"]))
    assert bk.status_code in (200, 201)

    # Count bookings on this slot before + after — must be identical (not orphaned/duplicated).
    n_before = _rows("SELECT id FROM bookings WHERE slot_id = :sid", {"sid": slot_a})

    client.patch("/admin/ptm-date", json={"ptm_date": "2026-05-20"},
                 headers=auth(seed["tokens"]["admin"]))

    n_after = _rows("SELECT id, status FROM bookings WHERE slot_id = :sid", {"sid": slot_a})
    assert len(n_after) == len(n_before) == 1  # still exactly one booking, same slot
    assert n_after[0].status == "confirmed"

    # The booking still points to slot A, and slot A is now on the new date.
    slot = _rows("SELECT start_time FROM slots WHERE id = :sid", {"sid": slot_a})[0]
    assert slot.start_time.date().isoformat() == "2026-05-20"
    # Time of day intact (seed A starts 08:10).
    assert (slot.start_time.hour, slot.start_time.minute) == (8, 10)


def test_reset_slots_uses_school_ptm_date(client, seed):
    client.patch("/admin/ptm-date", json={"ptm_date": "2026-05-20"},
                 headers=auth(seed["tokens"]["admin"]))
    r = client.post("/demo/reset-slots", headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 200
    rows = _rows("SELECT DISTINCT start_time::date AS d FROM slots WHERE school_id = :sid", {"sid": SCHOOL_ID})
    dates = {str(row.d) for row in rows}
    assert dates == {"2026-05-20"}


def test_add_teacher_uses_school_ptm_date(client, seed):
    client.patch("/admin/ptm-date", json={"ptm_date": "2026-05-20"},
                 headers=auth(seed["tokens"]["admin"]))
    r = client.post("/demo/add-teacher", json={"name": "New Teacher", "email": "newt@test.edu"},
                    headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 200
    tid = r.json()["id"]
    rows = _rows("SELECT DISTINCT start_time::date AS d FROM slots WHERE teacher_id = :tid", {"tid": tid})
    dates = {str(row.d) for row in rows}
    assert dates == {"2026-05-20"}
