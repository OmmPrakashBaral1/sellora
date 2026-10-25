
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models import Order, OrderItem, Product, User
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

    product_ids = [
        item.product_id
        for item in order_data.items
    ]

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

    for product in products:
        if product.status != "APPROVED":
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Product {product.id} is not available "
                    "for purchase"
                )
            )

    total_amount = Decimal("0.00")

    for item in order_data.items:
        product = next(
            p for p in products
            if p.id == item.product_id
        )

        total_amount += product.price * item.quantity

    order = Order(
        buyer_id=current_user.id,
        total_amount=total_amount,
        status="PENDING"
    )

    
    try:
        db.add(order)

        db.flush()

        for item in order_data.items:
            product = next(
                p for p in products
                if p.id == item.product_id
            )

            order_item = OrderItem(
                order_id=order.id,
                product_id=product.id,
                price_at_purchase=product.price,
                quantity=item.quantity
            )

            db.add(order_item)

        db.commit()
        db.refresh(order)

    except Exception:
        logger.exception("Failed to create order")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to create order"
        )
    return {
        "message": "Order created successfully",
        "order_id": order.id,
        "buyer_id": order.buyer_id,
        "total_amount": str(order.total_amount),
        "status": order.status,
        "items": [
            {
                "product_id": item.product_id,
                "price_at_purchase": str(item.price_at_purchase),
                "quantity": item.quantity
            }
            for item in order.items
        ]
    }