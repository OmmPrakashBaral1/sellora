
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.database import engine


with engine.connect() as conn:
    outer_transaction = conn.begin()

    try:
        pair = conn.execute(
            text("""
                SELECT
                    p.id AS product_id,
                    p.price,
                    p.seller_id AS product_seller_id,
                    so.id AS seller_order_id,
                    so.order_id,
                    so.seller_id AS order_seller_id
                FROM products p
                CROSS JOIN seller_orders so
                WHERE p.seller_id <> so.seller_id
                LIMIT 1
            """)
        ).mappings().first()

        if pair is None:
            raise RuntimeError(
                "No cross-seller product/order pair found."
            )

        tests = [
            (
                "Product-seller composite FK",
                pair["order_seller_id"]
            ),
            (
                "Seller-order composite FK",
                pair["product_seller_id"]
            )
        ]

        for description, invalid_seller_id in tests:
            savepoint = conn.begin_nested()

            try:
                conn.execute(
                    text("""
                        INSERT INTO order_items (
                            order_id,
                            seller_order_id,
                            product_id,
                            seller_id,
                            price_at_purchase,
                            quantity
                        )
                        VALUES (
                            :order_id,
                            :seller_order_id,
                            :product_id,
                            :seller_id,
                            :price,
                            1
                        )
                    """),
                    {
                        "order_id": pair["order_id"],
                        "seller_order_id": pair["seller_order_id"],
                        "product_id": pair["product_id"],
                        "seller_id": invalid_seller_id,
                        "price": pair["price"]
                    }
                )

                savepoint.commit()
                raise AssertionError(
                    f"{description} accepted invalid data!"
                )

            except IntegrityError:
                savepoint.rollback()
                print(f"PASSED: {description}")

        seller_order_id = conn.execute(
            text("SELECT id FROM seller_orders LIMIT 1")
        ).scalar_one()

        savepoint = conn.begin_nested()

        try:
            conn.execute(
                text("""
                    UPDATE seller_orders
                    SET seller_earning = seller_earning + 0.01
                    WHERE id = :seller_order_id
                """),
                {"seller_order_id": seller_order_id}
            )

            savepoint.commit()
            raise AssertionError(
                "Financial balance CHECK accepted invalid data!"
            )

        except IntegrityError:
            savepoint.rollback()
            print("PASSED: Financial balance CHECK")

    finally:
        outer_transaction.rollback()

print("\nAll test transactions rolled back.")
