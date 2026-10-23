from datetime import datetime, timezone

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, UserSession
from app.services.auth import SECRET_KEY, ALGORITHM

security = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = int(payload["sub"])
        session_id = int(payload["sid"])

    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    now = datetime.now(timezone.utc)

    active_session = db.query(UserSession).filter(
        UserSession.id == session_id,
        UserSession.user_id == user_id,
        UserSession.revoked_at.is_(None),
        UserSession.expires_at > now
    ).first()

    if active_session is None:
        raise HTTPException(
            status_code=401,
            detail="Session expired or revoked"
        )

    user = db.query(User).filter(User.id == user_id).first()

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"}
        )

    return user

def require_role(required_role: str):
    def role_checker(
        current_user: User = Depends(get_current_user)
    ):
        if current_user.role != required_role:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to perform this action"
            )
        return current_user

    return role_checker