
from sqlalchemy import (
    Column,
    BigInteger,
    Numeric,
    String,
    ForeignKey,
    TIMESTAMP,
    func
)
from sqlalchemy.orm import relationship

from app.database import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(BigInteger, primary_key=True, index=True)

    buyer_id = Column(
        BigInteger,
        ForeignKey("users.id"),
        nullable=False
    )

    total_amount = Column(Numeric(10, 2), nullable=False)
    status = Column(String, nullable=False)

    created_at = Column(
        TIMESTAMP,
        server_default=func.now()
    )

    updated_at = Column(
        TIMESTAMP,
        server_default=func.now(),
        onupdate=func.now()
    )

    items = relationship("OrderItem", back_populates="order")
