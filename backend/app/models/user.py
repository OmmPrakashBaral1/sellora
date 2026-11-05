from sqlalchemy import (
    Column,
    BigInteger,
    String,
    TIMESTAMP,
    UniqueConstraint
)

from app.database import Base


class User(Base):
    __tablename__ = "users"

    __table_args__ = (
        UniqueConstraint(
            "gmail",
            name="uq_users_gmail"
        ),
    )

    id = Column(BigInteger, primary_key=True)
    name = Column(String(50), nullable=False)
    gmail = Column(String(50), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)
    created_at = Column(TIMESTAMP)
    updated_at = Column(TIMESTAMP)