"""Auth + OTP endpoint coverage."""
import asyncio
from sqlalchemy import text
from conftest import auth, seed_engine


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


# --- /auth/verify-otp --------------------------------------------------------
def test_verify_otp_success(client, seed):
    email = seed["emails"]["parent"]
    client.post("/auth/request-otp", json={"email": email})
    r = client.post("/auth/verify-otp", json={"email": email, "code": "000000"})
    assert r.status_code == 200
    body = r.json()
    assert "access_token" in body and body["role"] == "parent"


def test_verify_otp_wrong_code(client, seed):
    email = seed["emails"]["parent"]
    client.post("/auth/request-otp", json={"email": email})
    r = client.post("/auth/verify-otp", json={"email": email, "code": "999999"})
    assert r.status_code == 400


def test_verify_otp_reused(client, seed):
    email = seed["emails"]["parent"]
    client.post("/auth/request-otp", json={"email": email})
    assert client.post("/auth/verify-otp", json={"email": email, "code": "000000"}).status_code == 200
    again = client.post("/auth/verify-otp", json={"email": email, "code": "000000"})
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
