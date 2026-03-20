"""
app/__init__.py — LittleVision Application Factory
Uses psycopg2 via db.py, session-based auth, Google OAuth via authlib, Flask-Mail.
"""

import os
from functools import wraps
from flask import Flask, session, redirect, url_for, g, request
from authlib.integrations.flask_client import OAuth
from dotenv import load_dotenv

load_dotenv()

oauth = OAuth()

def login_required(f):
    """Custom decorator — replaces Flask-Login."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            return redirect(url_for("auth.login", next=request.url))
        return f(*args, **kwargs)
    return decorated


def create_app() -> Flask:
    app = Flask(
        __name__,
        template_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'templates'),
        static_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'static'),
    )

    # ── Config ───────────────────────────────────────────────────────────────
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-change-me")

    # Session
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    if os.environ.get("RENDER"):
        app.config["SESSION_COOKIE_SECURE"] = True

    from werkzeug.middleware.proxy_fix import ProxyFix
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

    # Google OAuth
    app.config["GOOGLE_CLIENT_ID"]     = os.getenv("GOOGLE_CLIENT_ID")
    app.config["GOOGLE_CLIENT_SECRET"] = os.getenv("GOOGLE_CLIENT_SECRET")

    # ── Init extensions ──────────────────────────────────────────────────────
    oauth.init_app(app)

    # Register Google OAuth provider
    if app.config["GOOGLE_CLIENT_ID"] and app.config["GOOGLE_CLIENT_SECRET"]:
        oauth.register(
            name="google",
            client_id=app.config["GOOGLE_CLIENT_ID"],
            client_secret=app.config["GOOGLE_CLIENT_SECRET"],
            server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
            client_kwargs={"scope": "openid email profile"},
        )

    # ── Init database ────────────────────────────────────────────────────────
    db_url = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/littlevision")
    if db_url and db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    
    app.config["SQLALCHEMY_DATABASE_URI"] = db_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    from db import db, init_db
    db.init_app(app)
    
    with app.app_context():
        init_db()

    # ── Load current user into g for templates ───────────────────────────────
    from db import get_user_by_id

    @app.before_request
    def load_current_user():
        user_id = session.get("user_id")
        if user_id:
            g.user = get_user_by_id(user_id)
        else:
            g.user = None

    @app.context_processor
    def inject_user():
        return {"current_user": g.get("user")}

    # ── Register blueprint ───────────────────────────────────────────────────
    from auth_routes import auth_bp
    app.register_blueprint(auth_bp)

    return app