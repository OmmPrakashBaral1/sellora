from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    Numeric,
    String,
    ForeignKey,
    TIMESTAMP,
    func
)
from sqlalchemy.orm import relationship

from app.database import Base

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(BigInteger, primary_key=True)

    order_id = Column(
        BigInteger,
        ForeignKey("orders.id"),
        nullable=False
    )

    seller_order_id = Column(
        BigInteger,
        ForeignKey("seller_orders.id"),
        nullable=False,
        index=True
    )

    product_id = Column(
        BigInteger,
        ForeignKey("products.id"),
        nullable=False
    )

    price_at_purchase = Column(Numeric(10, 2), nullable=False)
    quantity = Column(Integer, nullable=False)

    created_at = Column(
        TIMESTAMP,
        server_default=func.now()
    )

    order = relationship("Order", back_populates="items")
    product = relationship("Product")
    seller_order = relationship(
        "SellerOrder",
        back_populates="items"
    )
