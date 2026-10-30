from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Product, User
from app.schemas.product import (
    ProductCreate,
    ProductResponse,
    ProductUpdate,
    PublicProductResponse
)
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
        Product.seller_id == seller_profile.id,
        Product.status != "DELETED"
    ).order_by(Product.id.desc()).all()

    return products

@router.get("/marketplace", response_model=list[PublicProductResponse])
def get_marketplace_products(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    products = db.query(Product).filter(
        Product.status == "APPROVED"
    ).order_by(
        Product.id.desc()
    ).offset(skip).limit(limit).all()

    return products

@router.get("/marketplace/{product_id}", response_model=PublicProductResponse)
def get_marketplace_product(
    product_id: int,
    db: Session = Depends(get_db)
):
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.status == "APPROVED"
    ).first()

    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )
    
    return product

@router.get("/{product_id}", response_model= ProductResponse)
def get_my_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("SELLER"))
):
    seller_profile = db.query(SellerProfile).filter(
        SellerProfile.user_id == current_user.id
    ).first()

    if not seller_profile:
        raise HTTPException(
            status_code= 404,
            detail= "Seller profile not found for this account"
        )
    
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.seller_id == seller_profile.id,
        Product.status != "DELETED"
    ).first()

    if not product:
        raise HTTPException(
            status_code= 404,
            detail= "Product not found"
        )
    
    return product

@router.patch("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    product_data: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("SELLER"))
):
    seller_profile = db.query(SellerProfile).filter(
        SellerProfile.user_id == current_user.id
    ).first()

    if not seller_profile:
        raise HTTPException(
            status_code= 404,
            detail="Seller Profile not found for this account"
        )
    
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.seller_id == seller_profile.id,
        Product.status != "DELETED"
    ).first()

    if not product:
        raise HTTPException(
            status_code= 404,
            detail= " Product not found"
        )
    
    update_data = product_data.model_dump(exclude_unset=True)
    if any(value is None for value in update_data.values()):
        raise HTTPException(
            status_code=422,
            detail="Fields cannot be null. Omit fields you do not want to update."
        )

    if not update_data:
        raise HTTPException(
            status_code= 400,
            detail= "Provide atleast one field to update"
        )

    for field, value in update_data.items():
        if field in {"demo_url", "thumbnail_url", "product_url"}:
            value = str(value)
        setattr(product, field, value)
    
    if product.status in {"APPROVED", "REJECTED"}:
        product.status = "PENDING"
    
    try:
        db.commit()
        db.refresh(product)
    except Exception as e:
        db.rollback()
        print("PRODUCT UPDATE ERROR:", repr(e))
        raise HTTPException(
            status_code= 500,
            detail="Failed to update product. Check the server terminal"
        )
    return product

@router.delete("/{product_id}")
def soft_delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("SELLER"))
):
    seller_profile = db.query(SellerProfile).filter(
        SellerProfile.user_id == current_user.id
    ).first()

    if not seller_profile:
        raise HTTPException(
            status_code= 404,
            detail= "Seller Profile not found for this account"
        )

    product = db.query(Product).filter(
        Product.id == product_id,
        Product.seller_id == seller_profile.id,
        Product.status != "DELETED"
    ).first()

    if not product:
        raise HTTPException(
            status_code= 404,
            detail="Product not found"
        )
    
    product.status = "DELETED"

    try:
        db.commit()
        db.refresh(product)
    except Exception as e:
        db.rollback()
        print("PRODUCT SOFT DELETE ERROR:", repr(e))
        raise HTTPException(
            status_code= 500,
            detail= "Failed to delete product. Check the server terminal."
        )
    
    return {
        "message": "Product Deleted Successfully",
        "product_id": product_id
    }

@router.delete("/{product_id}/permanent")
def permanently_delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("SELLER"))
):
    seller_profile = db.query(SellerProfile).filter(
        SellerProfile.user_id == current_user.id
    ).first()

    if not seller_profile:
        raise HTTPException(
            status_code= 404,
            detail= "Seller Profile not found for this account"
        )
    
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.seller_id == seller_profile.id,
        Product.status == "DELETED"
    ).first()

    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    try:
        db.delete(product)
        db.commit()
    except Exception as e:
        db.rollback()
        print("PRODUCT PERMANENT DELETE ERROR:", repr(e))
        raise HTTPException(
            status_code=409,
            detail="Cannot permanently delete this product because it may have related database records."
        )

    return {
        "message": "Product permanently deleted",
        "product_id": product_id
    }


@router.patch("/{product_id}/approve")
def approve_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN"))
):
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.status != "DELETED"
    ).first()

    if product is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    if product.status == "APPROVED":
        raise HTTPException(
            status_code=400,
            detail="Product is already approved"
        )

    product.status = "APPROVED"

    try:
        db.commit()
        db.refresh(product)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to approve product"
        )

    return {
        "message": "Product approved successfully",
        "product_id": product.id,
        "status": product.status
    }
