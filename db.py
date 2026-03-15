"""
db.py — SQLAlchemy database layer
Full migration from psycopg2 raw queries to Flask-SQLAlchemy for chat history.
"""

import os
import logging
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

log = logging.getLogger(__name__)

db = SQLAlchemy()

# ── Models ───────────────────────────────────────────────────────────────────

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120))
    email = db.Column(db.String(150), unique=True, nullable=False)
    username = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.Text)
    google_id = db.Column(db.Text)
    profile_picture = db.Column(db.Text)
    reset_code = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    conversations = db.relationship('Conversation', backref='user', lazy=True, cascade="all, delete-orphan")
    memories = db.relationship('UserMemory', backref='user', lazy=True, cascade="all, delete-orphan")


class Conversation(db.Model):
    __tablename__ = 'conversations'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.Text, default="New Chat")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    messages = db.relationship('Message', backref='conversation', lazy=True, cascade="all, delete-orphan")


class Message(db.Model):
    __tablename__ = 'messages'
    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey('conversations.id'), nullable=False)
    role = db.Column(db.Text, nullable=False) # 'user' or 'assistant'
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class UserMemory(db.Model):
    __tablename__ = 'user_memory'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    key = db.Column(db.Text, nullable=False)
    value = db.Column(db.Text, nullable=False)


# ── Initialization ───────────────────────────────────────────────────────────

def init_db():
    try:
        db.create_all()
        log.info("Database initialized successfully with SQLAlchemy.")
    except Exception as exc:
        log.warning("Could not connect to PostgreSQL: %s", exc)

# ── Legacy Wrappers for Auth (returning dicts) ───────────────────────────────

def _user_to_dict(user):
    if not user:
        return None
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "username": user.username,
        "password_hash": user.password_hash,
        "google_id": user.google_id,
        "profile_picture": user.profile_picture,
        "reset_code": user.reset_code,
        "created_at": user.created_at
    }

def get_user_by_id(user_id):
    return _user_to_dict(User.query.get(user_id))

def get_user_by_email(email):
    return _user_to_dict(User.query.filter_by(email=email).first())

def get_user_by_username(username):
    return _user_to_dict(User.query.filter_by(username=username).first())

def get_user_by_google_id(google_id):
    return _user_to_dict(User.query.filter_by(google_id=google_id).first())

def create_user(name, email, username, password_hash=None, google_id=None, profile_picture=None):
    user = User(
        name=name, email=email, username=username,
        password_hash=password_hash, google_id=google_id, profile_picture=profile_picture
    )
    db.session.add(user)
    db.session.commit()
    return _user_to_dict(user)

def update_user_field(user_id, field, value):
    user = User.query.get(user_id)
    if user:
        setattr(user, field, value)
        db.session.commit()

def update_user_fields(user_id, updates: dict):
    user = User.query.get(user_id)
    if user:
        for key, value in updates.items():
            setattr(user, key, value)
        db.session.commit()
