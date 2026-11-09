
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models import (
    Order,
    OrderItem,
    Product,
    User,
    SellerOrder,
    SellerProfile,
    Payment
)
from app.schemas.order import OrderCreate

import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/orders",
    tags=["Orders"]
)


@router.post("/")
def create_order(
    order_data: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("BUYER"))
):
    product_ids = [item.product_id for item in order_data.items]

    if len(product_ids) != len(set(product_ids)):
        raise HTTPException(
            status_code=400,
            detail="Duplicate product IDs are not allowed"
        )

    products = db.query(Product).filter(
        Product.id.in_(product_ids)
    ).all()

    if len(products) != len(product_ids):
        raise HTTPException(
            status_code=404,
            detail="One or more products were not found"
        )

    product_map = {product.id: product for product in products}

    for product in products:
        if product.status != "APPROVED":
            raise HTTPException(
                status_code=400,
                detail=f"Product {product.id} is not available for purchase"
            )

    # Group requested items by seller profile ID.
    seller_groups = {}

    for item in order_data.items:
        product = product_map[item.product_id]

        seller_groups.setdefault(product.seller_id, []).append(
            (item, product)
        )

    commission_rate = Decimal("10.00")
    total_amount = Decimal("0.00")

    for items in seller_groups.values():
        for item, product in items:
            total_amount += (
                Decimal(str(product.price)) * item.quantity
            )

    try:
        # Create the main buyer order.
        order = Order(
            buyer_id=current_user.id,
            total_amount=total_amount,
            status="PENDING"
        )

        db.add(order)
        db.flush()

        seller_order_results = []

        # Create one SellerOrder for each seller.
        for seller_id, items in seller_groups.items():

            subtotal = sum(
                (
                    Decimal(str(product.price)) * item.quantity
                    for item, product in items
                ),
                Decimal("0.00")
            )

            commission_amount = (
                subtotal * commission_rate / Decimal("100")
            ).quantize(
                Decimal("0.01"),
                rounding=ROUND_HALF_UP
            )

            seller_earning = subtotal - commission_amount

            seller_order = SellerOrder(
                order_id=order.id,
                seller_id=seller_id,
                subtotal=subtotal,
                commission_rate=commission_rate,
                commission_amount=commission_amount,
                seller_earning=seller_earning,
                status="PENDING"
            )

            db.add(seller_order)
            db.flush()

            for item, product in items:
                order_item = OrderItem(
                    order_id=order.id,
                    seller_order_id=seller_order.id,
                    product_id=product.id,
                    price_at_purchase=product.price,
                    quantity=item.quantity
                )

                db.add(order_item)

            seller_order_results.append({
                "seller_order_id": seller_order.id,
                "seller_id": seller_id,
                "subtotal": str(subtotal),
                "commission": str(commission_amount),
                "seller_earning": str(seller_earning)
            })

        db.commit()
        db.refresh(order)

        return {
            "message": "Order created successfully",
            "order_id": order.id,
            "buyer_id": order.buyer_id,
            "total_amount": str(order.total_amount),
            "status": order.status,
            "seller_orders": seller_order_results
        }

    except Exception:
        logger.exception("Failed to create order")
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Failed to create order"
        )

@router.get("/")
def get_my_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("BUYER"))
):
    orders = (
        db.query(Order)
        .filter(Order.buyer_id == current_user.id)
        .order_by(Order.created_at.desc())
        .all()
    )

    return [
        {
            "order_id": order.id,
            "total_amount": str(order.total_amount),
            "status": order.status,
            "created_at": order.created_at,
            "items": [
                {
                    "product_id": item.product_id,
                    "price_at_purchase": str(item.price_at_purchase),
                    "quantity": item.quantity
                }
                for item in order.items
            ]
        }
        for order in orders
    ]

@router.get("/seller")
def get_seller_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("SELLER"))
):
    seller_orders = (
        db.query(SellerOrder)
        .join(SellerProfile)
        .filter(SellerProfile.user_id == current_user.id)
        .order_by(SellerOrder.created_at.desc())
        .all()
    )

    return [
        {
            "seller_order_id": seller_order.id,
            "order_id": seller_order.order_id,
            "seller_id": seller_order.seller_id,
            "subtotal": str(seller_order.subtotal),
            "commission_rate": str(seller_order.commission_rate),
            "commission_amount": str(seller_order.commission_amount),
            "seller_earning": str(seller_order.seller_earning),
            "status": seller_order.status,
            "items": [
                {
                    "product_id": item.product_id,
                    "title": item.product.title,
                    "quantity": item.quantity,
                    "price_at_purchase": str(item.price_at_purchase)
                }
                for item in seller_order.items
            ]
        }
        for seller_order in seller_orders
    ]



@router.get("/{order_id}")
def get_order_by_id(
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

    return {
        "order_id": order.id,
        "buyer_id": order.buyer_id,
        "total_amount": str(order.total_amount),
        "status": order.status,
        "created_at": order.created_at,
        "items": [
            {
                "product_id": item.product_id,
                "price_at_purchase": str(item.price_at_purchase),
                "quantity": item.quantity
            }
            for item in order.items
        ]
    }


@router.get("/{order_id}/downloads")
def get_order_downloads(
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

    if order.status != "COMPLETED":
        raise HTTPException(
            status_code=403,
            detail="Order is not completed"
        )

    successful_payment = (
        db.query(Payment)
        .filter(
            Payment.order_id == order.id,
            Payment.status == "SUCCESS"
        )
        .first()
    )

    if successful_payment is None:
        raise HTTPException(
            status_code=403,
            detail="Successful payment is required for downloads"
        )

    completed_items = [
        item for item in order.items
        if item.seller_order is not None
        and item.seller_order.status == "COMPLETED"
    ]

    if not completed_items:
        raise HTTPException(
            status_code=400,
            detail="No completed seller orders available for download"
        )

    return {
        "order_id": order.id,
        "downloads": [
            {
                "product_id": item.product_id,
                "title": item.product.title,
                "product_url": item.product.product_url
            }
            for item in completed_items
        ]
    }



@router.patch("/{order_id}/cancel")
def cancel_order(
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
            detail="Only pending orders can be cancelled"
        )

    seller_orders = (
        db.query(SellerOrder)
        .filter(SellerOrder.order_id == order.id)
        .with_for_update()
        .all()
    )
    if any(so.status != "PENDING" for so in seller_orders):
        raise HTTPException(
            status_code=400,
            detail="Order cannot be cancelled because a seller has already processed it"
        )

    try:
        for seller_order in seller_orders:
            seller_order.status = "CANCELLED"

        order.status = "CANCELLED"

        db.commit()
        db.refresh(order)

    except Exception:
        logger.exception("Failed to cancel order")
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Failed to cancel order"
        )

    return {
        "message": "Order cancelled successfully",
        "order_id": order.id,
        "status": order.status,
        "cancelled_seller_orders": len(seller_orders)
    }
