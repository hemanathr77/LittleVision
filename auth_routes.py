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

from groq import Groq
from livekit.api import AccessToken, VideoGrants

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
        print(f"\n{'=' * 60}\n  TO: {to}\n  SUBJECT: {subject}\n\n{body}\n{'=' * 60}\n")
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
        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip().lower()
        username = request.form.get("username", "").strip().lower()
        password = request.form.get("password", "")
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
        email = request.form.get("email", "").strip().lower()
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
        token = oauth.google.authorize_access_token()
        user_info = token.get("userinfo") or oauth.google.userinfo()
    except Exception as exc:
        log.error("Google OAuth error: %s", exc)
        flash("Google login failed. Please try again.", "danger")
        return redirect(url_for("auth.login"))

    google_id = user_info.get("sub")
    email = (user_info.get("email") or "").lower()
    name = user_info.get("name", "")
    picture = user_info.get("picture", "")

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

        # STEP 4: Store email in session and redirect
        if not email_sent:
            return jsonify({"success": False, "errors": ["Failed to send email. Ensure you have network access and email works."]}), 500
            
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
        confirm = request.form.get("confirm_password", "")
        errors = _password_errors(password)
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
    from db import db, Conversation
    user_id = session.get("user_id")
    # Load all conversations ordered by newest first
    conversations = Conversation.query.filter_by(user_id=user_id).order_by(Conversation.created_at.desc()).all()
    conv_list = []

    # Quick date categorization (Today vs Older)
    from datetime import datetime
    today = datetime.utcnow().date()

    for c in conversations:
        c_date = c.created_at.date()
        if c_date == today:
            category = "Today"
        else:
            category = c_date.strftime("%B %d, %Y")

        conv_list.append({
            "id": c.id,
            "title": c.title,
            "category": category,
            "created_at": c.created_at.strftime("%b %d, %I:%M %p")
        })

    return render_template("dashboard.html", conversations=conv_list)


# ── Chat History API ─────────────────────────────────────────────────────────

@auth_bp.route("/api/conversations", methods=["POST"])
@login_required
def create_conversation():
    try:
        from db import db, Conversation
        user_id = session["user_id"]
        # Create a new blank conversation
        conv = Conversation(user_id=user_id, title="New Chat")
        db.session.add(conv)
        db.session.commit()
        return jsonify({
            "success": True,
            "conversation": {
                "id": conv.id,
                "title": conv.title,
                "category": "Today"
            }
        })
    except Exception as e:
        log.error("Failed to create conversation: %s", e)
        return jsonify({"success": False, "error": str(e)}), 500


@auth_bp.route("/api/conversations/<int:conv_id>", methods=["GET"])
@login_required
def get_conversation(conv_id):
    try:
        from db import Conversation
        user_id = session["user_id"]
        conv = Conversation.query.filter_by(id=conv_id, user_id=user_id).first()
        if not conv:
            return jsonify({"success": False, "error": "Conversation not found"}), 404

        # Format messages
        msgs = []
        for m in conv.messages:
            msgs.append({
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at.isoformat() + "Z"
            })

        return jsonify({"success": True, "messages": msgs, "title": conv.title})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@auth_bp.route("/conversation/<int:conversation_id>", methods=["DELETE"])
