
from sqlalchemy import (
    Column,
    BigInteger,
    Integer,
    Text,
    ForeignKey,
    TIMESTAMP,
    func,
    UniqueConstraint,
    CheckConstraint
)

from app.database import Base


class Review(Base):
    __tablename__ = "reviews"

    __table_args__ = (
        UniqueConstraint(
            "buyer_id",
            "product_id",
            name="uq_buyer_product_review"
        ),
        CheckConstraint(
            "rating >= 1 AND rating <= 5",
            name="ck_review_rating"
        )
    )

    id = Column(
        BigInteger,
        primary_key=True,
        index=True
    )

    buyer_id = Column(
        BigInteger,
        ForeignKey("users.id"),
        nullable=False
    )

    product_id = Column(
        BigInteger,
        ForeignKey("products.id"),
        nullable=False
    )

    order_id = Column(
        BigInteger,
        ForeignKey("orders.id"),
        nullable=False
    )

    rating = Column(
        Integer,
        nullable=False
    )

    comment = Column(
        Text,
        nullable=False
    )

    created_at = Column(
        TIMESTAMP,
        server_default=func.now()
    )

    updated_at = Column(
        TIMESTAMP,
        server_default=func.now(),
        onupdate=func.now()
    )
