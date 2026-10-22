from sqlalchemy import ForeignKey, Text, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy import Column, Integer, BigInteger, String, TIMESTAMP, func
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger,primary_key= True)
    name = Column(String(50), nullable=False)
    gmail = Column(String(50), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)
    created_at = Column(TIMESTAMP)
    updated_at = Column(TIMESTAMP)


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(BigInteger, primary_key= True, index=True)
    user_id = Column(
        BigInteger,
        ForeignKey("users.id"),
        nullable=False,
        index= True
        )
    refresh_token_hash = Column(Text, nullable=False, unique=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=True,
        server_default= func.now()
        )
    user = relationship("User")