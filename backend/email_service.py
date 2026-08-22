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

# Hosted, not inline: Gmail strips inline <svg> from HTML email, which is why
# an inline mark never rendered there. width/height are set on the <img> tag
# itself (not just CSS) since some clients ignore CSS sizing on images.
_LOGO_URL = "https://ptmnow.com/email-logo.png"


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

    # Plain-text kept in sync with the HTML: same wording, same order.
    plain_text_content = (
        f"Hi {name},\n\n"
        f"Enter this code to sign in to PTM Now:\n\n"
        f"{display_code}\n\n"
        f"This code expires in 10 minutes and can only be used once.\n\n"
        f"Don't share this code with anyone. PTM Now and Inventure Academy "
        f"will never ask you for it.\n\n"
        f"If you didn't request this, you can safely ignore this email.\n\n"
        f"Thanks,\n"
        f"The PTM Now Team"
    )

    # Standard transactional-email pattern (GitHub/Proton/Roblox/Twilio style):
    # tinted page background, a white bordered card inset and centered, code
    # as the visual anchor in a light block. Table-based layout throughout —
    # Outlook's Word rendering engine doesn't reliably center/size divs, only
    # tables. Deliberately minimal otherwise: no external images, no buttons,
    # no tracking pixel, no unsubscribe, inline CSS only.
    html_content = f"""\
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F4F5;">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border:1px solid #E5E5E5;border-radius:8px;">
        <tr>
          <td style="padding:40px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
              <tr>
                <td align="center">
                  <img src="{_LOGO_URL}" width="32" height="32" alt="" style="display:inline-block;border:0;vertical-align:middle;">
                  <span style="font-size:20px;font-weight:700;color:#18181B;vertical-align:middle;padding-left:8px;">PTM Now</span>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#18181B;">Hi {name},</p>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#18181B;">Enter this code to sign in to PTM Now:</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
              <tr>
                <td align="center" style="background:#F7F7F8;border-radius:8px;padding:22px 16px;">
                  <span style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:28px;font-weight:700;letter-spacing:6px;color:#18181B;">{display_code}</span>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#3F3F46;">This code expires in 10 minutes and can only be used once.</p>
            <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#18181B;font-weight:700;">Don't share this code with anyone. PTM Now and Inventure Academy will never ask you for it.</p>
            <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#3F3F46;">If you didn't request this, you can safely ignore this email.</p>
            <p style="margin:0;font-size:14px;line-height:1.5;color:#3F3F46;">Thanks,<br>The PTM Now Team</p>
          </td>
        </tr>
      </table>
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
        <tr>
          <td align="center" style="padding:20px 16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#71717A;">
            PTM Now &middot; Parent-teacher meeting scheduling for Inventure Academy, Bangalore
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
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
