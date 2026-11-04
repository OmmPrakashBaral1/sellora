from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func

from app.database import get_db
from app.models import Review, Product, Order, OrderItem
from app.schemas.review import (
    ReviewCreate,
    ReviewUpdate,
    ReviewResponse,
    PublicReviewResponse,
    ReviewSummaryResponse
)
from app.dependencies.auth import require_role
from app.models import User

router = APIRouter(
    prefix="/reviews",
    tags=["Reviews"]
)

@router.get("/products/{product_id}", response_model=list[PublicReviewResponse])
def get_product_reviews(
    product_id: int,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db)
):
    product = db.query(Product).filter(
        Product.id == product_id
    ).first()

    if product is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )
    
    reviews = db.query(Review).filter(
        Review.product_id == product_id
    ).order_by(
        Review.created_at.desc()
    ).offset(skip).limit(limit).all()

    return reviews

@router.get("/products/{product_id}/summary", response_model= ReviewSummaryResponse)
def get_product_review_summary(
    product_id: int,
    db: Session = Depends(get_db)
):
    product = db.query(Product).filter(
        Product.id == product_id
    ).first()

    if product is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )
    
    result = db.query(
        func.avg(Review.rating),
        func.count(Review.id)
    ).filter(
        Review.product_id == product_id
    ).first()

    average_rating = result[0] or 0
    total_reviews = result[1]

    rating_results = db.query(
        Review.rating,
        func.count(Review.id)
    ).filter(
        Review.product_id == product_id
    ).group_by(
        Review.rating
    ).all()

    rating_distribution = {
        rating: 0 for rating in range(1, 6)
    }

    for rating, count in rating_results:
        rating_distribution[rating] = count

    return {
        "product_id": product_id,
        "average_rating": round(float(average_rating), 2),
        "total_reviews": total_reviews,
        "rating_distribution": rating_distribution
    }

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

@router.patch("/{review_id}", response_model=ReviewResponse)
def update_review(
    review_id: int,
    review_data: ReviewUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("BUYER"))
):
    review = db.query(Review).filter(
        Review.id == review_id
    ).first()

    if review is None:
        raise HTTPException(
            status_code=404,
            detail="Review not found"
        )
    
    if review.buyer_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You are not allowed to update this review"
        )
    
    if (
        review_data.rating is None
        and review_data.comment is None
    ):
        raise HTTPException(
            status_code=400,
            detail="At least one field (rating or comment) is required"
        )

    if review_data.rating is not None:
        review.rating = review_data.rating

    if review_data.comment is not None:
        review.comment = review_data.comment.strip()
    

    db.commit()
    db.refresh(review)

    return review

@router.delete("/{review_id}", status_code=204)
def delete_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("BUYER"))
):
    review = db.query(Review).filter(
        Review.id == review_id
    ).first()

    if review is None:
        raise HTTPException(
            status_code=404,
            detail="Review not found"
        )
    
    if review.buyer_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You are not allowed to delete this review"
        )

    db.delete(review)
    db.commit()

    return None