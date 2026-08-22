"""Auth + OTP endpoint coverage."""
import asyncio
from sqlalchemy import text
from conftest import auth, seed_engine


def _latest_otp(email):
    """Read the most recent OTP code for an email straight from the otps table.
    OTPs are now always random, so tests must read the real code, not assume one."""
    async def _q():
        async with seed_engine.connect() as c:
            return (await c.execute(
                text("SELECT code FROM otps WHERE email = :e ORDER BY created_at DESC LIMIT 1"),
                {"e": email},
            )).scalar()
    return asyncio.run(_q())


def _backdate_latest_otp(email, seconds):
    """Push the most-recently-inserted otp row's created_at back, so the
    resend-cooldown check sees it as older than it is — lets tests fire
    several requests without real sleeping. Same out-of-band seed_engine
    pattern as _latest_otp / test_verify_otp_expired's direct insert."""
    async def _q():
        async with seed_engine.begin() as c:
            await c.execute(
                text(
                    "UPDATE otps SET created_at = created_at - INTERVAL '1 second' * :s"
                    " WHERE id = (SELECT id FROM otps WHERE email = :e"
                    " ORDER BY created_at DESC LIMIT 1)"
                ),
                {"e": email, "s": seconds},
            )
    asyncio.run(_q())


# --- /auth/login -------------------------------------------------------------
def test_login_rejects_parent(client, seed):
    r = client.post("/auth/login", json={"email": seed["emails"]["parent"], "password": "x"})
    assert r.status_code == 400
    assert "OTP" in r.json()["detail"]


def test_login_rejects_teacher(client, seed):
    r = client.post("/auth/login", json={"email": seed["emails"]["t1"], "password": "x"})
    assert r.status_code == 400


def test_login_admin_works(client, seed):
    r = client.post("/auth/login", json={"email": seed["emails"]["admin"], "password": seed["admin_password"]})
    assert r.status_code == 200
    body = r.json()
    assert "access_token" in body and body["token_type"] == "bearer"


def test_login_admin_wrong_password(client, seed):
    r = client.post("/auth/login", json={"email": seed["emails"]["admin"], "password": "nope"})
    assert r.status_code == 401


# --- /auth/request-otp -------------------------------------------------------
def test_request_otp_known(client, seed):
    r = client.post("/auth/request-otp", json={"email": seed["emails"]["parent"]})
    assert r.status_code == 200
    assert "message" in r.json()


def test_request_otp_unknown(client, seed):
    r = client.post("/auth/request-otp", json={"email": "ghost@nowhere.edu"})
    assert r.status_code == 404


def test_request_otp_admin_rejected(client, seed):
    r = client.post("/auth/request-otp", json={"email": seed["emails"]["admin"]})
    assert r.status_code == 400


# --- /auth/request-otp rate limiting -----------------------------------------
def test_request_otp_rate_limited_after_three(client, seed):
    email = seed["emails"]["parent"]
    for _ in range(3):
        assert client.post("/auth/request-otp", json={"email": email}).status_code == 200
        _backdate_latest_otp(email, 31)  # clear resend cooldown between calls
    r = client.post("/auth/request-otp", json={"email": email})
    assert r.status_code == 429
    assert "Too many" in r.json()["detail"]


def test_request_otp_rate_limit_per_email(client, seed):
    # Exhaust one parent's limit; a different parent is unaffected.
    email = seed["emails"]["parent"]
    other = seed["emails"]["parent2"]
    for _ in range(3):
        client.post("/auth/request-otp", json={"email": email})
        _backdate_latest_otp(email, 31)  # clear resend cooldown between calls
    assert client.post("/auth/request-otp", json={"email": email}).status_code == 429
    assert client.post("/auth/request-otp", json={"email": other}).status_code == 200


def test_admin_login_rate_limited_after_three(client, seed):
    email = seed["emails"]["admin"]
    pw = seed["admin_password"]
    for _ in range(3):
        assert client.post("/auth/admin-login", json={"email": email, "password": pw}).status_code == 200
        _backdate_latest_otp(email, 31)  # clear resend cooldown between calls
    r = client.post("/auth/admin-login", json={"email": email, "password": pw})
    assert r.status_code == 429
    assert "Too many" in r.json()["detail"]