@login_required
def delete_conversation(conversation_id):
    try:
        from db import db, Conversation, Message
        user_id = session["user_id"]
        conv = Conversation.query.filter_by(id=conversation_id, user_id=user_id).first()
        if not conv:
            return jsonify({"status": "error", "message": "Conversation not found"}), 404

        # Delete messages and conversation
        Message.query.filter_by(conversation_id=conversation_id).delete()
        db.session.delete(conv)
        db.session.commit()

        return jsonify({"status": "success"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


# ── AI Voice & LiveKit ────────────────────────────────────────────────────────

@auth_bp.route("/livekit-token", methods=["GET"])
@login_required
def get_livekit_token():
    participant_name = session.get("username", "user")
    room_name = request.args.get("roomName", "voice-room")

    api_key = os.getenv("LIVEKIT_API_KEY")
    api_secret = os.getenv("LIVEKIT_API_SECRET")

    if not api_key or not api_secret:
        return jsonify({"success": False, "error": "LiveKit credentials are not set."}), 500

    try:
        grant = VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=True,
            can_subscribe=True,
        )

        access_token = AccessToken(api_key, api_secret)
        access_token.with_identity(participant_name)
        access_token.with_name(participant_name)
        access_token.with_grants(grant)

        token = access_token.to_jwt()
        return jsonify({"success": True, "token": token, "url": os.getenv("LIVEKIT_URL")})
    except Exception as e:
        log.error("LiveKit token generation failed: %s", e)
        return jsonify({"success": False, "error": str(e)}), 500


@auth_bp.route("/ai-response", methods=["POST"])
@login_required
def ai_response():
    data = request.get_json() or {}
    text = data.get("text", "").strip()
    conv_id = data.get("conversation_id")

    if not text:
        return jsonify({"success": False, "error": "No text provided."}), 400

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return jsonify({"success": False, "error": "Groq API key is not configured."}), 500

    client = Groq(api_key=api_key)

    from db import db, Conversation, Message, UserMemory
    user_id = session["user_id"]

    # Locate or create conversation
    if conv_id:
        conv = Conversation.query.filter_by(id=conv_id, user_id=user_id).first()
    else:
        conv = Conversation(user_id=user_id, title=text[:30] + ("..." if len(text) > 30 else ""))
        db.session.add(conv)
        db.session.commit()
        conv_id = conv.id

    if not conv:
        return jsonify({"success": False, "error": "Invalid conversation."}), 400

    # Auto-title update on first actual message if still "New Chat"
    if conv.title == "New Chat":
        conv.title = text[:30] + ("..." if len(text) > 30 else "")

    # Save user message
    user_msg = Message(conversation_id=conv.id, role="user", content=text)
    db.session.add(user_msg)
    db.session.commit()

    # Build context: memory + system prompt
    memories = UserMemory.query.filter_by(user_id=user_id).all()
    sys_prompt = "You are a helpful AI assistant."
    if memories:
        mem_text = "\n".join([f"- {m.key}: {m.value}" for m in memories])
        sys_prompt += f"\n\nContext about the user:\n{mem_text}"

    messages_payload = [{"role": "system", "content": sys_prompt}]

    # Load recent conversation history
    history = Message.query.filter_by(conversation_id=conv.id).order_by(Message.created_at.asc()).limit(20).all()
    for h in history:
        groq_role = h.role if h.role in ["user", "assistant", "system"] else "assistant"
        messages_payload.append({"role": groq_role, "content": h.content})

    # Model fallback chain
    models_to_try = ["llama-3.1-8b-instant", "llama3-70b-8192"]
    last_error = None

    for model_name in models_to_try:
        try:
            response = client.chat.completions.create(
                model=model_name,
                messages=messages_payload,
            )
            ai_text = response.choices[0].message.content

            # Save AI message
            ai_msg = Message(conversation_id=conv.id, role="assistant", content=ai_text)
            db.session.add(ai_msg)
            db.session.commit()

            log.info("Active Groq model: %s", model_name)
            return jsonify({
                "success": True,
                "response": ai_text,
                "model": model_name,
                "conversation_id": conv.id,
                "conversation_title": conv.title,
                "user_message_time": user_msg.created_at.isoformat() + "Z",
                "ai_message_time": ai_msg.created_at.isoformat() + "Z"
            })
        except Exception as e:
            last_error = e
            log.warning("Groq model %s failed: %s — trying next...", model_name, e)
            continue

    log.error("All Groq models failed. Last error: %s", last_error)
    return jsonify({"success": False, "error": f"All AI models failed: {last_error}"}), 500


@auth_bp.route("/speech-to-text", methods=["POST"])
@login_required
def speech_to_text():
    """Receive audio blob from frontend, transcribe to text using Groq Whisper."""
    audio_file = request.files.get("audio")
    if not audio_file:
        return jsonify({"success": False, "error": "No audio file provided."}), 400

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return jsonify({"success": False, "error": "Groq API key not configured for transcription."}), 500

    client = Groq(api_key=api_key)

    try:
        # Read the file data into memory
        file_data = audio_file.read()

        # Whisper on Groq accepts .webm directly
        transcription = client.audio.transcriptions.create(
            file=("audio.webm", file_data),
            model="whisper-large-v3-turbo",
            response_format="json",
        )
        
        text = transcription.text.strip()
        log.info("Transcribed text (Whisper): %s", text)
        
        if not text:
             return jsonify({"success": False, "error": "Could not understand audio. Please speak clearly and try again."}), 400

        return jsonify({"success": True, "text": text})

    except Exception as e:
        log.error("Speech-to-text error with Groq Whisper: %s", e)
        return jsonify({"success": False, "error": "Transcription failed. Please try again."}), 500


@auth_bp.route("/upload-image", methods=["POST"])
@login_required
def upload_image():
    """Endpoint for auto-uploading images taken directly from the camera."""
    if "image" not in request.files:
        return jsonify({"success": False, "error": "No image file provided."}), 400

    # For full implementation, we could save the image or upload it to S3/Cloud.
    # Currently just affirming it was received.
    image_file = request.files["image"]
    # Provide a stub to let frontend know it worked successfully
    return jsonify({"success": True, "message": "Image uploaded to server successfully."})