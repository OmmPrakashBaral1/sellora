
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


class SellerApplicationCreate(BaseModel):
    store_name: str = Field(min_length=3, max_length=100)
    description: str = Field(min_length=10, max_length=2000)

    @field_validator("store_name", "description")
    @classmethod
    def strip_and_validate_text(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("This field cannot be empty.")

        return value


class SellerApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    store_name: str
    description: str
    status: str
    rejection_reason: str | None
    reviewed_by: int | None
    reviewed_at: object | None
    created_at: object
    updated_at: object


class SellerApplicationReview(BaseModel):
    decision: Literal["APPROVED", "REJECTED"]
    rejection_reason: str | None = Field(default=None, max_length=1000)

    @field_validator("rejection_reason")
    @classmethod
    def normalize_rejection_reason(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        value = value.strip()

        return value or None

    @model_validator(mode="after")
    def validate_review_decision(self):
        if self.decision == "REJECTED" and not self.rejection_reason:
            raise ValueError(
                "A rejection reason is required when rejecting an application."
            )

        if self.decision == "APPROVED" and self.rejection_reason:
            raise ValueError(
                "A rejection reason cannot be provided for an approval."
            )

        return self