# --- /auth/request-otp resend cooldown ---------------------------------------
def test_request_otp_resend_within_cooldown_blocked(client, seed):
    email = seed["emails"]["parent"]
    assert client.post("/auth/request-otp", json={"email": email}).status_code == 200
    r = client.post("/auth/request-otp", json={"email": email})
    assert r.status_code == 429
    assert "seconds" in r.json()["detail"].lower()


def test_request_otp_resend_after_cooldown_succeeds(client, seed):
    email = seed["emails"]["parent"]
    assert client.post("/auth/request-otp", json={"email": email}).status_code == 200
    _backdate_latest_otp(email, 31)
    assert client.post("/auth/request-otp", json={"email": email}).status_code == 200


def test_admin_login_resend_within_cooldown_blocked(client, seed):
    email = seed["emails"]["admin"]
    pw = seed["admin_password"]
    assert client.post("/auth/admin-login", json={"email": email, "password": pw}).status_code == 200
    r = client.post("/auth/admin-login", json={"email": email, "password": pw})
    assert r.status_code == 429
    assert "seconds" in r.json()["detail"].lower()


# --- /auth/request-otp invalidates outstanding codes -------------------------
def test_request_new_otp_invalidates_previous_code(client, seed):
    email = seed["emails"]["parent"]
    client.post("/auth/request-otp", json={"email": email})
    old_code = _latest_otp(email)
    _backdate_latest_otp(email, 31)  # clear resend cooldown so the 2nd request succeeds
    client.post("/auth/request-otp", json={"email": email})
    new_code = _latest_otp(email)
    # Old code must no longer verify — the new request invalidated it.
    r_old = client.post("/auth/verify-otp", json={"email": email, "code": old_code})
    assert r_old.status_code == 400
    # New code still works.
    r_new = client.post("/auth/verify-otp", json={"email": email, "code": new_code})
    assert r_new.status_code == 200


# --- /auth/verify-otp --------------------------------------------------------
def test_verify_otp_success(client, seed):
    email = seed["emails"]["parent"]
    client.post("/auth/request-otp", json={"email": email})
    code = _latest_otp(email)
    r = client.post("/auth/verify-otp", json={"email": email, "code": code})
    assert r.status_code == 200
    body = r.json()
    assert "access_token" in body and body["role"] == "parent"


def test_verify_otp_wrong_code(client, seed):
    email = seed["emails"]["parent"]
    client.post("/auth/request-otp", json={"email": email})
    real = _latest_otp(email)
    wrong = "000000" if real != "000000" else "111111"
    r = client.post("/auth/verify-otp", json={"email": email, "code": wrong})
    assert r.status_code == 400


def test_verify_otp_reused(client, seed):
    email = seed["emails"]["parent"]
    client.post("/auth/request-otp", json={"email": email})
    code = _latest_otp(email)
    assert client.post("/auth/verify-otp", json={"email": email, "code": code}).status_code == 200
    again = client.post("/auth/verify-otp", json={"email": email, "code": code})
    assert again.status_code == 400


def test_verify_otp_expired(client, seed):
    email = seed["emails"]["parent"]

    async def _insert_expired():
        async with seed_engine.begin() as c:
            await c.execute(
                text("INSERT INTO otps (email, code, expires_at, used)"
                     " VALUES (:e, '000000', NOW() - INTERVAL '1 minute', false)"),
                {"e": email},
            )
    asyncio.run(_insert_expired())
    r = client.post("/auth/verify-otp", json={"email": email, "code": "000000"})
    assert r.status_code == 400


def test_verify_otp_fifth_wrong_attempt_invalidates_code(client, seed):
    email = seed["emails"]["parent"]
    client.post("/auth/request-otp", json={"email": email})
    real = _latest_otp(email)
    wrong = "000000" if real != "000000" else "111111"
    for _ in range(4):
        r = client.post("/auth/verify-otp", json={"email": email, "code": wrong})
        assert r.status_code == 400
    # 5th wrong attempt: invalidates the code and says so.
    r5 = client.post("/auth/verify-otp", json={"email": email, "code": wrong})
    assert r5.status_code == 400
    assert "request a new code" in r5.json()["detail"].lower()
    # Even the correct code now fails — the row was invalidated, not just
    # this wrong guess rejected.
    r_correct = client.post("/auth/verify-otp", json={"email": email, "code": real})
    assert r_correct.status_code == 400


