
from sqlalchemy import text
from app.database import engine


def backfill_seller_orders():

    with engine.begin() as conn:

        # 1. Verify every historical order item has a valid seller.
        unmatched = conn.execute(
            text("""
                SELECT COUNT(*)
                FROM order_items oi
                LEFT JOIN products p ON p.id = oi.product_id
                LEFT JOIN seller_profiles sp ON sp.id = p.seller_id
                WHERE p.id IS NULL OR sp.id IS NULL
            """)
        ).scalar()

        if unmatched:
            raise RuntimeError(
                f"Found {unmatched} order items without a valid seller."
            )

        # 2. Create one historical SellerOrder per
        #    parent order and seller.
        conn.execute(
            text("""
                INSERT INTO seller_orders (
                    order_id,
                    seller_id,
                    subtotal,
                    commission_rate,
                    commission_amount,
                    seller_earning,
                    status,
                    created_at,
                    updated_at
                )
                SELECT
                    oi.order_id,
                    p.seller_id,
                    SUM(
                        oi.price_at_purchase * oi.quantity
                    ),
                    0.00,
                    0.00,
                    SUM(
                        oi.price_at_purchase * oi.quantity
                    ),
                    o.status,
                    o.created_at,
                    o.updated_at
                FROM order_items oi
                JOIN products p ON p.id = oi.product_id
                JOIN orders o ON o.id = oi.order_id
                GROUP BY
                    oi.order_id,
                    p.seller_id,
                    o.status,
                    o.created_at,
                    o.updated_at
                ON CONFLICT (order_id, seller_id)
                DO NOTHING
            """)
        )

        # 3. Connect each historical order item
        #    to its corresponding SellerOrder.
        conn.execute(
            text("""
                UPDATE order_items oi
                SET seller_order_id = so.id
                FROM products p, seller_orders so
                WHERE p.id = oi.product_id
                  AND so.order_id = oi.order_id
                  AND so.seller_id = p.seller_id
                  AND oi.seller_order_id IS NULL
            """)
        )

        # 4. Verify that every item has been linked.
        unlinked = conn.execute(
            text("""
                SELECT COUNT(*)
                FROM order_items
                WHERE seller_order_id IS NULL
            """)
        ).scalar()

        if unlinked:
            raise RuntimeError(
                f"Backfill incomplete: {unlinked} items remain unlinked."
            )

        # 5. Print final counts.
        seller_order_count = conn.execute(
            text("SELECT COUNT(*) FROM seller_orders")
        ).scalar()

        linked_item_count = conn.execute(
            text("""
                SELECT COUNT(*)
                FROM order_items
                WHERE seller_order_id IS NOT NULL
            """)
        ).scalar()

        print("Historical backfill completed!")
        print("Seller orders created/present:", seller_order_count)
        print("Order items linked:", linked_item_count)


if __name__ == "__main__":
    backfill_seller_orders()
