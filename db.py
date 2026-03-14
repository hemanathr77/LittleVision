"""
db.py — PostgreSQL database layer using psycopg2
No SQLAlchemy. Direct connection pool + helper functions.
"""

import os
import logging
import psycopg2
import psycopg2.pool
import psycopg2.extras

log = logging.getLogger(__name__)
_pool = None


def get_pool():
    """Return the global connection pool, creating it if needed."""
    global _pool
    if _pool is None:
        database_url = os.getenv(
            "DATABASE_URL",
            "postgresql://postgres:password@localhost:5432/littlevision",
        )
        _pool = psycopg2.pool.SimpleConnectionPool(1, 10, database_url)
    return _pool


def get_conn():
    """Get a connection from the pool."""
    return get_pool().getconn()


def put_conn(conn):
    """Return a connection to the pool."""
    get_pool().putconn(conn)


def init_db():
    """Create the users table if it does not exist, and run migrations."""
    try:
        conn = get_conn()
        try:
            with conn.cursor() as cur:
                # Create table if not exists
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id              SERIAL PRIMARY KEY,
                        name            VARCHAR(120),
                        email           VARCHAR(150) UNIQUE NOT NULL,
                        username        VARCHAR(100) UNIQUE NOT NULL,
                        password_hash   TEXT,
                        google_id       TEXT,
                        profile_picture TEXT,
                        reset_code      TEXT,
                        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """)

                # Migration: rename full_name → name if old schema exists
                cur.execute("""
                    SELECT column_name FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'full_name';
                """)
                if cur.fetchone():
                    cur.execute("ALTER TABLE users RENAME COLUMN full_name TO name;")
                    log.info("Migrated column full_name → name.")

            conn.commit()
            log.info("Database initialized successfully.")
        finally:
            put_conn(conn)
    except Exception as exc:
        log.warning(
            "Could not connect to PostgreSQL: %s\n"
            "  ➜ Make sure PostgreSQL is running and DATABASE_URL in .env is correct.\n"
            "  ➜ The app will start, but routes requiring the database will fail.",
            exc,
        )


# ── Query helpers ────────────────────────────────────────────────────────────


def _fetch_one(query, params=None):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, params)
            return cur.fetchone()
    finally:
        put_conn(conn)


def _execute(query, params=None):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, params)
            conn.commit()
            try:
                return cur.fetchone()
            except psycopg2.ProgrammingError:
                return None
    finally:
        put_conn(conn)


# ── User queries ─────────────────────────────────────────────────────────────


def get_user_by_id(user_id):
    return _fetch_one("SELECT * FROM users WHERE id = %s", (user_id,))


def get_user_by_email(email):
    return _fetch_one("SELECT * FROM users WHERE email = %s", (email,))


def get_user_by_username(username):
    return _fetch_one("SELECT * FROM users WHERE username = %s", (username,))


def get_user_by_google_id(google_id):
    return _fetch_one("SELECT * FROM users WHERE google_id = %s", (google_id,))


def create_user(name, email, username, password_hash=None, google_id=None, profile_picture=None):
    return _execute(
        """INSERT INTO users (name, email, username, password_hash, google_id, profile_picture)
           VALUES (%s, %s, %s, %s, %s, %s) RETURNING *""",
        (name, email, username, password_hash, google_id, profile_picture),
    )


def update_user_field(user_id, field, value):
    """Update a single column for a user. Field name is validated against an allow-list."""
    allowed = {"name", "email", "username", "password_hash", "google_id",
               "profile_picture", "reset_code"}
    if field not in allowed:
        raise ValueError(f"Field '{field}' is not allowed")
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(f"UPDATE users SET {field} = %s WHERE id = %s", (value, user_id))
        conn.commit()
    finally:
        put_conn(conn)


def update_user_fields(user_id, updates: dict):
    """Update multiple columns at once."""
    allowed = {"name", "email", "username", "password_hash", "google_id",
               "profile_picture", "reset_code"}
    for key in updates:
        if key not in allowed:
            raise ValueError(f"Field '{key}' is not allowed")

    set_clause = ", ".join(f"{k} = %s" for k in updates)
    values = list(updates.values()) + [user_id]
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(f"UPDATE users SET {set_clause} WHERE id = %s", values)
        conn.commit()
    finally:
        put_conn(conn)
