from decimal import Decimal
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models import (
    User,
    SellerProfile,
    Product,
    Order,
    OrderItem,
    SellerOrder,
    Payment
)


def create_pending_payment_order(db: Session):
    suffix = uuid4().hex[:12]

    buyer = User(
        name="Test Buyer",
        gmail=f"buyer_{suffix}@example.com",
        password_hash="unused-test-password-hash",
        role="BUYER"
    )

    seller_user = User(
        name="Test Seller",
        gmail=f"seller_{suffix}@example.com",
        password_hash="unused-test-password-hash",
        role="SELLER"
    )

    db.add_all([buyer, seller_user])
    db.flush()

    seller = SellerProfile(
        user_id=seller_user.id,
        store_name="Test Digital Store",
        description="Store created for automated testing"
    )

    db.add(seller)
    db.flush()

    product = Product(
        seller_id=seller.id,
        title="Test Digital Product",
        description="Product created for automated testing",
        price=Decimal("799.00"),
        demo_url="https://example.com/demo",
        thumbnail_url="https://example.com/thumbnail.png",
        product_url=None,
        file_storage_key=None,
        status="APPROVED",
        tags=["testing", "digital"]
    )

    db.add(product)
    db.flush()

    order = Order(
        buyer_id=buyer.id,
        total_amount=Decimal("799.00"),
        status="PENDING"
    )

    db.add(order)
    db.flush()

    seller_order = SellerOrder(
        order_id=order.id,
        seller_id=seller.id,
        subtotal=Decimal("799.00"),
        commission_rate=Decimal("10.00"),
        commission_amount=Decimal("79.90"),
        seller_earning=Decimal("719.10"),
        status="PENDING"
    )

    db.add(seller_order)
    db.flush()

    order_item = OrderItem(
        order_id=order.id,
        seller_order_id=seller_order.id,
        product_id=product.id,
        seller_id=seller.id,
        price_at_purchase=Decimal("799.00"),
        quantity=1
    )

    payment = Payment(
        order_id=order.id,
        amount=Decimal("799.00"),
        provider="RAZORPAY",
        razorpay_order_id=f"order_test_{suffix}",
        razorpay_payment_id=None,
        status="PENDING"
    )

    db.add_all([order_item, payment])
    db.flush()

    return {
        "buyer": buyer,
        "seller_user": seller_user,
        "seller": seller,
        "product": product,
        "order": order,
        "seller_order": seller_order,
        "order_item": order_item,
        "payment": payment
    }

def create_multi_seller_payment_order(db: Session):
    records = create_pending_payment_order(db)

    suffix = uuid4().hex[:12]

    order = records["order"]
    payment = records["payment"]

    second_seller_user = User(
        name="Second Test Seller",
        gmail=f"seller2_{suffix}@example.com",
        password_hash="unused-test-password-hash",
        role="SELLER"
    )

    db.add(second_seller_user)
    db.flush()

    second_seller = SellerProfile(
        user_id=second_seller_user.id,
        store_name="Second Digital Store",
        description="Second seller for integration testing"
    )

    db.add(second_seller)
    db.flush()

    second_product = Product(
        seller_id=second_seller.id,
        title="Second Digital Product",
        description="Second product for testing",
        price=Decimal("499.00"),
        demo_url="https://example.com/demo2",
        thumbnail_url="https://example.com/thumbnail2.png",
        product_url=None,
        file_storage_key=None,
        status="APPROVED",
        tags=["testing"]
    )

    db.add(second_product)
    db.flush()

    second_seller_order = SellerOrder(
        order_id=order.id,
        seller_id=second_seller.id,
        subtotal=Decimal("499.00"),
        commission_rate=Decimal("10.00"),
        commission_amount=Decimal("49.90"),
        seller_earning=Decimal("449.10"),
        status="PENDING"
    )

    db.add(second_seller_order)
    db.flush()

    second_order_item = OrderItem(
        order_id=order.id,
        seller_order_id=second_seller_order.id,
        product_id=second_product.id,
        seller_id=second_seller.id,
        price_at_purchase=Decimal("499.00"),
        quantity=1
    )

    db.add(second_order_item)

    order.total_amount += Decimal("499.00")
    payment.amount = order.total_amount

    db.flush()

    records["second_seller_user"] = second_seller_user
    records["second_seller"] = second_seller
    records["second_product"] = second_product
    records["second_seller_order"] = second_seller_order
    records["second_order_item"] = second_order_item

    return records