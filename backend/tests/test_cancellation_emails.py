"""Cancellation notification emails: who gets notified, admin checkboxes,
the actor never being mailed, and a send failure not undoing the cancel.

send_cancellation_email is mocked at the point each router imports it
(routers.bookings / routers.admin), same pattern as the no_real_email
autouse fixture mocks send_otp_email in routers.auth -- these are separate
bound names, patching email_service.send_cancellation_email itself would
not affect calls already imported into the routers.
"""
from conftest import auth


def _book(client, seed, slot_label, parent_key="parent", student="Kiddo", section="5A"):
    slot_id = seed["slots"][slot_label]
    r = client.post(
        "/bookings/",
        json={"slot_id": slot_id, "student_name": student, "section": section},
        headers=auth(seed["tokens"][parent_key]),
    )
    assert r.status_code == 200
    return r.json()["booking_id"]


def _mock_send(monkeypatch, module, return_value=True):
    calls = []

    def fake(to_email, recipient_name, recipient_role, *a, **kw):
        calls.append({"to_email": to_email, "recipient_role": recipient_role})
        return return_value

    monkeypatch.setattr(f"routers.{module}.send_cancellation_email", fake)
    return calls


# --- parent cancels -> teacher notified, parent (actor) never mailed --------
def test_parent_cancel_notifies_teacher_not_parent(client, seed, monkeypatch):
    calls = _mock_send(monkeypatch, "bookings")
    bid = _book(client, seed, "A")
    r = client.delete(f"/bookings/{bid}", headers=auth(seed["tokens"]["parent"]))
    assert r.status_code == 200

    assert len(calls) == 1
    assert calls[0]["to_email"] == seed["emails"]["t1"]
    assert calls[0]["recipient_role"] == "teacher"
    assert all(c["to_email"] != seed["emails"]["parent"] for c in calls)


# --- teacher cancels -> parent notified, teacher (actor) never mailed -------
def test_teacher_cancel_notifies_parent_not_teacher(client, seed, monkeypatch):
    calls = _mock_send(monkeypatch, "bookings")
    bid = _book(client, seed, "A")
    r = client.delete(f"/bookings/{bid}", headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 200

    assert len(calls) == 1
    assert calls[0]["to_email"] == seed["emails"]["parent"]
    assert calls[0]["recipient_role"] == "parent"
    assert all(c["to_email"] != seed["emails"]["t1"] for c in calls)


# --- admin cancel: both checkboxes (default) --------------------------------
def test_admin_cancel_default_notifies_both(client, seed, monkeypatch):
    calls = _mock_send(monkeypatch, "admin")
    slot_id = seed["slots"]["A"]
    _book(client, seed, "A")
    r = client.request(
        "DELETE", f"/admin/slots/{slot_id}",
        headers=auth(seed["tokens"]["admin"]),
        json={"notify_parent": True, "notify_teacher": True},
    )
    assert r.status_code == 200

    recipients = {c["to_email"] for c in calls}
    assert recipients == {seed["emails"]["parent"], seed["emails"]["t1"]}
    assert seed["emails"]["admin"] not in recipients  # actor never mailed


# --- admin cancel: no body at all -> defaults to both, per checkbox defaults
def test_admin_cancel_no_body_defaults_to_both(client, seed, monkeypatch):
    calls = _mock_send(monkeypatch, "admin")
    slot_id = seed["slots"]["A"]
    _book(client, seed, "A")
    r = client.delete(f"/admin/slots/{slot_id}", headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 200

    recipients = {c["to_email"] for c in calls}
    assert recipients == {seed["emails"]["parent"], seed["emails"]["t1"]}


# --- admin cancel: only parent checked --------------------------------------
def test_admin_cancel_notify_parent_only(client, seed, monkeypatch):
    calls = _mock_send(monkeypatch, "admin")
    slot_id = seed["slots"]["A"]
    _book(client, seed, "A")
    r = client.request(
        "DELETE", f"/admin/slots/{slot_id}",
        headers=auth(seed["tokens"]["admin"]),
        json={"notify_parent": True, "notify_teacher": False},
    )
    assert r.status_code == 200

    assert len(calls) == 1
    assert calls[0]["to_email"] == seed["emails"]["parent"]
    assert calls[0]["recipient_role"] == "parent"


# --- admin cancel: only teacher checked --------------------------------------
def test_admin_cancel_notify_teacher_only(client, seed, monkeypatch):
    calls = _mock_send(monkeypatch, "admin")
    slot_id = seed["slots"]["A"]
    _book(client, seed, "A")
    r = client.request(
        "DELETE", f"/admin/slots/{slot_id}",
        headers=auth(seed["tokens"]["admin"]),
        json={"notify_parent": False, "notify_teacher": True},
    )
    assert r.status_code == 200

    assert len(calls) == 1
    assert calls[0]["to_email"] == seed["emails"]["t1"]
    assert calls[0]["recipient_role"] == "teacher"


# --- admin cancel: neither checked -> nobody mailed -------------------------
def test_admin_cancel_notify_neither(client, seed, monkeypatch):
    calls = _mock_send(monkeypatch, "admin")
    slot_id = seed["slots"]["A"]
    _book(client, seed, "A")
    r = client.request(
        "DELETE", f"/admin/slots/{slot_id}",
        headers=auth(seed["tokens"]["admin"]),
        json={"notify_parent": False, "notify_teacher": False},
    )
    assert r.status_code == 200
    assert calls == []


# --- a failed send must not undo the cancellation ---------------------------
def test_parent_cancel_survives_email_send_failure(client, seed, monkeypatch):
    _mock_send(monkeypatch, "bookings", return_value=False)  # simulates SendGrid failure
    bid = _book(client, seed, "A")
    r = client.delete(f"/bookings/{bid}", headers=auth(seed["tokens"]["parent"]))
    assert r.status_code == 200  # cancellation itself still succeeds

    slots = client.get("/slots/", headers=auth(seed["tokens"]["parent"])).json()
    slot = next(s for s in slots if s["id"] == seed["slots"]["A"])
    assert slot["booked_count"] == 0  # genuinely freed, not left half-cancelled


def test_admin_cancel_survives_email_send_exception(client, seed, monkeypatch):
    def raising(*a, **kw):
        raise RuntimeError("SendGrid is down")
    monkeypatch.setattr("routers.admin.send_cancellation_email", raising)

    slot_id = seed["slots"]["A"]
    _book(client, seed, "A")
    r = client.request(
        "DELETE", f"/admin/slots/{slot_id}",
        headers=auth(seed["tokens"]["admin"]),
        json={"notify_parent": True, "notify_teacher": True},
    )
    assert r.status_code == 200  # slot deletion itself still succeeds
    assert r.json()["cancelled_booking"] is True

    # Slot is genuinely gone, not left in limbo by the notification error.
    slots = client.get("/slots/all", headers=auth(seed["tokens"]["admin"])).json()
    assert all(s["id"] != slot_id for s in slots)
