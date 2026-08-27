"""Runtime email routing config: GET/POST /demo/email-config,
GET /admin/email-config, and that a POSTed setting actually changes what
`email_service._send()` does on the next call."""
import email_service
from conftest import auth


class FakeMail:
    def __init__(self, **kwargs):
        self.kwargs = kwargs


class FakeResponse:
    status_code = 202


class FakeSendGridAPIClient:
    def __init__(self, api_key):
        pass

    def send(self, message):
        FakeSendGridAPIClient.sent.append(message)
        return FakeResponse()

    sent = []


def _patch_sendgrid(monkeypatch):
    FakeSendGridAPIClient.sent = []
    monkeypatch.setattr(email_service, "Mail", FakeMail)
    monkeypatch.setattr(email_service, "SendGridAPIClient", FakeSendGridAPIClient)
    return FakeSendGridAPIClient.sent


def test_get_email_config_default_reflects_env_vars(client, seed, monkeypatch):
    monkeypatch.setenv("EMAIL_OVERRIDE_TO", "dev-inbox@example.com")
    monkeypatch.setenv("EMAIL_ALLOWLIST", "jayadev@inventureacademy.com")
    r = client.get("/demo/email-config", headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 200
    body = r.json()
    assert body["override_to"] == "dev-inbox@example.com"
    assert body["allowlist"] == ["jayadev@inventureacademy.com"]
    assert "sendgrid" not in str(body).lower()
    assert "api_key" not in str(body).lower()


def test_post_email_config_persists_and_affects_next_send(client, seed, monkeypatch):
    monkeypatch.delenv("EMAIL_OVERRIDE_TO", raising=False)
    monkeypatch.delenv("EMAIL_ALLOWLIST", raising=False)
    sent = _patch_sendgrid(monkeypatch)

    r = client.post(
        "/demo/email-config",
        json={"override_to": "demo-inbox@example.com", "allowlist": ["jayadev@inventureacademy.com"]},
        headers=auth(seed["tokens"]["admin"]),
    )
    assert r.status_code == 200
    assert r.json()["override_to"] == "demo-inbox@example.com"
    assert r.json()["allowlist"] == ["jayadev@inventureacademy.com"]

    # GET reflects the DB row, not (absent) env vars.
    r = client.get("/demo/email-config", headers=auth(seed["tokens"]["admin"]))
    assert r.json() == {"override_to": "demo-inbox@example.com", "allowlist": ["jayadev@inventureacademy.com"]}

    # And the DB-set config actually changes what the next send does --
    # no env var is involved at all here.
    email_service.send_otp_email("teacher@inventureacademy.com", "Ms. Teacher", "482917")
    assert sent[-1].kwargs["to_emails"] == "demo-inbox@example.com"

    email_service.send_otp_email("jayadev@inventureacademy.com", "Jayadev", "482917")
    assert sent[-1].kwargs["to_emails"] == "jayadev@inventureacademy.com"
    assert not sent[-1].kwargs["subject"].startswith("[TEST")


def test_post_empty_override_disables_redirect_even_with_env_var_set(client, seed, monkeypatch):
    """The Demo tab's "turn redirect off" toggle posts an empty override_to
    -- that must win over a still-set EMAIL_OVERRIDE_TO env var, not just
    leave it unset."""
    monkeypatch.setenv("EMAIL_OVERRIDE_TO", "dev-inbox@example.com")
    sent = _patch_sendgrid(monkeypatch)

    r = client.post(
        "/demo/email-config",
        json={"override_to": "", "allowlist": []},
        headers=auth(seed["tokens"]["admin"]),
    )
    assert r.status_code == 200
    assert r.json()["override_to"] == ""

    email_service.send_otp_email("teacher@inventureacademy.com", "Ms. Teacher", "482917")
    assert sent[-1].kwargs["to_emails"] == "teacher@inventureacademy.com"
    assert not sent[-1].kwargs["subject"].startswith("[TEST")


def test_email_config_endpoints_non_admin_forbidden(client, seed):
    for method, path in (("get", "/demo/email-config"), ("post", "/demo/email-config")):
        kwargs = {"json": {"override_to": "", "allowlist": []}} if method == "post" else {}
        r = getattr(client, method)(path, headers=auth(seed["tokens"]["parent"]), **kwargs)
        assert r.status_code == 403
        r = getattr(client, method)(path, headers=auth(seed["tokens"]["t1"]), **kwargs)
        assert r.status_code == 403


def test_admin_email_config_readonly_endpoint(client, seed, monkeypatch):
    monkeypatch.setenv("EMAIL_OVERRIDE_TO", "dev-inbox@example.com")
    monkeypatch.setenv("EMAIL_ALLOWLIST", "")
    r = client.get("/admin/email-config", headers=auth(seed["tokens"]["admin"]))
    assert r.status_code == 200
    assert r.json() == {"override_to": "dev-inbox@example.com", "allowlist": []}

    r = client.get("/admin/email-config", headers=auth(seed["tokens"]["parent"]))
    assert r.status_code == 403
    r = client.get("/admin/email-config", headers=auth(seed["tokens"]["t1"]))
    assert r.status_code == 403
