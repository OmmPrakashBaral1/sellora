
from sqlalchemy import (
    Column,
    BigInteger,
    Numeric,
    String,
    ForeignKey,
    TIMESTAMP,
    UniqueConstraint,
    func
)
from sqlalchemy.orm import relationship

from app.database import Base


class SellerOrder(Base):
    __tablename__ = "seller_orders"

    __table_args__ = (
        UniqueConstraint(
            "order_id",
            "seller_id",
            name="uq_seller_orders_order_id_seller_id"
        ),
    )

    id = Column(BigInteger, primary_key=True, index=True)

    order_id = Column(
        BigInteger,
        ForeignKey("orders.id"),
        nullable=False,
        index=True
    )

    seller_id = Column(
        BigInteger,
        ForeignKey("seller_profiles.id"),
        nullable=False,
        index=True
    )

    subtotal = Column(Numeric(10, 2), nullable=False)

    commission_rate = Column(Numeric(5, 2), nullable=False)

    commission_amount = Column(Numeric(10, 2), nullable=False)

    seller_earning = Column(Numeric(10, 2), nullable=False)

    status = Column(String(20), nullable=False, default="PENDING")

    created_at = Column(
        TIMESTAMP,
        server_default=func.now()
    )

    updated_at = Column(
        TIMESTAMP,
        server_default=func.now(),
        onupdate=func.now()
    )

    order = relationship("Order", back_populates="seller_orders")

    seller = relationship("SellerProfile")

    items = relationship("OrderItem", back_populates="seller_order")
