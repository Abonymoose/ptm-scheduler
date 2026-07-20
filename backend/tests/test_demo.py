"""Demo control panel: server-side admin guard + demo login via DEMO_SECRET_CODE."""
from conftest import auth


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
