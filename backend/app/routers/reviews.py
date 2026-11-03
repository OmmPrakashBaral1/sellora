from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models import Review, Product, Order, OrderItem
from app.schemas.review import (
    ReviewCreate,
    ReviewUpdate,
    ReviewResponse
)
from app.dependencies.auth import require_role
from app.models import User

router = APIRouter(
    prefix="/reviews",
    tags=["Reviews"]
)

@router.post("/products/{product_id}", response_model=ReviewResponse, status_code=201)
def create_review(
    product_id: int,
    review_data: ReviewCreate,
    db:Session = Depends(get_db),
    current_user: User = Depends(require_role("BUYER"))
):
    product = db.query(Product).filter(
        Product.id == product_id
    ).first()

    if product is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    order = db.query(Order).join(
        OrderItem,
        OrderItem.order_id == Order.id
    ).filter(
        Order.buyer_id == current_user.id,
        OrderItem.product_id == product_id,
        Order.status == "COMPLETED"
    ).order_by(
        Order.created_at.desc()
    ).first()

    if order is None:
        raise HTTPException(
            status_code=403,
            detail="You must purchase and complete this product before reviewing it"
        )
    
    new_review = Review(
        buyer_id=current_user.id,
        product_id=product_id,
        order_id=order.id,
        rating=review_data.rating,
        comment=review_data.comment.strip()
    )

    db.add(new_review)

    try:
        db.commit()
        db.refresh(new_review)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="You have already reviewed this product"
        )
    
    return new_review