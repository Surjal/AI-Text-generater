import secrets
import os

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY") or secrets.token_hex(32)
    # Default admin password for initial setup. In production, this should be set in environment variables.
    ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD") or "admin123"
    DATABASE_PATH = os.path.join(os.path.dirname(__file__), "summarizer.db")
    TOKEN_EXPIRATION_HOURS = 24
