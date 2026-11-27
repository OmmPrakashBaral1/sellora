import os
import razorpay
import logging

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.dependencies.auth import require_role
from app.models import Order, Payment, User, SellerOrder
from app.schemas.payment import PaymentVerify
from app.services.payment_settlement import (
    settle_captured_payment,
    PaymentSettlementError
)


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/payments",
    tags=["Payments"]
)

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")

if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
    raise RuntimeError(
        "Razorpay credentials are missing from environment variables"
    )

client = razorpay.Client(
    auth =(
        RAZORPAY_KEY_ID,
        RAZORPAY_KEY_SECRET
    )
)

@router.post("/create/{order_id}")
def create_payment(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("BUYER"))
):
    order = (
        db.query(Order)
        .filter(
            Order.id == order_id,
            Order.buyer_id == current_user.id
        )
        .with_for_update()
        .first()
    )

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Order not found"
        )

    if order.status != "PENDING":
        raise HTTPException(
            status_code=400,
            detail="Only pending orders can be paid"
        )

    amount = Decimal(str(order.total_amount))

    if amount <= Decimal("0.00"):
        raise HTTPException(
            status_code=400,
            detail="Invalid order amount"
        )

    amount_in_paise = int(amount * 100)

    existing_payments = (
        db.query(Payment)
        .filter(Payment.order_id == order.id)
        .order_by(Payment.id.desc())
        .with_for_update()
        .all()
    )

    if existing_payments:
        if any(p.status == "SUCCESS" for p in existing_payments):
            raise HTTPException(
                status_code=409,
                detail="A successful payment already exists for this order. Payment reconciliation is required."
            )

        pending_payments = [
            p for p in existing_payments
            if p.status == "PENDING"
        ]

        if pending_payments:
            existing_payment = pending_payments[0]

            if not existing_payment.razorpay_order_id:
                raise HTTPException(
                    status_code=409,
                    detail="An unresolved payment attempt exists. Reconciliation is required."
                )

            if existing_payment.amount != amount:
                raise HTTPException(
                    status_code=409,
                    detail="Existing payment amount does not match the order"
                )

            return {
                "message": "Existing payment attempt reused",
                "payment_id": existing_payment.id,
                "razorpay_key_id": RAZORPAY_KEY_ID,
                "razorpay_order_id": existing_payment.razorpay_order_id,
                "amount": amount_in_paise,
                "currency": "INR"
            }

        raise HTTPException(
            status_code=409,
            detail="Previous payment attempts require reconciliation before another attempt can be created"
        )

    try:
        razorpay_order = client.order.create({
            "amount": amount_in_paise,
            "currency": "INR",
            "receipt": f"sellora_order_{order.id}"
        })

        razorpay_order_id = razorpay_order.get("id")

        if not razorpay_order_id:
            raise ValueError("Razorpay did not return an order ID")

    except Exception:
        logger.exception("Failed to create Razorpay order")
        db.rollback()

        raise HTTPException(
            status_code=502,
            detail="Unable to initiate payment"
        )

    payment = Payment(
        order_id=order.id,
        amount=amount,
        provider="RAZORPAY",
        razorpay_order_id=razorpay_order_id,
        status="PENDING"
    )

    try:
        db.add(payment)
        db.commit()
        db.refresh(payment)

    except Exception:
        logger.exception("Failed to save payment record")
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Failed to save payment information. Payment reconciliation may be required."
        )

    return {
        "message": "Payment initiated successfully",
        "payment_id": payment.id,
        "razorpay_key_id": RAZORPAY_KEY_ID,
        "razorpay_order_id": razorpay_order_id,
        "amount": amount_in_paise,
        "currency": "INR"
    }


