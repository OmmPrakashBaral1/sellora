from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Product, User
from app.schemas.product import ProductCreate, ProductResponse
from app.dependencies.auth import require_role
from app.models.seller_profile import SellerProfile

router = APIRouter(
    prefix= "/products",
    tags=["Products"]
)


@router.post("/", response_model=ProductResponse, status_code=201)
def create_product(
    product_data: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("SELLER"))
):
    seller_profile = db.query(SellerProfile).filter(
        SellerProfile.user_id == current_user.id
    ).first()

    if not seller_profile:
        raise HTTPException(
            status_code=404,
            detail="Seller profile not found for this account"
        )

    product = Product(
        seller_id=seller_profile.id,
        title=product_data.title,
        description=product_data.description,
        price=product_data.price,
        demo_url=str(product_data.demo_url),
        thumbnail_url=str(product_data.thumbnail_url),
        product_url=str(product_data.product_url),
        status="PENDING"
    )

    db.add(product)

    try:
        db.commit()
        db.refresh(product)
    except Exception as e:
        db.rollback()
        print("PRODUCT CREATION ERROR:", repr(e))
        raise HTTPException(
            status_code=500,
            detail="Failed to create product. Check the server terminal."
        )

    return product



@router.get("/", response_model=list[ProductResponse])
def get_my_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("SELLER"))
):
    seller_profile = db.query(SellerProfile).filter(
        SellerProfile.user_id == current_user.id
    ).first()

    if not seller_profile:
        raise HTTPException(
            status_code=404,
            detail="Seller profile not found for this account"
        )

    products = db.query(Product).filter(
        Product.seller_id == seller_profile.id
    ).order_by(Product.id.desc()).all()

    return products
