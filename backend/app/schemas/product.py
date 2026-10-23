from decimal import Decimal
from pydantic import BaseModel, Field, HttpUrl, ConfigDict

class ProductCreate(BaseModel):
    title: str = Field(..., min_length= 3, max_length= 200)
    description: str = Field(..., min_length=10)
    price: Decimal = Field(..., gt=0, max_digits=10, decimal_places=2)
    demo_url: HttpUrl
    thumbnail_url: HttpUrl
    product_url: HttpUrl

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

    model_config = ConfigDict(from_attributes=True)