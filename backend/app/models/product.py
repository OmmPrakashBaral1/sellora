from sqlalchemy import (
    Column,
    BigInteger,
    String,
    Text,
    Numeric,
    Integer,
    ForeignKey,
    TIMESTAMP,
    func,
    ARRAY
)
from sqlalchemy.orm import relationship

from app.database import Base

class Product(Base):
    __tablename__ = "products"

    id= Column(BigInteger, primary_key= True, index= True)
    seller_id = Column(
        BigInteger,
        ForeignKey("seller_profiles.id"),
        nullable=False
    )

    title = Column(String(200), nullable=False)
    description= Column(Text, nullable= False)
    price= Column(Numeric(10, 2), nullable= False)

    demo_url= Column(String(255), nullable= False)
    thumbnail_url= Column(String(255), nullable= False)
    product_url= Column(String(255), nullable= False)

    status= Column(String(20), nullable=False)
    tags = Column(
        ARRAY(String(50)),
        nullable=False,
        default=list
    )

    created_at= Column(
        TIMESTAMP,
        server_default= func.now()
    )
    updated_at= Column(
        TIMESTAMP,
        server_default= func.now(),
        onupdate= func.now()
    )

    seller = relationship("SellerProfile")