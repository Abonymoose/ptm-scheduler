"""
OTP email delivery — provider-agnostic seam.

The rest of the app only ever calls `send_otp_email()`. Today that goes through
MSG91's transactional email API (v5); swapping providers means editing only this
file. OUR code still owns OTP generation/verification — MSG91 only delivers.

Behaviour:
- MSG91_AUTH_KEY set   -> send a real email via MSG91; return True on 2xx, else False.
- MSG91_AUTH_KEY unset -> no network call. Log the code and return True. Keeps
  local dev and the test suite fast, free, and email-free.

Env vars (read at call time so the provider stays swappable without restarts):
- MSG91_AUTH_KEY     : MSG91 account auth key. Its presence enables real sending.
- MSG91_TEMPLATE_ID  : the MSG91 transactional email template to render. MSG91's
                       v5 email API is template-based; the template owns the
                       subject ("Your PTM Now login code") and body copy (the
                       6-digit code, 10-minute expiry note, and the "ignore if you
                       didn't request this" line). We pass the code + expiry as
                       template variables below.
- MSG91_FROM_EMAIL   : sender address (default noreply@ptmnow.com).
- MSG91_FROM_NAME    : sender display name (default "PTM Now").
- MSG91_DOMAIN       : verified sending domain (defaults to the from-address domain).
- MSG91_EMAIL_URL    : override the API endpoint (default is MSG91 v5 send URL).
"""
import os
import logging

import httpx

logger = logging.getLogger("ptm.email")

# MSG91 v5 transactional email endpoint. Auth is the `authkey` request header.
DEFAULT_MSG91_EMAIL_URL = "https://control.msg91.com/api/v5/email/send"


def send_otp_email(to_email: str, code: str) -> bool:
    """Deliver a login OTP. Returns True on success, False on failure.

    Blocking (uses httpx sync) — callers in async request handlers should invoke
    this via `asyncio.to_thread(...)` so the event loop isn't blocked.
    """
    auth_key = os.getenv("MSG91_AUTH_KEY")

    # No provider configured (local/tests): never hit the network — just log.
    if not auth_key:
        logger.info("OTP for %s: %s  (MSG91_AUTH_KEY unset — email NOT sent)", to_email, code)
        print(f"OTP for {to_email}: {code}")
        return True

    template_id = os.getenv("MSG91_TEMPLATE_ID")
    if not template_id:
        logger.error("MSG91_TEMPLATE_ID is not set — cannot send OTP email via MSG91.")
        return False

    from_email = os.getenv("MSG91_FROM_EMAIL", "noreply@ptmnow.com")
    from_name = os.getenv("MSG91_FROM_NAME", "PTM Now")
    domain = os.getenv("MSG91_DOMAIN") or from_email.split("@")[-1]
    url = os.getenv("MSG91_EMAIL_URL", DEFAULT_MSG91_EMAIL_URL)

    payload = {
        "recipients": [
            {
                "to": [{"email": to_email}],
                # Template placeholders. The MSG91 template should reference these
                # (e.g. ##otp##, ##expiry_minutes##).
                "variables": {
                    "otp": code,
                    "code": code,
                    "expiry_minutes": "10",
                },
            }
        ],
        "from": {"email": from_email, "name": from_name},
        "domain": domain,
        "template_id": template_id,
    }
    headers = {
        "authkey": auth_key,
        "Content-Type": "application/json",
        "accept": "application/json",
    }

    try:
        resp = httpx.post(url, json=payload, headers=headers, timeout=10.0)
    except Exception as exc:  # network error, timeout, DNS, etc.
        logger.error("MSG91 OTP email to %s failed (request error): %s", to_email, exc)
        return False

    if resp.status_code // 100 == 2:
        logger.info("MSG91 OTP email sent to %s (HTTP %s)", to_email, resp.status_code)
        return True

    logger.error(
        "MSG91 OTP email to %s failed: HTTP %s — %s",
        to_email, resp.status_code, resp.text[:500],
    )
    return False
