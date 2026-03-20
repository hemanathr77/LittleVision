"""
email_utils.py — Email Utility using SendGrid Web API
"""
import os
import logging
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

log = logging.getLogger(__name__)

def send_email(to_email, subject, html_content):
    """
    Sends an email using the SendGrid Web API.
    Returns True on success, False on failure.
    """
    api_key = os.getenv("SENDGRID_API_KEY")
    if not api_key:
        log.error("SENDGRID_API_KEY environment variable is not set. Cannot send email.")
        return False

    sender_email = os.getenv("MAIL_DEFAULT_SENDER", "noreply@littlevision.ai")

    message = Mail(
        from_email=sender_email,
        to_emails=to_email,
        subject=subject,
        html_content=html_content
    )

    try:
        log.info("Sending email to %s via SendGrid API", to_email)
        sg = SendGridAPIClient(api_key)
        response = sg.send(message)
        log.info("Email sent successfully to %s. Status code: %s", to_email, response.status_code)
        return True
    except Exception as e:
        log.error("Email send FAILED to %s using SendGrid: %s", to_email, str(e), exc_info=True)
        return False
