
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_role
from app.models import SellerOrder, SellerProfile, User


router = APIRouter(
    prefix="/seller-orders",
    tags=["Seller Orders"]
)


@router.get("/")
def get_my_seller_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("SELLER"))
):

    # 1. Find the seller profile of the logged-in user.
    seller_profile = (
        db.query(SellerProfile)
        .filter(
            SellerProfile.user_id == current_user.id
        )
        .first()
    )

    if seller_profile is None:
        raise HTTPException(
            status_code=404,
            detail="Seller profile not found"
        )

    # 2. Fetch only this seller's orders.
    seller_orders = (
        db.query(SellerOrder)
        .filter(
            SellerOrder.seller_id == seller_profile.id
        )
        .order_by(
            SellerOrder.created_at.desc()
        )
        .all()
    )

    # 3. Prepare the response.
    result = []

    for seller_order in seller_orders:

        items = []

        for item in seller_order.items:

            items.append({
                "product_id": item.product_id,
                "title": item.product.title,
                "quantity": item.quantity,
                "price_at_purchase": str(
                    item.price_at_purchase
                )
            })

        result.append({
            "seller_order_id": seller_order.id,
            "order_id": seller_order.order_id,
            "subtotal": str(seller_order.subtotal),
            "commission_rate": str(
                seller_order.commission_rate
            ),
            "commission_amount": str(
                seller_order.commission_amount
            ),
            "seller_earning": str(
                seller_order.seller_earning
            ),
            "status": seller_order.status,
            "created_at": seller_order.created_at,
            "items": items
        })

    return result
