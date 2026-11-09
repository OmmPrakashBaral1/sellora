import os
import razorpay
import logging

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_role
from app.models import Order, Payment, User, SellerOrder
from app.schemas.payment import PaymentVerify


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

    try:
        razorpay_order = client.order.create({
            "amount": amount_in_paise,
            "currency": "INR",
            "receipt": f"sellora_order_{order.id}"
        })

    except Exception:
        logger.exception("Failed to create Razorpay order")
        raise HTTPException(
            status_code=502,
            detail="Unable to initiate payment"
        )

    payment = Payment(
        order_id=order.id,
        amount=amount,
        provider="RAZORPAY",
        razorpay_order_id=razorpay_order["id"],
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
            detail="Failed to save payment information"
        )

    return {
        "message": "Payment initiated successfully",
        "payment_id": payment.id,
        "razorpay_key_id": RAZORPAY_KEY_ID,
        "razorpay_order_id": razorpay_order["id"],
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

    if payment.status == "SUCCESS":
        return {
            "message": "Payment already verified",
            "payment_id": payment.id,
            "status": payment.status
        }

    if payment.status != "PENDING":
        raise HTTPException(
            status_code=400,
            detail="Payment cannot be verified"
        )

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

    existing_payment = (
        db.query(Payment)
        .filter(
            Payment.razorpay_payment_id == payment_data.razorpay_payment_id,
            Payment.id != payment.id
        )
        .first()
    )

    if existing_payment is not None:
        raise HTTPException(
            status_code=409,
            detail="This Razorpay payment is already associated with another payment record"
        )

    payment = (
        db.query(Payment)
        .filter(Payment.id == payment.id)
        .with_for_update()
        .populate_existing()
        .first()
    )

    if payment is None:
        raise HTTPException(
            status_code=404,
            detail="Payment record not found"
        )

    if payment.status != "PENDING":
        raise HTTPException(
            status_code=409,
            detail="Payment has already been processed"
        )

    order = (
        db.query(Order)
        .filter(Order.id == payment.order_id)
        .with_for_update()
        .first()
    )

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Associated order not found"
        )

    if order.status != "PENDING":
        raise HTTPException(
            status_code=400,
            detail="Order is not awaiting payment"
        )


    seller_orders = (
        db.query(SellerOrder)
        .filter(SellerOrder.order_id == order.id)
        .with_for_update()
        .all()
    )

    if not seller_orders:
        raise HTTPException(
            status_code=409,
            detail="No seller orders found for this order"
        )

    if any(so.status != "PENDING" for so in seller_orders):
        raise HTTPException(
            status_code=409,
            detail="Seller order status is inconsistent with pending payment"
        )

    try:
        payment.razorpay_payment_id = payment_data.razorpay_payment_id
        payment.status = "SUCCESS"

        for seller_order in seller_orders:
            seller_order.status = "COMPLETED"

        order.status = "COMPLETED"

        db.commit()

        db.refresh(payment)
        db.refresh(order)

    except Exception:
        logger.exception("Failed to update payment and order")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to update payment information"
        )

    return {
        "message": "Payment verified and digital order completed successfully",
        "payment_id": payment.id,
        "order_id": order.id,
        "payment_status": payment.status,
        "order_status": order.status,
        "completed_seller_orders": len(seller_orders)
    }
