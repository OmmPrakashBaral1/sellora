import os
import razorpay
import logging

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_role
from app.models import Order, Payment, User


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