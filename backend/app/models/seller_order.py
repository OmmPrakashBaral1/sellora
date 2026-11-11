
from sqlalchemy import (
    Column,
    BigInteger,
    Numeric,
    String,
    ForeignKey,
    TIMESTAMP,
    UniqueConstraint,
    CheckConstraint,
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
        UniqueConstraint(
            "id",
            "order_id",
            name="uq_seller_orders_id_order_id"
        ),
        UniqueConstraint(
            "id",
            "seller_id",
            name="uq_seller_orders_id_seller_id"
        ),
        CheckConstraint(
            "subtotal > 0",
            name="ck_seller_orders_subtotal_positive"
        ),
        CheckConstraint(
            "commission_rate >= 0 AND commission_rate <= 100",
            name="ck_seller_orders_commission_rate_valid"
        ),
        CheckConstraint(
            "commission_amount >= 0",
            name="ck_seller_orders_commission_nonnegative"
        ),
        CheckConstraint(
            "seller_earning >= 0",
            name="ck_seller_orders_earning_nonnegative"
        ),
        CheckConstraint(
            "commission_amount + seller_earning = subtotal",
            name="ck_seller_orders_financials_balance"
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

    items = relationship(
        "OrderItem",
        back_populates="seller_order",
        primaryjoin=(
            "and_("
            "SellerOrder.id == foreign(OrderItem.seller_order_id), "
            "SellerOrder.order_id == OrderItem.order_id"
            ")"
        ),
        foreign_keys="[OrderItem.seller_order_id]"
    )
