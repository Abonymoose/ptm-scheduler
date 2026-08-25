"""
OTP email delivery via SendGrid.

The rest of the app only ever calls `send_otp_email()`. OUR code owns OTP
generation/verification — SendGrid only delivers.

Env vars:
- SENDGRID_API_KEY : required. Its absence raises at import (startup) time, so
                     the app refuses to boot rather than silently failing to
                     deliver login codes.
- EMAIL_OVERRIDE_TO : optional. When set, EVERY outbound email (all types,
                     for all time — see `_send`) is redirected to this
                     address instead of its real recipient. For testing
                     against the prod users table without mailing real
                     Inventure staff. Absent means normal behaviour, always.
"""
import os
import logging
from datetime import datetime, timedelta, timezone

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

# One-time, loud, at process startup — so this can't sit forgotten on prod.
# The actual per-send redirect logic in `_send` re-reads the env var fresh on
# every call rather than trusting this frozen value, so it can never go stale
# within a long-running process and toggling it in tests needs no reload.
if os.getenv("EMAIL_OVERRIDE_TO"):
    logger.warning(
        "EMAIL OVERRIDE ACTIVE — all mail redirects to %s. This MUST be "
        "unset before real use.",
        os.getenv("EMAIL_OVERRIDE_TO"),
    )

# Hosted, not inline: Gmail strips inline <svg> from HTML email, which is why
# an inline mark never rendered there. width/height are set on the <img> tag
# itself (not just CSS) since some clients ignore CSS sizing on images.
_LOGO_URL = "https://ptmnow.com/email-logo.png"

# Fixed UTC+5:30 offset, not zoneinfo/"Asia/Kolkata": IST has no daylight
# saving, so a fixed offset is exact — and it sidesteps zoneinfo needing the
# `tzdata` package on Windows (no system IANA database there), which prod
# (Linux) wouldn't hit but this also needs to run under local Windows dev.
_IST = timezone(timedelta(hours=5, minutes=30))


def _send_time_ist() -> str:
    """'7:24 PM' in IST, regardless of the server's own timezone (prod runs
    UTC) — parents are in India, so a UTC timestamp next to the email's own
    received time would look wrong. Built manually rather than via a %-I /
    %#I strftime flag: those aren't portable between the Linux prod server
    and Windows dev machines this also needs to run on."""
    now = datetime.now(_IST)
    hour12 = now.strftime("%I").lstrip("0") or "12"
    return f"{hour12}:{now.strftime('%M %p')}"


def _display_code(code: str) -> str:
    """Purely visual grouping for the email body — '482917' -> '482 917'. The
    stored/verified code (passed to this module and compared elsewhere) is
    never touched; only this rendered copy is spaced."""
    return f"{code[:3]} {code[3:]}"


def _send(to_email: str, subject: str, plain_text_content: str, html_content: str) -> bool:
    """Single choke point for every outbound email. Every email type must
    call this rather than building its own SendGrid Mail/send — that's what
    makes the EMAIL_OVERRIDE_TO redirect below impossible to bypass by
    accident when a new email type (e.g. cancellations) is added later.

    When EMAIL_OVERRIDE_TO is set, every send goes to that address instead
    of `to_email`, no exceptions: the subject is prefixed with the intended
    recipient and a banner naming them is prepended to both bodies. Absent
    (the default) means exactly today's behaviour — real recipient, no
    redirect, ever.
    """
    override_to = os.getenv("EMAIL_OVERRIDE_TO")
    actual_to = to_email
    if override_to:
        actual_to = override_to
        subject = f"[TEST → {to_email}] {subject}"
        plain_text_content = f"[TEST MODE] Intended recipient: {to_email}\n\n" + plain_text_content
        banner_html = (
            '<p style="margin:0 0 16px;padding:10px 14px;background:#FEF3C7;'
            'border:1px solid #FDE68A;border-radius:6px;font-size:13px;'
            "color:#78350F;font-family:-apple-system,BlinkMacSystemFont,"
            "'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">"
            f"TEST MODE — intended recipient: {to_email}</p>"
        )
        html_content = banner_html + html_content
        logger.warning(
            "Email redirected by EMAIL_OVERRIDE_TO: intended %s, actually sent to %s",
            to_email, actual_to,
        )

    message = Mail(
        from_email=(FROM_EMAIL, FROM_NAME),
        to_emails=actual_to,
        subject=subject,
        plain_text_content=plain_text_content,
        html_content=html_content,
    )
    try:
        resp = SendGridAPIClient(_API_KEY).send(message)
    except Exception as exc:  # network error, auth failure, etc.
        logger.error("SendGrid email to %s failed (request error): %s", actual_to, exc)
        return False

    if resp.status_code // 100 == 2:
        logger.info("SendGrid email sent to %s (HTTP %s)", actual_to, resp.status_code)
        return True

    logger.error("SendGrid email to %s failed: HTTP %s", actual_to, resp.status_code)
    return False


_BODY_FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"


def _email_card(inner_html: str) -> str:
    """Wraps arbitrary inner content in the one shared visual shell every PTM
    Now email uses: tinted page background, a white bordered card inset and
    centered, a coral top bar, the hosted logo + wordmark. Every email type
    calls this rather than building its own outer markup, so a design change
    (or a Gmail/Outlook rendering fix) only has to happen in one place.
    Table-based layout throughout — Outlook's Word rendering engine doesn't
    reliably center/size divs, only tables.
    """
    return f"""\
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F4F5;">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border:1px solid #E5E5E5;border-radius:8px;">
        <tr>
          <td style="background:#EE5A52;border-radius:8px 8px 0 0;font-size:4px;line-height:4px;">&nbsp;</td>
        </tr>
        <tr>
          <td style="padding:40px 32px;font-family:{_BODY_FONT};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
              <tr>
                <td align="center">
                  <img src="{_LOGO_URL}" width="32" height="32" alt="" style="display:inline-block;border:0;vertical-align:middle;">
                  <span style="font-size:20px;font-weight:700;color:#18181B;vertical-align:middle;padding-left:8px;">PTM Now</span>
                </td>
              </tr>
            </table>
            {inner_html}
          </td>
        </tr>
      </table>
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
        <tr>
          <td align="center" style="padding:20px 16px 0;font-family:{_BODY_FONT};font-size:12px;line-height:1.5;color:#71717A;">
            PTM Now &middot; Parent-teacher meeting scheduling for Inventure Academy, Bangalore
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
"""