# --- /auth/admin-login -------------------------------------------------------
def test_admin_login_success(client, seed):
    r = client.post("/auth/admin-login", json={"email": seed["emails"]["admin"], "password": seed["admin_password"]})
    assert r.status_code == 200
    assert "message" in r.json()


def test_admin_login_wrong_password(client, seed):
    r = client.post("/auth/admin-login", json={"email": seed["emails"]["admin"], "password": "nope"})
    assert r.status_code == 401


def test_admin_login_non_admin_rejected(client, seed):
    # Correct password for a parent account, but not an admin → 400.
    r = client.post("/auth/admin-login", json={"email": seed["emails"]["parent"], "password": "parent123"})
    assert r.status_code == 400


# --- /auth/signup ------------------------------------------------------------
def test_signup_success(client, seed):
    r = client.post("/auth/signup", json={
        "name": "New Parent", "email": "newp@test.edu", "password": "pw",
        "role": "parent", "invite_code": seed["invite_code"]})
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_signup_bad_invite(client, seed):
    r = client.post("/auth/signup", json={
        "name": "X", "email": "x@test.edu", "password": "pw",
        "role": "parent", "invite_code": "WRONG-CODE"})
    assert r.status_code == 400


def test_signup_duplicate_email(client, seed):
    r = client.post("/auth/signup", json={
        "name": "Dup", "email": seed["emails"]["parent"], "password": "pw",
        "role": "parent", "invite_code": seed["invite_code"]})
    assert r.status_code == 400


def _role_of(email):
    """Look up the persisted role for an email straight from the DB."""
    async def _q():
        async with seed_engine.connect() as c:
            return (await c.execute(
                text("SELECT role FROM users WHERE email = :e"), {"e": email}
            )).scalar()
    return asyncio.run(_q())


# --- signup role-escalation guard (regression) -------------------------------
def test_signup_ignores_admin_role_in_body(client, seed):
    r = client.post("/auth/signup", json={
        "name": "Sneaky", "email": "sneaky-admin@test.edu", "password": "pw",
        "role": "admin", "invite_code": seed["invite_code"]})
    assert r.status_code == 200
    assert _role_of("sneaky-admin@test.edu") == "parent"   # NOT admin


def test_signup_ignores_teacher_role_in_body(client, seed):
    r = client.post("/auth/signup", json={
        "name": "Sneaky T", "email": "sneaky-teacher@test.edu", "password": "pw",
        "role": "teacher", "invite_code": seed["invite_code"]})
    assert r.status_code == 200
    assert _role_of("sneaky-teacher@test.edu") == "parent"  # NOT teacher


def test_signup_without_role_creates_parent(client, seed):
    r = client.post("/auth/signup", json={
        "name": "Plain Parent", "email": "plain-parent@test.edu", "password": "pw",
        "invite_code": seed["invite_code"]})
    assert r.status_code == 200
    assert "access_token" in r.json()
    assert _role_of("plain-parent@test.edu") == "parent"


# --- /auth/me + /auth/venue --------------------------------------------------
def test_me(client, seed):
    r = client.get("/auth/me", headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 200
    assert r.json()["email"] == seed["emails"]["t1"]


def test_me_requires_auth(client, seed):
    r = client.get("/auth/me")
    assert r.status_code in (401, 403)


def test_venue_update_teacher(client, seed):
    r = client.patch("/auth/venue", json={"venue": "Lab 9"}, headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 200 and r.json()["venue"] == "Lab 9"


def test_venue_update_non_teacher_forbidden(client, seed):
    r = client.patch("/auth/venue", json={"venue": "Lab 9"}, headers=auth(seed["tokens"]["parent"]))
    assert r.status_code == 403
