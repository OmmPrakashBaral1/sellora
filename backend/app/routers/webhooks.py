from sqlalchemy import func
import json
import logging


from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert

from app.database import get_db
from app.core.config import RAZORPAY_WEBHOOK_SECRET
from app.models import Payment, WebhookEvent

from app.services.razorpay_webhook import verify_webhook_signature
from app.services.payment_settlement import (
    settle_captured_payment,
    PaymentSettlementError
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])



@router.post(
    "/razorpay",
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "required": ["event"],
                        "properties": {
                            "event": {"type": "string"},
                            "payload": {"type": "object"}
                        }
                    }
                }
            }
        }
    }
)
async def razorpay_webhook(
    request: Request,
    db: Session = Depends(get_db),
    razorpay_signature: str = Header(
        default="",
        alias="X-Razorpay-Signature"
    ),
    razorpay_event_id: str = Header(
        default="",
        alias="X-Razorpay-Event-Id"
    )
):
    body = await request.body()
    try:
        is_valid = verify_webhook_signature(
            body=body,
            signature=razorpay_signature,
            secret=RAZORPAY_WEBHOOK_SECRET
        )
    except RuntimeError:
        logger.exception("Razorpay webhook secret is not configured")
        raise HTTPException(
            status_code=500,
            detail="Webhook configuration error"
        )

    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail="Invalid webhook signature"
        )

    try:
        payload = json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(
            status_code=400,
            detail="Invalid webhook payload"
        )

    event_type = payload.get("event")

    if not isinstance(event_type, str) or not event_type:
        raise HTTPException(
            status_code=400,
            detail="Missing webhook event type"
        )

    if not razorpay_event_id:
        raise HTTPException(
            status_code=400,
            detail="Missing Razorpay event ID"
        )


    if event_type != "payment.captured":
        logger.info(
            "Ignoring unsupported Razorpay event: %s",
            event_type
        )
        return {
            "message": "Event received but not processed",
            "event": event_type
        }

    try:
        payment_entity = payload["payload"]["payment"]["entity"]

        razorpay_order_id = payment_entity["order_id"]
        razorpay_payment_id = payment_entity["id"]
        amount_in_paise = payment_entity["amount"]
        currency = payment_entity["currency"]
        provider_status = payment_entity["status"]

    except (KeyError, TypeError):
        raise HTTPException(
            status_code=400,
            detail="Invalid payment.captured payload"
        )

    if (
        not isinstance(razorpay_order_id, str)
        or not isinstance(razorpay_payment_id, str)
        or not isinstance(amount_in_paise, int)
        or isinstance(amount_in_paise, bool)
        or currency != "INR"
        or provider_status != "captured"
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid captured payment details"
        )

    payment = (
        db.query(Payment)
        .filter(
            Payment.razorpay_order_id == razorpay_order_id
        )
        .first()
    )

    if payment is None:
        logger.warning(
            "Webhook references unknown Razorpay order: %s",
            razorpay_order_id
        )
        raise HTTPException(
            status_code=404,
            detail="Payment record not found"
        )
    expected_amount = int(payment.amount * 100)

    if payment.provider != "RAZORPAY":
        raise HTTPException(
            status_code=400,
            detail="Payment provider mismatch"
        )

    if amount_in_paise != expected_amount:
        raise HTTPException(
            status_code=400,
            detail="Payment amount mismatch"
        )

    try:
        event_statement = (
            insert(WebhookEvent)
            .values(
                provider="RAZORPAY",
                event_id=razorpay_event_id,
                event_type=event_type,
                status="RECEIVED"
            )
            .on_conflict_do_nothing(
                index_elements=["provider", "event_id"]
            )
            .returning(WebhookEvent.id)
        )

        inserted_event_id = db.execute(
            event_statement
        ).scalar_one_or_none()


        if inserted_event_id is None:
            db.rollback()

            logger.info(
                "Duplicate Razorpay webhook ignored: %s",
                razorpay_event_id
            )

            return {
                "message": "Duplicate event ignored"
            }
        settlement = settle_captured_payment(
            db=db,
            payment_id=payment.id,
            razorpay_order_id=razorpay_order_id,
            razorpay_payment_id=razorpay_payment_id
        )

        webhook_event = (
            db.query(WebhookEvent)
            .filter(WebhookEvent.id == inserted_event_id)
            .first()
        )

        webhook_event.status = "PROCESSED"
        webhook_event.processed_at = func.now()

        db.commit()

        logger.info(
            "Razorpay webhook processed successfully. "
            "Event ID: %s, Payment ID: %s, Order ID: %s",
            razorpay_event_id,
            settlement["payment_id"],
            settlement["order_id"]
        )

        return {
            "message": "Webhook processed successfully",
            "payment_id": settlement["payment_id"],
            "order_id": settlement["order_id"],
            "payment_status": "SUCCESS",
            "order_status": "COMPLETED",
            "already_settled": settlement["already_settled"]
        }

    except PaymentSettlementError as exc:
        db.rollback()

        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.detail
        )

    except Exception:
        db.rollback()

        logger.exception(
            "Failed to process Razorpay webhook: %s",
            razorpay_event_id
        )

        raise HTTPException(
            status_code=500,
            detail="Webhook processing failed"
        )


