
from sqlalchemy import Column, BigInteger, String, Text, TIMESTAMP, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class SellerProfile(Base):
    __tablename__ = "seller_profiles"

    id = Column(BigInteger, primary_key=True, nullable=False)

    user_id = Column(
        BigInteger,
        ForeignKey("users.id"),
        nullable=False,
        unique=True
    )

    store_name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP)

    user = relationship("User")
