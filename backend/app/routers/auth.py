
import jwt
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timedelta, timezone

from app.schemas import RefreshRequest
from app.services.auth import REFRESH_TOKEN_EXPIRE_DAYS, SECRET_KEY, ALGORITHM
from app.services.auth import (
    create_refresh_token,
    hash_refresh_token,
    create_access_token,
    create_user_session,
    REFRESH_TOKEN_EXPIRE_DAYS
)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pwdlib import PasswordHash

from app.database import get_db
from app.models import User, UserSession
from app.schemas import UserCreate, UserLogin
from app.dependencies.auth import get_current_user


router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer()
password_hash = PasswordHash.recommended()


@router.post("/register", status_code=201)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(
        User.gmail == user.gmail
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="Email already registered"
        )

    hashed_password = password_hash.hash(user.password)

    new_user = User(
        name=user.name,
        gmail=user.gmail,
        password_hash=hashed_password,
        role="BUYER"
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "id": new_user.id,
        "name": new_user.name,
        "gmail": new_user.gmail,
        "role": new_user.role
    }


@router.post("/login")
def user_login(
    credentials: UserLogin,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.gmail == credentials.gmail
    ).first()

    if user is None or not password_hash.verify(
        credentials.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid gmail or password"
        )

    session, refresh_token = create_user_session(db, user.id)

    access_token = create_access_token(user.id, session.id)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "session_id": session.id,
        "token_type": "bearer",
        "message": "Login Successful!",
        "id": user.id,
        "name": user.name,
        "gmail": user.gmail,
        "role": user.role
    }

@router.post("/refresh")
def refresh_access_token(
    credentials: RefreshRequest,
    db: Session = Depends(get_db)
):
    now = datetime.now(timezone.utc)

    token_hash = hash_refresh_token(credentials.refresh_token)

    session = db.query(UserSession).filter(
        UserSession.refresh_token_hash == token_hash,
        UserSession.revoked_at.is_(None),
        UserSession.expires_at > now
    ).first()

    if session is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired refresh token"
        )

    new_refresh_token = create_refresh_token()
    new_refresh_hash = hash_refresh_token(new_refresh_token)

    try:
        result = db.query(UserSession).filter(
            UserSession.id == session.id,
            UserSession.refresh_token_hash == token_hash,
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > now
        ).update(
            {
                UserSession.refresh_token_hash: new_refresh_hash,
                UserSession.expires_at: now + timedelta(
                    days=REFRESH_TOKEN_EXPIRE_DAYS
                )
            },
            synchronize_session=False
        )

        if result != 1:
            raise HTTPException(
                status_code=401,
                detail="Refresh token already used or expired"
            )

        db.commit()

    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to refresh session"
        )

    access_token = create_access_token(
        session.user_id,
        session.id
    )

    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }

@router.post("/logout")
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )
        session_id = int(payload["sid"])
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired access token"
        )

    active_session = db.query(UserSession).filter(
        UserSession.id == session_id,
        UserSession.user_id == current_user.id,
        UserSession.revoked_at.is_(None)
    ).first()

    if active_session is None:
        raise HTTPException(
            status_code=401,
            detail="Session already revoked"
        )

    active_session.revoked_at = datetime.now(timezone.utc)
    db.commit()

    return {"message": "Logged out successfully"}