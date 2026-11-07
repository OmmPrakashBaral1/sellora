from sqlalchemy import text
from app.database import engine

with engine.connect() as conn:

    seller_orders = conn.execute(
        text("SELECT COUNT(*) FROM seller_orders")
    ).scalar()

    order_items = conn.execute(
        text("SELECT COUNT(*) FROM order_items")
    ).scalar()

    unlinked_items = conn.execute(
        text("""
            SELECT COUNT(*)
            FROM order_items
            WHERE seller_order_id IS NULL
        """)
    ).scalar()

    invalid_financials = conn.execute(
        text("""
            SELECT COUNT(*)
            FROM seller_orders
            WHERE commission_rate != 0
               OR commission_amount != 0
               OR seller_earning != subtotal
        """)
    ).scalar()

    nullable = conn.execute(
        text("""
            SELECT is_nullable
            FROM information_schema.columns
            WHERE table_name = 'order_items'
              AND column_name = 'seller_order_id'
        """)
    ).scalar()

    print("SellerOrders:", seller_orders)
    print("OrderItems:", order_items)
    print("Unlinked items:", unlinked_items)
    print("Invalid historical financial records:", invalid_financials)
    print("seller_order_id nullable:", nullable)