def send_otp_email(to_email: str, name: str, code: str) -> bool:
    """Deliver a login OTP via SendGrid. Returns True on success, False on failure.

    Blocking (uses the sync SendGrid client) — callers in async request handlers
    should invoke this via `asyncio.to_thread(...)` so the event loop isn't blocked.
    """
    # Send time in the subject (not the code) so Gmail stops threading
    # consecutive codes together as one conversation.
    subject = f"Your PTM Now verification code ({_send_time_ist()})"
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

    inner_html = f"""\
            <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#18181B;">Hi {name},</p>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#18181B;">Enter this code to sign in to PTM Now:</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
              <tr>
                <td align="center" style="background:#F7F7F8;border-radius:8px;padding:22px 16px;">
                  <span style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:28px;font-weight:700;letter-spacing:6px;color:#EE5A52;">{display_code}</span>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#3F3F46;">This code expires in 10 minutes and can only be used once.</p>
            <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#18181B;font-weight:700;">Don't share this code with anyone. PTM Now and Inventure Academy will never ask you for it.</p>
            <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#3F3F46;">If you didn't request this, you can safely ignore this email.</p>
            <p style="margin:0;font-size:14px;line-height:1.5;color:#3F3F46;">Thanks,<br>The PTM Now Team</p>"""

    return _send(to_email, subject, plain_text_content, _email_card(inner_html))


def _format_slot_datetime(start_time: datetime) -> str:
    """'Thursday, 9 Apr, 8:10 AM' — identifies which booking a cancellation
    email is about. Uses the datetime's own stored hour/minute/day fields
    directly, with NO timezone conversion: slot times are inserted elsewhere
    in this codebase as naive local (IST) clock values merely labelled UTC
    (see routers/demo.py's PTM_START, "# 08:10 on PTM day"), not real
    UTC instants — the same convention the frontend's `fmt()` relies on.
    Converting via .astimezone() here would silently shift the displayed
    time by 5:30 and make this email wrong. This mirrors _send_time_ist's
    manual, platform-portable hour formatting (no %-d/%-I strftime flags)."""
    day = start_time.strftime("%d").lstrip("0")
    hour12 = start_time.strftime("%I").lstrip("0") or "12"
    return f"{start_time.strftime('%A')}, {day} {start_time.strftime('%b')}, {hour12}:{start_time.strftime('%M %p')}"


def send_cancellation_email(
    to_email: str,
    recipient_name: str,
    recipient_role: str,  # "teacher" or "parent" -- selects subject/closing line
    teacher_name: str,
    teacher_subject: str | None,
    student_name: str,
    section: str | None,
    start_time: datetime,
    cancelled_by: str,  # "the parent" / "the teacher" / "the school" -- never a specific admin's name
) -> bool:
    """Notify the other party in a booking that it was cancelled. Never sent
    to whoever performed the cancellation — callers decide that, this
    function just sends to whoever it's told to. Blocking, same as
    send_otp_email — call via asyncio.to_thread from async handlers."""
    when = _format_slot_datetime(start_time)
    is_teacher = recipient_role == "teacher"
    counterpart = student_name if is_teacher else teacher_name
    subject = f"Your PTM booking with {counterpart} was cancelled"
    closing = (
        "This slot is now free and available for rebooking."
        if is_teacher else
        "You can book another slot if one is available."
    )
    teacher_line = f"{teacher_name} ({teacher_subject})" if teacher_subject else teacher_name
    student_line = f"{student_name} ({section})" if section else student_name

    plain_text_content = (
        f"Hi {recipient_name},\n\n"
        f"The following meeting has been cancelled:\n\n"
        f"Teacher: {teacher_line}\n"
        f"Student: {student_line}\n"
        f"When: {when}\n"
        f"Cancelled by: {cancelled_by}\n\n"
        f"{closing}\n\n"
        f"Thanks,\n"
        f"The PTM Now Team"
    )

    inner_html = f"""\
            <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#18181B;">Hi {recipient_name},</p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#18181B;">The following meeting has been cancelled:</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
              <tr>
                <td style="background:#F7F7F8;border-radius:8px;padding:18px 20px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr><td style="font-size:14px;line-height:1.9;color:#3F3F46;"><strong style="color:#18181B;">Teacher:</strong> {teacher_line}</td></tr>
                    <tr><td style="font-size:14px;line-height:1.9;color:#3F3F46;"><strong style="color:#18181B;">Student:</strong> {student_line}</td></tr>
                    <tr><td style="font-size:14px;line-height:1.9;color:#3F3F46;"><strong style="color:#18181B;">When:</strong> {when}</td></tr>
                    <tr><td style="font-size:14px;line-height:1.9;color:#3F3F46;"><strong style="color:#18181B;">Cancelled by:</strong> {cancelled_by}</td></tr>
                  </table>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#3F3F46;">{closing}</p>
            <p style="margin:0;font-size:14px;line-height:1.5;color:#3F3F46;">Thanks,<br>The PTM Now Team</p>"""

    return _send(to_email, subject, plain_text_content, _email_card(inner_html))
