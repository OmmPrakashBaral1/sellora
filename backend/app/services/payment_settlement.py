from sqlalchemy.orm import Session

from app.models import Order, Payment, SellerOrder


class PaymentSettlementError(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


def settle_captured_payment(
    db: Session,
    payment_id: int,
    razorpay_order_id: str,
    razorpay_payment_id: str
):
    """
    Complete a locally recorded payment and its associated orders.

    The caller is responsible for committing or rolling back
    the database transaction.
    """

    initial_payment = (
        db.query(Payment)
        .filter(
            Payment.id == payment_id,
            Payment.razorpay_order_id == razorpay_order_id
        )
        .first()
    )

    if initial_payment is None:
        raise PaymentSettlementError(
            404,
            "Payment record not found"
        )

    order = (
        db.query(Order)
        .filter(Order.id == initial_payment.order_id)
        .with_for_update()
        .first()
    )

    if order is None:
        raise PaymentSettlementError(
            404,
            "Associated order not found"
        )

    payment = (
        db.query(Payment)
        .filter(
            Payment.id == payment_id,
            Payment.order_id == order.id,
            Payment.razorpay_order_id == razorpay_order_id
        )
        .with_for_update()
        .populate_existing()
        .first()
    )

    if payment is None:
        raise PaymentSettlementError(
            404,
            "Payment record not found"
        )

    seller_orders = (
        db.query(SellerOrder)
        .filter(SellerOrder.order_id == order.id)
        .with_for_update()
        .all()
    )

    if payment.status == "SUCCESS":

        if payment.razorpay_payment_id != razorpay_payment_id:
            raise PaymentSettlementError(
                409,
                "A different payment has already been recorded"
            )

        if order.status != "COMPLETED":
            raise PaymentSettlementError(
                409,
                "Payment is successful but order status is inconsistent"
            )

        if not seller_orders or any(
            seller_order.status != "COMPLETED"
            for seller_order in seller_orders
        ):
            raise PaymentSettlementError(
                409,
                "Payment is successful but seller order statuses are inconsistent"
            )

        return {
            "already_settled": True,
            "payment_id": payment.id,
            "order_id": order.id,
            "seller_orders_count": len(seller_orders)
        }

    if payment.status != "PENDING":
        raise PaymentSettlementError(
            409,
            "Payment cannot be settled from its current status"
        )

    if order.status != "PENDING":
        raise PaymentSettlementError(
            409,
            "Order is not awaiting payment"
        )

    if not seller_orders:
        raise PaymentSettlementError(
            409,
            "No seller orders found for this order"
        )

    if any(
        seller_order.status != "PENDING"
        for seller_order in seller_orders
    ):
        raise PaymentSettlementError(
            409,
            "Seller order status is inconsistent with pending payment"
        )

    existing_payment = (
        db.query(Payment)
        .filter(
            Payment.razorpay_payment_id == razorpay_payment_id,
            Payment.id != payment.id
        )
        .first()
    )

    if existing_payment is not None:
        raise PaymentSettlementError(
            409,
            "This Razorpay payment is already associated with another payment record"
        )

    payment.razorpay_payment_id = razorpay_payment_id
    payment.status = "SUCCESS"

    for seller_order in seller_orders:
        seller_order.status = "COMPLETED"

    order.status = "COMPLETED"

    return {
        "already_settled": False,
        "payment_id": payment.id,
        "order_id": order.id,
        "seller_orders_count": len(seller_orders)
    }
