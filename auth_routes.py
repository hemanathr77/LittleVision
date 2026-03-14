"""
auth_routes.py — Authentication Blueprint
All routes use psycopg2 raw SQL via db.py. No SQLAlchemy.
Includes: signup, login, Google OAuth, forgot/reset password, dashboard.
"""

import os
import random
import string
import logging

import bcrypt as _bcrypt
from flask import (
    Blueprint, render_template, redirect, url_for,
    request, flash, session, jsonify, current_app,
)
from flask_mail import Message

from app import login_required, mail, oauth
import db as database

log = logging.getLogger(__name__)
auth_bp = Blueprint("auth", __name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")


def _check_password(password: str, hashed: str) -> bool:
    return _bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def _generate_code(length=6):
    return "".join(random.choices(string.digits, k=length))


def _send_email(to, subject, body):
    """Send an email. Returns True on success, False on failure. Never crashes."""
    try:
        mail.send(Message(subject=subject, recipients=[to], body=body))
        return True
    except Exception as exc:
        log.warning("Email send failed (%s) — printing to console instead.", exc)
        print(f"\n{'='*60}\n  TO: {to}\n  SUBJECT: {subject}\n\n{body}\n{'='*60}\n")
        return False


def _password_errors(password):
    errors = []
    if len(password) < 8:
        errors.append("At least 8 characters required.")
    if not any(c.isupper() for c in password):
        errors.append("At least one uppercase letter required.")
    if not any(c.islower() for c in password):
        errors.append("At least one lowercase letter required.")
    if not any(c.isdigit() for c in password):
        errors.append("At least one number required.")
    if not any(c in "!@#$%^&*()_+-=[]{}|;':\",./<>?" for c in password):
        errors.append("At least one special character required.")
    return errors


def _is_logged_in():
    return "user_id" in session


# ── Root ──────────────────────────────────────────────────────────────────────

@auth_bp.route("/")
def index():
    if _is_logged_in():
        return redirect(url_for("auth.dashboard"))
    return redirect(url_for("auth.login"))


# ── Signup ────────────────────────────────────────────────────────────────────

@auth_bp.route("/signup", methods=["GET", "POST"])
def signup():
    if _is_logged_in():
        return redirect(url_for("auth.dashboard"))

    if request.method == "POST":
        name             = request.form.get("name", "").strip()
        email            = request.form.get("email", "").strip().lower()
        username         = request.form.get("username", "").strip().lower()
        password         = request.form.get("password", "")
        confirm_password = request.form.get("confirm_password", "")

        errors = []
        if not all([name, email, username, password, confirm_password]):
            errors.append("All fields are required.")
        if password != confirm_password:
            errors.append("Passwords do not match.")
        errors.extend(_password_errors(password))

        if database.get_user_by_email(email):
            errors.append("An account with this email already exists.")
        if database.get_user_by_username(username):
            errors.append("Username is already taken.")

        if errors:
            return jsonify({"success": False, "errors": errors}), 400

        hashed = _hash_password(password)
        user = database.create_user(
            name=name,
            email=email,
            username=username,
            password_hash=hashed,
        )
        session["user_id"] = user["id"]
        session["username"] = user["username"]
        return jsonify({"success": True, "redirect": url_for("auth.dashboard")})

    return render_template("signup.html")


# ── Login ─────────────────────────────────────────────────────────────────────

@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if _is_logged_in():
        return redirect(url_for("auth.dashboard"))

    if request.method == "POST":
        email    = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        remember = request.form.get("remember", False)

        user = database.get_user_by_email(email)

        # Step 1: Check if email exists
        if not user:
            return jsonify({
                "success": False,
                "errors": ["This email is not registered. Please create an account."]
            }), 401

        # Step 2: Verify password
        if not user["password_hash"] or not _check_password(password, user["password_hash"]):
            return jsonify({
                "success": False,
                "errors": ["Incorrect password."]
            }), 401

        # Step 3: Create session and redirect
        session["user_id"] = user["id"]
        session["username"] = user["username"]
        if remember:
            session.permanent = True
        next_page = request.args.get("next")
        return jsonify({"success": True, "redirect": next_page or url_for("auth.dashboard")})

    return render_template("login.html")


# ── Logout ────────────────────────────────────────────────────────────────────

@auth_bp.route("/logout")
@login_required
def logout():
    session.clear()
    return redirect(url_for("auth.login"))


# ── Google OAuth ──────────────────────────────────────────────────────────────

@auth_bp.route("/google-login")
def google_login():
    redirect_uri = url_for("auth.google_callback", _external=True)
    return oauth.google.authorize_redirect(redirect_uri)


@auth_bp.route("/callback")
def google_callback():
    try:
        token     = oauth.google.authorize_access_token()
        user_info = token.get("userinfo") or oauth.google.userinfo()
    except Exception as exc:
        log.error("Google OAuth error: %s", exc)
        flash("Google login failed. Please try again.", "danger")
        return redirect(url_for("auth.login"))

    google_id = user_info.get("sub")
    email     = (user_info.get("email") or "").lower()
    name      = user_info.get("name", "")
    picture   = user_info.get("picture", "")

    # Try to find existing user
    user = database.get_user_by_google_id(google_id)
    if not user:
        user = database.get_user_by_email(email)

    if user:
        updates = {}
        if not user.get("google_id"):
            updates["google_id"] = google_id
        if picture and not user.get("profile_picture"):
            updates["profile_picture"] = picture
        if updates:
            database.update_user_fields(user["id"], updates)
    else:
        # Create new user with auto-generated username
        base = email.split("@")[0]
        uname = base
        i = 1
        while database.get_user_by_username(uname):
            uname = f"{base}{i}"
            i += 1
        user = database.create_user(
            name=name,
            email=email,
            username=uname,
            google_id=google_id,
            profile_picture=picture,
        )

    session["user_id"] = user["id"]
    session["username"] = user["username"]
    return redirect(url_for("auth.dashboard"))


# ── Forgot Password ───────────────────────────────────────────────────────────

@auth_bp.route("/forgot-password", methods=["GET", "POST"])
def forgot_password():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()

        # STEP 1 & 2: Check if email exists
        user = database.get_user_by_email(email)
        if not user:
            return jsonify({
                "success": False,
                "errors": ["Account not found. Please sign up first."]
            }), 404

        # STEP 3: Generate code, store it, send email
        code = _generate_code()
        database.update_user_field(user["id"], "reset_code", code)

        email_sent = _send_email(
            email,
            "LittleVision — Password Reset Code",
            f"Hi {user['name']},\n\nYour verification code is: {code}\n\n"
            f"Enter this code to reset your password.\n\n— LittleVision Team",
        )

        if not email_sent:
            return jsonify({
                "success": False,
                "errors": ["Unable to send reset email. Please try again."]
            }), 500

        # STEP 4: Store email in session and redirect
        session["reset_email"] = email
        return jsonify({"success": True, "redirect": url_for("auth.verify_code")})

    return render_template("forgot_password.html")


# ── Verify Code ───────────────────────────────────────────────────────────────

@auth_bp.route("/verify-code", methods=["GET", "POST"])
def verify_code():
    if "reset_email" not in session:
        return redirect(url_for("auth.forgot_password"))

    if request.method == "POST":
        code = request.form.get("code", "").strip()
        user = database.get_user_by_email(session.get("reset_email"))
        if user and user.get("reset_code") == code:
            session["reset_verified"] = True
            return jsonify({"success": True, "redirect": url_for("auth.reset_password")})
        return jsonify({"success": False, "errors": ["Invalid or expired code."]}), 400

    return render_template("verify_code.html")


# ── Resend Code ───────────────────────────────────────────────────────────────

@auth_bp.route("/resend-code", methods=["POST"])
def resend_code():
    email = session.get("reset_email")
    if not email:
        return jsonify({"success": False, "errors": ["Session expired. Please try again."]}), 400

    user = database.get_user_by_email(email)
    if not user:
        return jsonify({"success": False, "errors": ["Account not found."]}), 404

    code = _generate_code()
    database.update_user_field(user["id"], "reset_code", code)

    email_sent = _send_email(
        email,
        "LittleVision — Password Reset Code",
        f"Hi {user['name']},\n\nYour new verification code is: {code}\n\n"
        f"Enter this code to reset your password.\n\n— LittleVision Team",
    )

    if not email_sent:
        return jsonify({
            "success": False,
            "errors": ["Unable to send reset email. Please try again."]
        }), 500

    return jsonify({"success": True, "message": "A new code has been sent to your email."})


# ── Reset Password ────────────────────────────────────────────────────────────

@auth_bp.route("/reset-password", methods=["GET", "POST"])
def reset_password():
    if not session.get("reset_verified") or "reset_email" not in session:
        return redirect(url_for("auth.forgot_password"))

    if request.method == "POST":
        password = request.form.get("password", "")
        confirm  = request.form.get("confirm_password", "")
        errors   = _password_errors(password)
        if password != confirm:
            errors.append("Passwords do not match.")
        if errors:
            return jsonify({"success": False, "errors": errors}), 400

        email = session.pop("reset_email", None)
        session.pop("reset_verified", None)
        user = database.get_user_by_email(email)
        if user:
            hashed = _hash_password(password)
            database.update_user_fields(user["id"], {
                "password_hash": hashed,
                "reset_code": None,
            })
        return jsonify({"success": True, "redirect": url_for("auth.login")})

    return render_template("reset_password.html")


# ── Dashboard ─────────────────────────────────────────────────────────────────

@auth_bp.route("/dashboard")
@login_required
def dashboard():
    return render_template("dashboard.html")
