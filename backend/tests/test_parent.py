"""GET /parent/children — family-scoped students with their section's teachers."""
import asyncio
import uuid

from sqlalchemy import text

from conftest import auth, seed_engine, hash_password


async def _exec(stmts):
    async with seed_engine.begin() as conn:
        for sql, params in stmts:
            await conn.execute(text(sql), params)


def _family(seed, parent_key="parent"):
    """Put the seeded parent in a family with two students (5A, 3B) and link
    t1 → 5A, t2 → 3B. Returns the ids created."""
    sid = seed["school_id"]
    fam = str(uuid.uuid4())
    s1, s2 = str(uuid.uuid4()), str(uuid.uuid4())
    asyncio.run(_exec([
        ("INSERT INTO families (id, school_id) VALUES (:id, :sid)", {"id": fam, "sid": sid}),
        ("UPDATE users SET family_id = :fam WHERE id = :uid", {"fam": fam, "uid": seed["ids"][parent_key]}),
        ("INSERT INTO students (id, school_id, family_id, name, section, grade)"
         " VALUES (:id, :sid, :fam, 'Asha One', '5A', 5)", {"id": s1, "sid": sid, "fam": fam}),
        ("INSERT INTO students (id, school_id, family_id, name, section, grade)"
         " VALUES (:id, :sid, :fam, 'Ravi One', '3B', 3)", {"id": s2, "sid": sid, "fam": fam}),
        ("INSERT INTO teacher_sections (teacher_id, school_id, section) VALUES (:t, :sid, '5A')",
         {"t": seed["ids"]["t1"], "sid": sid}),
        ("INSERT INTO teacher_sections (teacher_id, school_id, section) VALUES (:t, :sid, '3B')",
         {"t": seed["ids"]["t2"], "sid": sid}),
    ]))
    return {"family": fam, "s1": s1, "s2": s2}


def _other_school():
    """A second school with its own family, a 5A student and a 5A teacher —
    same section name as the seeded school, so a missing school_id filter on
    either join would leak it."""
    sid, fam, teacher, student = (str(uuid.uuid4()) for _ in range(4))
    asyncio.run(_exec([
        ("INSERT INTO schools (id, name, invite_code, slug) VALUES (:id, 'Other School', 'OTHER-1', 'other')",
         {"id": sid}),
        ("INSERT INTO users (id, school_id, name, email, hashed_password, role, subject)"
         " VALUES (:id, :sid, 'Other Teacher', 'other.t@other.edu', :pwd, CAST('teacher' AS user_role), 'Art')",
         {"id": teacher, "sid": sid, "pwd": hash_password("unused-pw")}),
        ("INSERT INTO families (id, school_id) VALUES (:id, :sid)", {"id": fam, "sid": sid}),
        ("INSERT INTO students (id, school_id, family_id, name, section, grade)"
         " VALUES (:id, :sid, :fam, 'Other Kid', '5A', 5)", {"id": student, "sid": sid, "fam": fam}),
        ("INSERT INTO teacher_sections (teacher_id, school_id, section) VALUES (:t, :sid, '5A')",
         {"t": teacher, "sid": sid}),
    ]))
    return {"school": sid, "family": fam, "teacher": teacher, "student": student}


def test_children_requires_auth(client, seed):
    assert client.get("/parent/children").status_code == 401


def test_children_forbidden_for_teacher(client, seed):
    r = client.get("/parent/children", headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 403


def test_children_forbidden_for_admin(client, seed):
    r = client.get("/parent/children", headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 403


def test_children_empty_without_family(client, seed):
    r = client.get("/parent/children", headers=auth(seed["tokens"]["parent"]))
    assert r.status_code == 200
    assert r.json() == []


def test_children_includes_teachers_per_student(client, seed):
    ids = _family(seed)
    r = client.get("/parent/children", headers=auth(seed["tokens"]["parent"]))
    assert r.status_code == 200
    kids = {k["id"]: k for k in r.json()}
    assert set(kids) == {ids["s1"], ids["s2"]}

    asha = kids[ids["s1"]]
    assert (asha["name"], asha["section"], asha["grade"]) == ("Asha One", "5A", 5)
    assert asha["teachers"] == [{"id": seed["ids"]["t1"], "name": "Ms. Teacher One", "subject": "Math"}]

    ravi = kids[ids["s2"]]
    assert ravi["teachers"] == [{"id": seed["ids"]["t2"], "name": "Mr. Teacher Two", "subject": "Science"}]


def test_children_only_own_family(client, seed):
    _family(seed, "parent")
    r = client.get("/parent/children", headers=auth(seed["tokens"]["parent2"]))
    assert r.status_code == 200
    assert r.json() == []


def test_children_only_own_school(client, seed):
    ids = _family(seed)
    other = _other_school()
    r = client.get("/parent/children", headers=auth(seed["tokens"]["parent"]))
    assert r.status_code == 200
    body = r.json()
    assert {k["id"] for k in body} == {ids["s1"], ids["s2"]}
    all_teacher_ids = {t["id"] for k in body for t in k["teachers"]}
    assert other["teacher"] not in all_teacher_ids
    assert other["student"] not in {k["id"] for k in body}


def test_parent_with_family_can_log_in_and_fetch_children(client, seed):
    """users.family_id is a UUID and goes into the JWT payload — it must be
    stringified there, or OTP login 500s for every parent with a family."""
    ids = _family(seed)
    email = seed["emails"]["parent"]
    assert client.post("/auth/request-otp", json={"email": email}).status_code == 200

    async def _code():
        async with seed_engine.connect() as c:
            return (await c.execute(
                text("SELECT code FROM otps WHERE email = :e ORDER BY created_at DESC LIMIT 1"), {"e": email},
            )).scalar()
    r = client.post("/auth/verify-otp", json={"email": email, "code": asyncio.run(_code())})
    assert r.status_code == 200

    r = client.get("/parent/children", headers=auth(r.json()["access_token"]))
    assert r.status_code == 200
    assert {k["id"] for k in r.json()} == {ids["s1"], ids["s2"]}


def test_children_cross_school_family_link_returns_nothing(client, seed):
    """A parent whose family_id points at another school's family must not see
    that family's students — the school_id comes from the JWT, not the row."""
    other = _other_school()
    asyncio.run(_exec([("UPDATE users SET family_id = :fam WHERE id = :uid",
                        {"fam": other["family"], "uid": seed["ids"]["parent"]})]))
    r = client.get("/parent/children", headers=auth(seed["tokens"]["parent"]))
    assert r.status_code == 200
    assert r.json() == []
