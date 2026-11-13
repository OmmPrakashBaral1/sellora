
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.user import User
from app.models.seller_profile import SellerProfile
from app.models.seller_application import SellerApplication
from app.schemas.seller_application import (
    SellerApplicationCreate,
    SellerApplicationResponse,
    SellerApplicationReview,
)


router = APIRouter(
    prefix="/seller-applications",
    tags=["Seller Applications"],
)


@router.post(
    "/",
    response_model=SellerApplicationResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_seller_application(
    application_data: SellerApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "BUYER":
        raise HTTPException(
            status_code=403,
            detail="Only buyer accounts can submit seller applications.",
        )

    try:
        user = (
            db.query(User)
            .filter(User.id == current_user.id)
            .with_for_update()
            .first()
        )

        if not user or user.role != "BUYER":
            raise HTTPException(
                status_code=403,
                detail="This account is not eligible to apply.",
            )

        existing_profile = (
            db.query(SellerProfile)
            .filter(SellerProfile.user_id == user.id)
            .first()
        )

        if existing_profile:
            raise HTTPException(
                status_code=409,
                detail="This account already has a seller profile.",
            )

        existing_pending = (
            db.query(SellerApplication)
            .filter(
                SellerApplication.user_id == user.id,
                SellerApplication.status == "PENDING",
            )
            .first()
        )

        if existing_pending:
            raise HTTPException(
                status_code=409,
                detail="You already have a pending seller application.",
            )

        application = SellerApplication(
            user_id=user.id,
            store_name=application_data.store_name,
            description=application_data.description,
            status="PENDING",
        )

        db.add(application)
        db.commit()
        db.refresh(application)

        return application

    except HTTPException:
        db.rollback()
        raise

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="A pending seller application already exists.",
        )

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not submit seller application.",
        )


@router.get(
    "/me",
    response_model=list[SellerApplicationResponse],
)
def get_my_seller_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(SellerApplication)
        .filter(SellerApplication.user_id == current_user.id)
        .order_by(
            SellerApplication.created_at.desc(),
            SellerApplication.id.desc(),
        )
        .all()
    )


@router.get(
    "/admin",
    response_model=list[SellerApplicationResponse],
)
def get_seller_applications_for_admin(
    application_status: Literal["PENDING", "APPROVED", "REJECTED"] | None = Query(
        default=None,
        alias="status",
    ),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_role("ADMIN")),
):
    query = db.query(SellerApplication)

    if application_status:
        query = query.filter(
            SellerApplication.status == application_status
        )

    return (
        query
        .order_by(
            SellerApplication.created_at.asc(),
            SellerApplication.id.asc(),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.patch(
    "/{application_id}/review",
    response_model=SellerApplicationResponse,
)
def review_seller_application(
    application_id: int,
    review_data: SellerApplicationReview,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_role("ADMIN")),
):
    try:
        application = (
            db.query(SellerApplication)
            .filter(SellerApplication.id == application_id)
            .with_for_update()
            .first()
        )

        if not application:
            raise HTTPException(
                status_code=404,
                detail="Seller application not found.",
            )

        if application.status != "PENDING":
            raise HTTPException(
                status_code=409,
                detail="This application has already been reviewed.",
            )

        applicant = (
            db.query(User)
            .filter(User.id == application.user_id)
            .with_for_update()
            .first()
        )

        if not applicant:
            raise HTTPException(
                status_code=409,
                detail="The applicant account no longer exists.",
            )

        if applicant.role != "BUYER":
            raise HTTPException(
                status_code=409,
                detail="The applicant is no longer eligible for approval.",
            )

        existing_profile = (
            db.query(SellerProfile)
            .filter(SellerProfile.user_id == applicant.id)
            .first()
        )

        if existing_profile:
            raise HTTPException(
                status_code=409,
                detail="The applicant already has a seller profile.",
            )

        if review_data.decision == "APPROVED":
            seller_profile = SellerProfile(
                user_id=applicant.id,
                store_name=application.store_name,
                description=application.description,
                created_at=datetime.now(timezone.utc).replace(tzinfo=None)
            )

            db.add(seller_profile)
            applicant.role = "SELLER"

            application.status = "APPROVED"
            application.rejection_reason = None

        else:
            application.status = "REJECTED"
            application.rejection_reason = review_data.rejection_reason

        application.reviewed_by = current_admin.id
        application.reviewed_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(application)

        return application

    except HTTPException:
        db.rollback()
        raise

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="The application could not be processed because of a database conflict.",
        )

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not review seller application.",
        )
