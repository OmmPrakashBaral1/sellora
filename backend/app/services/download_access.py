from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session, selectinload

from app.models import Order, OrderItem, Payment


def get_downloadable_order(
    db: Session,
    order_id: int,  
    buyer_id: int
) -> Order:
    """
    Verify that a buyer owns a completed and paid order.

    Return the authorized order with its associated
    products and seller orders loaded.
    """

    order = (
        db.query(Order)
        .options(
            selectinload(Order.items)
            .selectinload(OrderItem.product),

            selectinload(Order.items)
            .selectinload(OrderItem.seller_order)
        )
        .filter(
            Order.id == order_id,
            Order.buyer_id == buyer_id
        )
        .first()
    )

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Order not found"
        )

    if order.status != "COMPLETED":
        raise HTTPException(
            status_code=403,
            detail="Order is not completed"
        )

    payments = (
        db.query(Payment)
        .filter(Payment.order_id == order.id)
        .all()
    )

    if len(payments) != 1:
        raise HTTPException(
            status_code=403,
            detail="Valid payment is required for downloads"
        )

    payment = payments[0]

    if (
        payment.status != "SUCCESS"
        or payment.provider != "RAZORPAY"
        or payment.amount != order.total_amount
        or payment.amount <= Decimal("0.00")
        or not payment.razorpay_order_id
        or not payment.razorpay_payment_id
    ):
        raise HTTPException(
            status_code=403,
            detail="Valid payment is required for downloads"
        )

    return order


def get_downloadable_items(order: Order) -> list[OrderItem]:
    """
    Return purchased items belonging to completed
    seller orders.
    """

    return [
        item
        for item in order.items
        if (
            item.product is not None
            and item.seller_order is not None
            and item.seller_order.status == "COMPLETED"
            and item.seller_order.order_id == order.id
            and item.seller_order.seller_id == item.seller_id
            and item.product.seller_id == item.seller_id
        )
    ]


def get_downloadable_item(
    order: Order,
    product_id: int
) -> OrderItem:
    """
    Verify that a specific product belongs to the
    buyer's authorized and completed purchase.
    """

    for item in get_downloadable_items(order):
        if item.product_id == product_id:
            return item

    raise HTTPException(
        status_code=404,
        detail="Purchased product not found"
    )