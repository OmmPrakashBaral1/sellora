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

class Payment(Base):
    __tablename__= "payments"

    id = Column(BigInteger, primary_key=True, index=True)

    order_id = Column(
        BigInteger,
        ForeignKey("orders.id"),
        nullable=False,
        index=True
    )

    amount = Column(Numeric(10, 2), nullable=False)

    provider = Column(String(30), nullable=False, default="RAZORPAY")

    razorpay_order_id = Column(String(100), unique=True, nullable=True)

    razorpay_payment_id = Column(String(100), unique=True, nullable=True)

    status = Column(String(20), nullable=False, default="PENDING")

    created_at = Column(TIMESTAMP, server_default=func.now())

    updated_at = Column(
        TIMESTAMP,
        server_default=func.now(),
        onupdate=func.now()
    )

    order = relationship("Order")