@router.post("/verify")
def verify_payment(
    payment_data: PaymentVerify,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("BUYER"))
):
    payment = (
        db.query(Payment)
        .join(Order, Payment.order_id == Order.id)
        .filter(
            Payment.razorpay_order_id == payment_data.razorpay_order_id,
            Order.buyer_id == current_user.id
        )
        .first()
    )

    if payment is None:
        raise HTTPException(
            status_code=404,
            detail="Payment record not found"
        )

    payment_id = payment.id
    order_id = payment.order_id

    try:
        client.utility.verify_payment_signature({
            "razorpay_order_id": payment_data.razorpay_order_id,
            "razorpay_payment_id": payment_data.razorpay_payment_id,
            "razorpay_signature": payment_data.razorpay_signature
        })

    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(
            status_code=400,
            detail="Payment signature verification failed"
        )

    try:
        razorpay_payment = client.payment.fetch(
            payment_data.razorpay_payment_id
        )

    except Exception:
        logger.exception("Unable to fetch Razorpay payment")
        raise HTTPException(
            status_code=502,
            detail="Unable to confirm payment status"
        )

    if razorpay_payment.get("order_id") != payment_data.razorpay_order_id:
        raise HTTPException(
            status_code=400,
            detail="Payment does not match the Razorpay order"
        )

    if razorpay_payment.get("id") != payment_data.razorpay_payment_id:
        raise HTTPException(
            status_code=400,
            detail="Payment ID does not match the Razorpay response"
        )

    if razorpay_payment.get("status") != "captured":
        raise HTTPException(
            status_code=400,
            detail="Payment has not been captured"
        )

    if razorpay_payment.get("currency") != "INR":
        raise HTTPException(
            status_code=400,
            detail="Payment currency does not match the order currency"
        )

    expected_amount = int(payment.amount * 100)

    if razorpay_payment.get("amount") != expected_amount:
        raise HTTPException(
            status_code=400,
            detail="Payment amount does not match the order amount"
        )


    try:
        settlement = settle_captured_payment(
            db=db,
            payment_id=payment_id,
            razorpay_order_id=payment_data.razorpay_order_id,
            razorpay_payment_id=payment_data.razorpay_payment_id
        )

        db.commit()

    except PaymentSettlementError as exc:
        db.rollback()

        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.detail
        )

    except IntegrityError:
        logger.exception(
            "Payment verification violated a database constraint"
        )
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="This payment has already been recorded or conflicts with an existing payment record"
        )

    except Exception:
        logger.exception("Failed to settle payment")
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Failed to update payment information"
        )

    if settlement["already_settled"]:
        return {
            "message": "Payment already verified",
            "payment_id": settlement["payment_id"],
            "status": "SUCCESS"
        }

    return {
        "message": "Payment verified and digital order completed successfully",
        "payment_id": settlement["payment_id"],
        "order_id": settlement["order_id"],
        "payment_status": "SUCCESS",
        "order_status": "COMPLETED",
        "completed_seller_orders": settlement["seller_orders_count"]
    }


