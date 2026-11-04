from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime

class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=1, max_length=2000)


class ReviewUpdate(BaseModel):
    rating: int | None = Field(default=None, ge=1, le=5)
    comment: str | None = Field(
        default=None,
        min_length=1,
        max_length=2000
    )


class ReviewResponse(BaseModel):
    id: int
    buyer_id: int
    product_id: int
    order_id: int
    rating: int
    comment: str

    model_config = ConfigDict(from_attributes=True)

class PublicReviewResponse(BaseModel):
    id: int
    product_id: int
    rating: int
    comment: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ReviewSummaryResponse(BaseModel):
    product_id: int
    average_rating: float
    total_reviews: int
    rating_distribution: dict[int, int]