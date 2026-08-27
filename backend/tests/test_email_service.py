"""EMAIL_OVERRIDE_TO test-mode redirect — email_service._send().

Tests call email_service.send_otp_email() directly (not through
routers.auth), so the routers.auth-level `no_real_email` autouse fixture
doesn't apply here; SendGridAPIClient and Mail are patched directly so
nothing ever hits the real network.
"""
import email_service


class FakeMail:
    """Records constructor kwargs verbatim instead of building a real
    SendGrid Mail object — avoids depending on that library's internal
    attribute structure (which varies by version) just to assert on
    recipient/subject/body."""
    def __init__(self, **kwargs):
        self.kwargs = kwargs


class FakeResponse:
    status_code = 202  # SendGrid's real success code


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


def test_send_without_override_goes_to_real_recipient(monkeypatch):
    monkeypatch.delenv("EMAIL_OVERRIDE_TO", raising=False)
    sent = _patch_sendgrid(monkeypatch)

    ok = email_service.send_otp_email("teacher@inventureacademy.com", "Ms. Teacher", "482917")
    assert ok is True

    assert len(sent) == 1
    msg = sent[0].kwargs
    assert msg["to_emails"] == "teacher@inventureacademy.com"
    assert not msg["subject"].startswith("[TEST")
    assert "[TEST MODE]" not in msg["plain_text_content"]
    assert "TEST MODE" not in msg["html_content"]


def test_send_with_override_and_empty_allowlist_behaves_as_before(monkeypatch):
    """No EMAIL_ALLOWLIST set at all -- same redirect-everything behaviour as
    before the allowlist existed."""
    monkeypatch.setenv("EMAIL_OVERRIDE_TO", "dev-inbox@example.com")
    monkeypatch.delenv("EMAIL_ALLOWLIST", raising=False)
    sent = _patch_sendgrid(monkeypatch)

    ok = email_service.send_otp_email("teacher@inventureacademy.com", "Ms. Teacher", "482917")
    assert ok is True
    assert sent[0].kwargs["to_emails"] == "dev-inbox@example.com"
    assert sent[0].kwargs["subject"].startswith("[TEST → teacher@inventureacademy.com]")


def test_send_to_allowlisted_address_goes_real_no_prefix(monkeypatch):
    monkeypatch.setenv("EMAIL_OVERRIDE_TO", "dev-inbox@example.com")
    monkeypatch.setenv("EMAIL_ALLOWLIST", " Jayadev@InventureAcademy.com , other@x.edu")
    sent = _patch_sendgrid(monkeypatch)

    # Case-insensitive, whitespace-around-entry tolerant.
    ok = email_service.send_otp_email("jayadev@inventureacademy.com", "Jayadev", "482917")
    assert ok is True
    msg = sent[0].kwargs
    assert msg["to_emails"] == "jayadev@inventureacademy.com"
    assert not msg["subject"].startswith("[TEST")
    assert "[TEST MODE]" not in msg["plain_text_content"]


def test_send_to_non_allowlisted_address_still_redirects(monkeypatch):
    monkeypatch.setenv("EMAIL_OVERRIDE_TO", "dev-inbox@example.com")
    monkeypatch.setenv("EMAIL_ALLOWLIST", "jayadev@inventureacademy.com")
    sent = _patch_sendgrid(monkeypatch)

    ok = email_service.send_otp_email("teacher@inventureacademy.com", "Ms. Teacher", "482917")
    assert ok is True
    msg = sent[0].kwargs
    assert msg["to_emails"] == "dev-inbox@example.com"
    assert msg["subject"].startswith("[TEST → teacher@inventureacademy.com]")


def test_send_with_override_redirects_and_prefixes_subject(monkeypatch, caplog):
    monkeypatch.setenv("EMAIL_OVERRIDE_TO", "dev-inbox@example.com")
    sent = _patch_sendgrid(monkeypatch)

    with caplog.at_level("WARNING"):
        ok = email_service.send_otp_email("teacher@inventureacademy.com", "Ms. Teacher", "482917")
    assert ok is True

    assert len(sent) == 1
    msg = sent[0].kwargs
    # Redirected to the override address, never the real recipient.
    assert msg["to_emails"] == "dev-inbox@example.com"
    # Subject prefixed with the intended recipient (the real subject also has
    # a "(7:24 PM)" time suffix, so check the prefix rather than exact match).
    assert msg["subject"].startswith("[TEST → teacher@inventureacademy.com] Your PTM Now verification code")
    # Banner naming the real intended recipient at the top of both bodies.
    assert msg["plain_text_content"].startswith(
        "[TEST MODE] Intended recipient: teacher@inventureacademy.com"
    )
    assert "teacher@inventureacademy.com" in msg["html_content"]
    # A WARNING naming both the intended and actual recipient.
    warnings = [r.message for r in caplog.records if r.levelname == "WARNING"]
    assert any(
        "teacher@inventureacademy.com" in w and "dev-inbox@example.com" in w
        for w in warnings
    )