@router.post("/reconcile/{order_id}")
def reconcile_payment(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("BUYER"))
):
    order = (
        db.query(Order)
        .filter(
            Order.id == order_id,
            Order.buyer_id == current_user.id
        )
        .first()
    )

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Order not found"
        )

    if order.status not in ("PENDING", "COMPLETED"):
        raise HTTPException(
            status_code=409,
            detail="This order is not eligible for payment reconciliation"
        )

    payments = (
        db.query(Payment)
        .filter(Payment.order_id == order.id)
        .all()
    )

    if not payments:
        if order.status == "COMPLETED":
            raise HTTPException(
                status_code=409,
                detail="Completed order has no payment record"
            )

        return {
            "message": "No payment attempt exists for this order",
            "order_id": order.id,
            "order_status": order.status,
            "payment_status": "NOT_INITIATED",
            "reconciled": False
        }

    if len(payments) != 1:
        raise HTTPException(
            status_code=409,
            detail="Multiple payment records require manual reconciliation"
        )

    payment = payments[0]

    if (
        payment.provider != "RAZORPAY"
        or not payment.razorpay_order_id
        or payment.amount != order.total_amount
        or payment.amount <= Decimal("0.00")
    ):
        raise HTTPException(
            status_code=409,
            detail="Local payment information is inconsistent"
        )

    if payment.status not in ("PENDING", "SUCCESS"):
        raise HTTPException(
            status_code=409,
            detail="Payment requires manual reconciliation"
        )

    if (
        order.status == "COMPLETED"
        and payment.status != "SUCCESS"
    ) or (
        order.status == "PENDING"
        and payment.status == "SUCCESS"
    ):
        raise HTTPException(
            status_code=409,
            detail="Local order and payment statuses are inconsistent"
        )

    local_payment_id = payment.id
    razorpay_order_id = payment.razorpay_order_id
    expected_amount = int(payment.amount * 100)

    try:
        gateway_order = client.order.fetch(
            razorpay_order_id
        )

        gateway_response = client.order.payments(
            razorpay_order_id
        )

    except Exception:
        logger.exception(
            "Unable to reconcile Razorpay order for local order %s",
            order_id
        )

        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve payment status from Razorpay"
        )

    if (
        not isinstance(gateway_order, dict)
        or gateway_order.get("id") != razorpay_order_id
        or gateway_order.get("currency") != "INR"
        or gateway_order.get("amount") != expected_amount
    ):
        raise HTTPException(
            status_code=409,
            detail="Gateway order information does not match the local order"
        )

    if not isinstance(gateway_response, dict):
        raise HTTPException(
            status_code=502,
            detail="Invalid payment response from Razorpay"
        )

    gateway_payments = gateway_response.get("items")

    if (
        not isinstance(gateway_payments, list)
        or any(
            not isinstance(item, dict)
            for item in gateway_payments
        )
    ):
        raise HTTPException(
            status_code=502,
            detail="Invalid payment collection from Razorpay"
        )

    captured_payments = [
        item for item in gateway_payments
        if item.get("status") == "captured"
    ]

    if not captured_payments:
        if (
            gateway_order.get("status") == "paid"
            or gateway_order.get("amount_paid") != 0
            or payment.status == "SUCCESS"
        ):
            raise HTTPException(
                status_code=409,
                detail="Gateway payment information requires further reconciliation"
            )

        db.refresh(order)
        db.refresh(payment)

        return {
            "message": "No captured payment was found",
            "order_id": order.id,
            "order_status": order.status,
            "payment_status": payment.status,
            "reconciled": False
        }

    if len(captured_payments) != 1:
        raise HTTPException(
            status_code=409,
            detail="Multiple captured payments require manual reconciliation"
        )

    captured_payment = captured_payments[0]

    razorpay_payment_id = captured_payment.get("id")

    if (
        not isinstance(razorpay_payment_id, str)
        or not razorpay_payment_id
        or captured_payment.get("order_id") != razorpay_order_id
        or captured_payment.get("currency") != "INR"
        or captured_payment.get("amount") != expected_amount
        or captured_payment.get("amount_refunded") != 0
        or gateway_order.get("status") != "paid"
        or gateway_order.get("amount_paid") != expected_amount
    ):
        raise HTTPException(
            status_code=409,
            detail="Captured payment details require manual reconciliation"
        )

    try:
        settlement = settle_captured_payment(
            db=db,
            payment_id=local_payment_id,
            razorpay_order_id=razorpay_order_id,
            razorpay_payment_id=razorpay_payment_id
        )

        db.commit()

    except PaymentSettlementError as exc:
        db.rollback()

        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.detail
        )

    except IntegrityError:
        db.rollback()

        logger.exception(
            "Payment reconciliation violated a database constraint"
        )

        raise HTTPException(
            status_code=409,
            detail="Payment reconciliation conflicts with an existing record"
        )

    except Exception:
        db.rollback()

        logger.exception(
            "Payment reconciliation failed for order %s",
            order_id
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to reconcile payment"
        )

    return {
        "message": (
            "Payment already reconciled"
            if settlement["already_settled"]
            else "Payment reconciled successfully"
        ),
        "order_id": settlement["order_id"],
        "payment_id": settlement["payment_id"],
        "order_status": "COMPLETED",
        "payment_status": "SUCCESS",
        "reconciled": not settlement["already_settled"]
    }