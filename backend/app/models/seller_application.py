from sqlalchemy import (
    Column,
    BigInteger,
    String,
    Text,
    TIMESTAMP,
    ForeignKey,
    CheckConstraint,
    Index,
    text,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base


class SellerApplication(Base):
    __tablename__ = "seller_applications"

    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING', 'APPROVED', 'REJECTED')",
            name="ck_seller_applications_status_valid",
        ),
        Index(
            "uq_seller_applications_one_pending_per_user",
            "user_id",
            unique=True,
            postgresql_where=text("status = 'PENDING'"),
        ),
    )

    id = Column(BigInteger, primary_key=True)

    user_id = Column(
        BigInteger,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    store_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)

    status = Column(
        String(20),
        nullable=False,
        default="PENDING",
        server_default="PENDING",
    )

    rejection_reason = Column(Text, nullable=True)

    reviewed_by = Column(
        BigInteger,
        ForeignKey("users.id"),
        nullable=True,
    )

    reviewed_at = Column(TIMESTAMP(timezone=True), nullable=True)

    created_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    user = relationship(
        "User",
        foreign_keys=[user_id],
    )

    reviewer = relationship(
        "User",
        foreign_keys=[reviewed_by],
    )
