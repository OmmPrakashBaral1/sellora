from sqlalchemy.orm import Session
from app.models import UserSession

from datetime import datetime, timedelta, timezone
import secrets
import hashlib
import os
import jwt

from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")

if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is missing from the .env file.")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

def create_refresh_token():
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def create_access_token(user_id: int, session_id: int):
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(user_id),
        "sid": str(session_id),
        "exp": expire
    }

    token = jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return token

def create_user_session(db: Session, user_id: int):
    refresh_token = create_refresh_token()

    expires_at = datetime.now(timezone.utc) + timedelta(
        days=REFRESH_TOKEN_EXPIRE_DAYS
    )

    session = UserSession(
        user_id=user_id,
        refresh_token_hash=hash_refresh_token(refresh_token),
        expires_at=expires_at
    )

    db.add(session)
    db.commit()
    db.refresh(session)

    return session, refresh_token