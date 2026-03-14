"""
auth.py — Simple JWT authentication service with SQLite user storage.
"""

import hashlib
import hmac
import json
import logging
import os
import secrets
import sqlite3
import time
from pathlib import Path

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).resolve().parent.parent.parent / "scrollsense.db"
JWT_SECRET = os.environ.get("JWT_SECRET", "scrollsense-hackathon-secret-2026")
TOKEN_EXPIRY = 60 * 60 * 24 * 7  # 7 days


def _get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at REAL NOT NULL
        )
    """)
    conn.commit()
    return conn


def _hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return f"{salt}:{h.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    salt, hash_hex = stored.split(":")
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return hmac.compare_digest(h.hex(), hash_hex)


def _create_token(user_id: int, email: str, name: str) -> str:
    """Create a simple base64-encoded JWT-like token."""
    import base64

    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user_id,
        "email": email,
        "name": name,
        "exp": time.time() + TOKEN_EXPIRY,
    }

    h = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("=")
    p = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")

    signing_input = f"{h}.{p}"
    sig = hmac.new(JWT_SECRET.encode(), signing_input.encode(), hashlib.sha256).digest()
    s = base64.urlsafe_b64encode(sig).decode().rstrip("=")

    return f"{h}.{p}.{s}"


def verify_token(token: str) -> dict | None:
    """Verify token and return payload or None."""
    import base64

    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None

        h, p, s = parts

        # Verify signature
        signing_input = f"{h}.{p}"
        expected_sig = hmac.new(JWT_SECRET.encode(), signing_input.encode(), hashlib.sha256).digest()
        expected_s = base64.urlsafe_b64encode(expected_sig).decode().rstrip("=")

        if not hmac.compare_digest(s, expected_s):
            return None

        # Decode payload
        padding = 4 - len(p) % 4
        payload = json.loads(base64.urlsafe_b64decode(p + "=" * padding))

        # Check expiry
        if payload.get("exp", 0) < time.time():
            return None

        return payload
    except Exception:
        return None


def register_user(email: str, name: str, password: str) -> dict:
    """Register a new user. Returns {token, user} or raises ValueError."""
    email = email.strip().lower()
    name = name.strip()

    if not email or not name or not password:
        raise ValueError("All fields are required.")

    if len(password) < 4:
        raise ValueError("Password must be at least 4 characters.")

    db = _get_db()
    try:
        db.execute(
            "INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)",
            (email, name, _hash_password(password), time.time()),
        )
        db.commit()
        user_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
    except sqlite3.IntegrityError:
        raise ValueError("An account with this email already exists.")
    finally:
        db.close()

    token = _create_token(user_id, email, name)
    return {"token": token, "user": {"id": user_id, "email": email, "name": name}}


def login_user(email: str, password: str) -> dict:
    """Login a user. Returns {token, user} or raises ValueError."""
    email = email.strip().lower()

    db = _get_db()
    try:
        row = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    finally:
        db.close()

    if not row:
        raise ValueError("Invalid email or password.")

    if not _verify_password(password, row["password_hash"]):
        raise ValueError("Invalid email or password.")

    token = _create_token(row["id"], row["email"], row["name"])
    return {"token": token, "user": {"id": row["id"], "email": row["email"], "name": row["name"]}}
