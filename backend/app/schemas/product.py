from decimal import Decimal
from pydantic import BaseModel, Field, HttpUrl, ConfigDict, field_validator

class ProductCreate(BaseModel):
    title: str = Field(..., min_length= 3, max_length= 200)
    description: str = Field(..., min_length=10)
    price: Decimal = Field(..., gt=0, max_digits=10, decimal_places=2)
    demo_url: HttpUrl
    thumbnail_url: HttpUrl
    product_url: HttpUrl
    tags: list[str] = Field(default_factory=list, max_length=10)

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, tags):
        cleaned_tags = []

        for tag in tags:
            tag = tag.strip().lower()

            if not tag:
                raise ValueError ("Tags cannot be empty")
            
            if len(tag) > 50:
                raise ValueError("Each tag must not exceed 50 characters")
            if tag not in cleaned_tags:
                cleaned_tags.append(tag)
            
        return cleaned_tags

class ProductResponse(BaseModel):
    id: int
    seller_id: int
    title: str
    description: str
    price: Decimal
    demo_url: str
    thumbnail_url: str
    product_url: str
    status: str
    tags: list[str]

    model_config = ConfigDict(from_attributes=True)

class ProductUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length= 200)
    description: str | None = Field(default=None, min_length=10)
    price: Decimal | None = Field(
        default= None, gt= 0, max_digits= 10, decimal_places=2
    )
    demo_url: HttpUrl | None = None
    thumbnail_url: HttpUrl | None = None
    product_url: HttpUrl | None = None
    tags: list[str] | None = Field(
        default=None,
        max_length=10
    )

    model_config = ConfigDict(validate_assignment=True)

    @classmethod
    def model_validate(cls, obj, **kwargs):
        return super().model_validate(obj, **kwargs)
    
    @field_validator("tags")
    @classmethod
    def validate_tags(cls, tags):
        if tag is None:
            return None
        cleaned_tags= []

        for tag in tags:
            tag = tag.strip().lower()

            if not tag:
                raise ValueError("Tags cannot be empty")

            if len(tag) > 50:
                raise ValueError("Each tag must not exceed 50 characters")
            
            if tag not in cleaned_tags:
                cleaned_tags.append(tag)
        
        return cleaned_tags


class PublicProductResponse(BaseModel):
    id: int
    title: str
    description: str
    price: Decimal
    demo_url: str
    thumbnail_url: str
    status: str
    tags: list[str]

    model_config = ConfigDict(from_attributes=True)
