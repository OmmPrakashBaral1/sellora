
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

            assert seller_order.order is not None

            assert seller_order.seller is not None

            assert len(seller_order.items) > 0

            for item in seller_order.items:

                assert item.seller_order_id == seller_order.id

                assert item.order_id == seller_order.order_id

                assert item.product.seller_id == seller_order.seller_id
            print(
                f"SellerOrder {seller_order.id}: "
                f"Order={seller_order.order_id}, "
                f"Seller={seller_order.seller_id}, "
                f"Items={len(seller_order.items)}, "
                f"Status={seller_order.status}"
            )

        orders = db.query(Order).all()

        for order in orders:
            assert len(order.seller_orders) > 0

        print("\nAll SQLAlchemy relationships verified successfully!")

    finally:
        db.close()


if __name__ == "__main__":
    verify_relationships()
