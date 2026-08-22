"""
OTP email delivery via SendGrid.

The rest of the app only ever calls `send_otp_email()`. OUR code owns OTP
generation/verification — SendGrid only delivers.

Env vars:
- SENDGRID_API_KEY : required. Its absence raises at import (startup) time, so
                     the app refuses to boot rather than silently failing to
                     deliver login codes.
"""
import os
import logging

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

logger = logging.getLogger("ptm.email")

FROM_EMAIL = "noreply@ptmnow.com"
FROM_NAME = "PTM Now"

# Fail fast at startup rather than silently falling back to anything.
_API_KEY = os.getenv("SENDGRID_API_KEY")
if not _API_KEY:
    raise RuntimeError(
        "SENDGRID_API_KEY is not set. OTP email delivery requires a SendGrid "
        "API key; set SENDGRID_API_KEY in the environment before starting."
    )

# PTM Now coral mark, inlined so the email needs no external image request.
_LOGO_SVG = (
    '<svg width="32" height="32" viewBox="0 0 170 170" xmlns="http://www.w3.org/2000/svg">'
    '<rect x="10" y="24" width="150" height="140" rx="26" fill="#EE5A52"/>'
    '<rect x="36" y="10" width="16" height="34" rx="8" fill="#C6362E"/>'
    '<rect x="118" y="10" width="16" height="34" rx="8" fill="#C6362E"/>'
    '<rect x="10" y="24" width="150" height="34" rx="26" fill="#D8443B"/>'
    '<rect x="10" y="44" width="150" height="14" fill="#D8443B"/>'
    '<path d="M54 106 L76 130 L118 78" fill="none" stroke="#fff" stroke-width="16" '
    'stroke-linecap="round" stroke-linejoin="round"/>'
    '</svg>'
)


def _display_code(code: str) -> str:
    """Purely visual grouping for the email body — '482917' -> '482 917'. The
    stored/verified code (passed to this module and compared elsewhere) is
    never touched; only this rendered copy is spaced."""
    return f"{code[:3]} {code[3:]}"


def send_otp_email(to_email: str, name: str, code: str) -> bool:
    """Deliver a login OTP via SendGrid. Returns True on success, False on failure.

    Blocking (uses the sync SendGrid client) — callers in async request handlers
    should invoke this via `asyncio.to_thread(...)` so the event loop isn't blocked.
    """
    subject = "Your PTM Now verification code"
    display_code = _display_code(code)

    plain_text_content = (
        f"Hi {name},\n\n"
        f"Your PTM Now verification code is {display_code}.\n\n"
        f"This code expires in 10 minutes.\n\n"
        f"If you didn't request this, you can safely ignore this email.\n\n"
        f"— PTM Now"
    )

    # Deliberately minimal: no external images/fonts, no buttons, no footer
    # links, no tracking pixel, no unsubscribe — that kind of weight is what
    # gets transactional mail misclassified as bulk. Inline CSS only.
    html_content = f"""\
<div style="max-width:480px;margin:0 auto;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#ffffff;">
  <div style="margin-bottom:24px;">{_LOGO_SVG}</div>
  <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#1F2421;">Hi {name},</p>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#1F2421;">Your PTM Now verification code is:</p>
  <div style="background:#FFF8F3;border-radius:12px;padding:20px;text-align:center;margin:0 0 20px;">
    <span style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#1B3F7A;">{display_code}</span>
  </div>
  <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#4A524D;">This code expires in 10 minutes.</p>
  <p style="margin:0;font-size:14px;line-height:1.5;color:#4A524D;">If you didn't request this, you can safely ignore this email.</p>
</div>
"""

    message = Mail(
        from_email=(FROM_EMAIL, FROM_NAME),
        to_emails=to_email,
        subject=subject,
        plain_text_content=plain_text_content,
        html_content=html_content,
    )
    try:
        resp = SendGridAPIClient(_API_KEY).send(message)
    except Exception as exc:  # network error, auth failure, etc.
        logger.error("SendGrid OTP email to %s failed (request error): %s", to_email, exc)
        return False

    if resp.status_code // 100 == 2:
        logger.info("SendGrid OTP email sent to %s (HTTP %s)", to_email, resp.status_code)
        return True

    logger.error("SendGrid OTP email to %s failed: HTTP %s", to_email, resp.status_code)
    return False
