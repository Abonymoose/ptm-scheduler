"""Per-meeting notes: privacy (scoped by author), ownership, clear-on-empty."""
from conftest import auth


def _book(client, seed, slot="A", token="parent", student="Kid", section="7C"):
    r = client.post("/bookings/", json={"slot_id": seed["slots"][slot], "student_name": student, "section": section},
                    headers=auth(seed["tokens"][token]))
    assert r.status_code == 200
    return r.json()["booking_id"]


# --- write + read own note ---------------------------------------------------
def test_teacher_writes_and_reads_own_note(client, seed):
    bid = _book(client, seed)  # parent books teacher1's slot A
    w = client.put(f"/notes/{bid}", json={"note_text": "Great progress in algebra"},
                   headers=auth(seed["tokens"]["t1"]))
    assert w.status_code == 200
    assert w.json()["note_text"] == "Great progress in algebra" and w.json()["exists"] is True

    r = client.get(f"/notes/{bid}", headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 200
    assert r.json()["note_text"] == "Great progress in algebra" and r.json()["exists"] is True


def test_parent_writes_and_reads_own_note(client, seed):
    bid = _book(client, seed)
    client.put(f"/notes/{bid}", json={"note_text": "Ask about homework load"}, headers=auth(seed["tokens"]["parent"]))
    r = client.get(f"/notes/{bid}", headers=auth(seed["tokens"]["parent"]))
    assert r.status_code == 200 and r.json()["note_text"] == "Ask about homework load"


# --- privacy: never see the other party's note -------------------------------
def test_parent_cannot_see_teacher_note(client, seed):
    bid = _book(client, seed)
    client.put(f"/notes/{bid}", json={"note_text": "TEACHER PRIVATE"}, headers=auth(seed["tokens"]["t1"]))
    # Parent reads the same booking → must NOT see the teacher's note.
    r = client.get(f"/notes/{bid}", headers=auth(seed["tokens"]["parent"]))
    assert r.status_code == 200
    assert r.json()["note_text"] == "" and r.json()["exists"] is False


def test_notes_are_independent_per_author(client, seed):
    bid = _book(client, seed)
    client.put(f"/notes/{bid}", json={"note_text": "teacher view"}, headers=auth(seed["tokens"]["t1"]))
    client.put(f"/notes/{bid}", json={"note_text": "parent view"}, headers=auth(seed["tokens"]["parent"]))
    assert client.get(f"/notes/{bid}", headers=auth(seed["tokens"]["t1"])).json()["note_text"] == "teacher view"
    assert client.get(f"/notes/{bid}", headers=auth(seed["tokens"]["parent"])).json()["note_text"] == "parent view"


# --- clear on empty ----------------------------------------------------------
def test_empty_text_clears_note(client, seed):
    bid = _book(client, seed)
    client.put(f"/notes/{bid}", json={"note_text": "temp"}, headers=auth(seed["tokens"]["t1"]))
    cleared = client.put(f"/notes/{bid}", json={"note_text": ""}, headers=auth(seed["tokens"]["t1"]))
    assert cleared.status_code == 200 and cleared.json()["exists"] is False
    assert client.get(f"/notes/{bid}", headers=auth(seed["tokens"]["t1"])).json()["note_text"] == ""


def test_whitespace_only_clears_note(client, seed):
    bid = _book(client, seed)
    client.put(f"/notes/{bid}", json={"note_text": "temp"}, headers=auth(seed["tokens"]["t1"]))
    client.put(f"/notes/{bid}", json={"note_text": "   "}, headers=auth(seed["tokens"]["t1"]))
    assert client.get(f"/notes/{bid}", headers=auth(seed["tokens"]["t1"])).json()["exists"] is False


# --- ownership guards --------------------------------------------------------
def test_non_owner_teacher_cannot_write(client, seed):
    bid = _book(client, seed)  # teacher1's slot
    r = client.put(f"/notes/{bid}", json={"note_text": "nope"}, headers=auth(seed["tokens"]["t2"]))
    assert r.status_code == 403


def test_non_owner_parent_cannot_write(client, seed):
    bid = _book(client, seed)  # parent (P1) owns it
    r = client.put(f"/notes/{bid}", json={"note_text": "nope"}, headers=auth(seed["tokens"]["parent2"]))
    assert r.status_code == 403


def test_admin_cannot_write_note(client, seed):
    bid = _book(client, seed)
    r = client.put(f"/notes/{bid}", json={"note_text": "nope"}, headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 403


def test_write_note_missing_booking(client, seed):
    bogus = "00000000-0000-0000-0000-000000000000"
    r = client.put(f"/notes/{bogus}", json={"note_text": "x"}, headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 404


# --- GET /notes returns only the caller's notes ------------------------------
def test_list_notes_only_callers(client, seed):
    a = _book(client, seed, slot="A")
    b = _book(client, seed, slot="B")
    # Parent notes on both A and B; teacher1 notes only on A.
    client.put(f"/notes/{a}", json={"note_text": "parent A note"}, headers=auth(seed["tokens"]["parent"]))
    client.put(f"/notes/{b}", json={"note_text": "parent B note"}, headers=auth(seed["tokens"]["parent"]))
    client.put(f"/notes/{a}", json={"note_text": "teacher A note"}, headers=auth(seed["tokens"]["t1"]))

    parent_notes = client.get("/notes", headers=auth(seed["tokens"]["parent"]))
    assert parent_notes.status_code == 200
    ptexts = [n["note_text"] for n in parent_notes.json()]
    assert set(ptexts) == {"parent A note", "parent B note"}
    assert "teacher A note" not in ptexts

    teacher_notes = client.get("/notes", headers=auth(seed["tokens"]["t1"])).json()
    assert [n["note_text"] for n in teacher_notes] == ["teacher A note"]


def test_list_notes_includes_meeting_context(client, seed):
    a = _book(client, seed, slot="A", student="Zoe", section="7C")
    client.put(f"/notes/{a}", json={"note_text": "context check"}, headers=auth(seed["tokens"]["parent"]))
    row = client.get("/notes", headers=auth(seed["tokens"]["parent"])).json()[0]
    for k in ("booking_id", "note_text", "student_name", "section", "grade", "parent_name", "teacher_name", "start_time"):
        assert k in row
    assert row["student_name"] == "Zoe"
    assert row["teacher_name"] == "Ms. Teacher One"


def test_list_notes_empty_when_none(client, seed):
    assert client.get("/notes", headers=auth(seed["tokens"]["t1"])).json() == []
