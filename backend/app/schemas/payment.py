
from pydantic import BaseModel, ConfigDict, Field


class PaymentVerify(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    razorpay_order_id: str = Field(min_length=1)
    razorpay_payment_id: str = Field(min_length=1)
    razorpay_signature: str = Field(min_length=1)
