

from sqlalchemy import (
    Column,
    BigInteger,
    String,
    TIMESTAMP,
    UniqueConstraint,
    CheckConstraint,
    func
)

from app.database import Base


class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    __table_args__ = (
        UniqueConstraint(
            "provider",
            "event_id",
            name="uq_webhook_events_provider_event_id"
        ),
        CheckConstraint(
            "status IN ('RECEIVED', 'PROCESSED')",
            name="ck_webhook_events_status"
        ),
    )

    id = Column(BigInteger, primary_key=True, index=True)

    provider = Column(String(30), nullable=False)

    event_id = Column(String(100), nullable=False)

    event_type = Column(String(100), nullable=False)

    status = Column(
        String(20),
        nullable=False,
        default="RECEIVED",
        server_default="RECEIVED"
    )

    created_at = Column(
        TIMESTAMP,
        nullable=False,
        server_default=func.now()
    )

    processed_at = Column(
        TIMESTAMP,
        nullable=True
    )
