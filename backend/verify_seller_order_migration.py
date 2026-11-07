from sqlalchemy import text
from app.database import engine

with engine.connect() as conn:

    columns = conn.execute(
        text("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'order_items'
            AND column_name = 'seller_order_id'
        """)
    ).fetchall()

    order_items = conn.execute(
        text("SELECT COUNT(*) FROM order_items")
    ).scalar()

    seller_orders = conn.execute(
        text("SELECT COUNT(*) FROM seller_orders")
    ).scalar()

    print("New column:", columns)
    print("Order items:", order_items)
    print("Seller orders:", seller_orders)