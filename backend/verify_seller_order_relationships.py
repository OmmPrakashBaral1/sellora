
from sqlalchemy.orm import configure_mappers
from app.database import SessionLocal
from app.models import Order, OrderItem, SellerOrder


def verify_relationships():

    configure_mappers()

    db = SessionLocal()

    try:
        seller_orders = db.query(SellerOrder).all()

        print("Total SellerOrders:", len(seller_orders))

        for seller_order in seller_orders:

            # Verify parent order relationship
            assert seller_order.order is not None

            # Verify seller relationship
            assert seller_order.seller is not None

            # Verify order items relationship
            assert len(seller_order.items) > 0

            for item in seller_order.items:

                # Verify item points to this SellerOrder
                assert item.seller_order_id == seller_order.id

                # Verify product belongs to this seller
                assert item.product.seller_id == seller_order.seller_id

            print(
                f"SellerOrder {seller_order.id}: "
                f"Order={seller_order.order_id}, "
                f"Seller={seller_order.seller_id}, "
                f"Items={len(seller_order.items)}, "
                f"Status={seller_order.status}"
            )

        # Verify parent order can access its seller orders
        orders = db.query(Order).all()

        for order in orders:
            assert len(order.seller_orders) > 0

        print("\nAll SQLAlchemy relationships verified successfully!")

    finally:
        db.close()


if __name__ == "__main__":
    verify_relationships()
