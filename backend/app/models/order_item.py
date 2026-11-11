
from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    Numeric,
    ForeignKey,
    ForeignKeyConstraint,
    CheckConstraint,
    TIMESTAMP,
    func
)
from sqlalchemy.orm import relationship

from app.database import Base


class OrderItem(Base):
    __tablename__ = "order_items"

    __table_args__ = (
        CheckConstraint(
            "quantity > 0",
            name="ck_order_items_quantity_positive"
        ),
        CheckConstraint(
            "price_at_purchase > 0",
            name="ck_order_items_price_positive"
        ),
        ForeignKeyConstraint(
            ["seller_order_id", "order_id"],
            ["seller_orders.id", "seller_orders.order_id"],
            name="fk_order_items_seller_order_order"
        ),
        ForeignKeyConstraint(
            ["product_id", "seller_id"],
            ["products.id", "products.seller_id"],
            name="fk_order_items_product_seller"
        ),
        ForeignKeyConstraint(
            ["seller_order_id", "seller_id"],
            ["seller_orders.id", "seller_orders.seller_id"],
            name="fk_order_items_seller_order_seller"
        ),
    )

    id = Column(BigInteger, primary_key=True)

    order_id = Column(
        BigInteger,
        ForeignKey("orders.id"),
        nullable=False
    )

    seller_order_id = Column(
        BigInteger,
        nullable=False,
        index=True
    )

    product_id = Column(
        BigInteger,
        ForeignKey("products.id"),
        nullable=False
    )

    seller_id = Column(
        BigInteger,
        nullable=False
    )

    price_at_purchase = Column(Numeric(10, 2), nullable=False)
    quantity = Column(Integer, nullable=False)

    created_at = Column(
        TIMESTAMP,
        server_default=func.now()
    )

    order = relationship("Order", back_populates="items")

    product = relationship(
        "Product",
        primaryjoin="Product.id == foreign(OrderItem.product_id)",
        foreign_keys=[product_id]
    )

    seller_order = relationship(
        "SellerOrder",
        back_populates="items",
        primaryjoin=(
            "and_("
            "SellerOrder.id == foreign(OrderItem.seller_order_id), "
            "SellerOrder.order_id == OrderItem.order_id"
            ")"
        ),
        foreign_keys=[seller_order_id]
    )
