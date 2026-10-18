import secrets
import hashlib
from fastapi import FastAPI, Depends, HTTPException
from fastapi import status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pwdlib import PasswordHash

from database import engine, get_db, Base
from models import User, UserSession
from schemas import UserCreate, UserLogin, RefreshRequest

import os
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
import jwt

app = FastAPI(title="Sellora API")

# 2. Load environment variables
load_dotenv()

# Bearer token configuration
security = HTTPBearer()

# 3. JWT configuration
SECRET_KEY = os.getenv("SECRET_KEY")

if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is missing from the .env file.")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

Base.metadata.create_all(bind=engine)


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

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials

    try:
        payload= jwt.decode(
            token,
            SECRET_KEY,
            algorithms= [ALGORITHM]
        )

        user_id = int(payload["sub"])
        session_id = int(payload["sid"])
    except(jwt.InvalidTokenError,KeyError, TypeError, ValueError):
        raise HTTPException(
            status_code=401,
            detail= "Invalid or expired access token",
            headers= {"WWW- Authenticate": "Bearer"}
        )
    now= datetime.now(timezone.utc)

      # Check that this specific login session is still active.
    active_session = db.query(UserSession).filter(
        UserSession.id == session_id,
        UserSession.user_id == user_id,
        UserSession.revoked_at.is_(None),
        UserSession.expires_at > now
    ).first()

    if active_session is None:
        raise HTTPException(
            status_code=401,
            detail="Session Expired or revoked"
        )
    user = db.query(User).filter(User.id == user_id).first()

    if user is None:
        raise HTTPException(
            status_code= 401,
            detail="User not found!",
            headers={"WWW-Authenticate": "Bearer"}
        )
    return user

def create_refresh_token():
    return secrets.token_urlsafe(48)

def hash_refresh_token(token: str):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def create_user_session(db: Session, user_id: int):
    refresh_token = create_refresh_token()

    expires_at = datetime.now(timezone.utc) + timedelta(
        days = REFRESH_TOKEN_EXPIRE_DAYS
    )

    session = UserSession(
        user_id = user_id,
        refresh_token_hash = hash_refresh_token(refresh_token),
        expires_at = expires_at
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return session, refresh_token


password_hash = PasswordHash.recommended()


@app.get("/")
def home():
    return {"message": "Welcome to Sellora API"}


@app.get("/health")
def health_check():
    with engine.connect():
        return {"status": "Database connection successful"}


@app.get("/users")
def get_users(db: Session = Depends(get_db)):
    users = db.query(User).all()

    return [
        {
            "id": user.id,
            "name": user.name,
            "gmail": user.gmail,
            "role": user.role
        }
        for user in users
    ]

@app.post("/users", status_code=201)
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

@app.post("/login")
def user_login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.gmail == credentials.gmail
    ).first()
    print(user)

    if user is None:
        raise HTTPException(
            status_code= 401,
            detail="Invalid gmail or password"
        )
    print("Password matches:", password_hash.verify(
    credentials.password,
    user.password_hash
))
    if not password_hash.verify(
        credentials.password,
        user.password_hash
    ):
      raise HTTPException(
        status_code= 401,
        detail = "Invalid gmail or password"
      )
    session, refresh_token = create_user_session(db, user.id)
    access_token = create_access_token(user.id, session.id)
    return {
        "access_token" : access_token, #generates a token for the authenticated user
        "refresh_token": refresh_token,
        "session_id": session.id,
        "token_type" : "bearer",
        "message" : "Login Successful!",
        "id" : user.id,
        "name" : user.name,
        "gmail" : user.gmail,
        "role" : user.role
    }


@app.post("/refresh")
def refresh_access_token(
    credentials: RefreshRequest,
    db: Session = Depends(get_db)):

    now = datetime.now(timezone.utc)

    token_hash = hash_refresh_token(credentials.refresh_token)

    session = db.query(UserSession).filter(
        UserSession.refresh_token_hash == token_hash,
        UserSession.revoked_at.is_(None),
        UserSession.expires_at > now
    ).first()

    if session is None:
        raise HTTPException(
            status_code= 401,
            detail= "Invalid or expired refresh token"
        )
    #creating a replacement refresh token
    new_refresh_token = create_refresh_token()
    new_refresh_hash = hash_refresh_token(new_refresh_token)

    # Rotate the token atomically so concurrent requests
    # cannot both successfully reuse the old token.


    # Optimistic Concurrency Control.
    try:
        result = db.query(UserSession).filter(
            UserSession.id == session.id,
            UserSession.refresh_token_hash == token_hash,
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > now
        ).update(
            {
                UserSession.refresh_token_hash: new_refresh_hash,
                UserSession.expires_at: now + timedelta(days = REFRESH_TOKEN_EXPIRE_DAYS)
            },
            synchronize_session= False
        )
        if result != 1:
            raise HTTPException(
                status_code= 401,
                detail= "Refresh token already used or expired"
            )
        db.commit()

    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code= 500,
            detail= "Unable to refresh session"
        )
     # Issue a new access token for the same user and session.
    access_token = create_access_token(
        session.user_id,
        session.id
    )

    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }

@app.get("/me")
def read_my_profile(
    current_user: User = Depends(get_current_user)
    ):
   return{
    "id": current_user.id,
    "name": current_user.name,
    "gmail": current_user.gmail,
    "role": current_user.role
   }

@app.post("/logout")
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    token = credentials.credentials

    payload = jwt.decode(
        token,
        SECRET_KEY,
        algorithms= [ALGORITHM]
    )

    session_id = int(payload["sid"])

    active_session = db.query(UserSession).filter(
        UserSession.id == session_id,
        UserSession.user_id == current_user.id,
        UserSession.revoked_at.is_(None)
    ).first()

    if active_session is None:
        raise HTTPException(
            status_code= 401,
            detail= "Session already revoked"
        )

    active_session.revoked_at = datetime.now(timezone.utc)

    db.commit()

    return {"message": "Logged out successfully"}