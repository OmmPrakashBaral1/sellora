
"""Add order and financial integrity constraints

Revision ID: 3a32305687e1
Revises: b90f57ee9f8f
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '3a32305687e1'
down_revision: Union[str, Sequence[str], None] = 'b90f57ee9f8f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:

    connection = op.get_bind()

    checks = {
        "Invalid order quantities": """
            SELECT COUNT(*) FROM order_items
            WHERE quantity <= 0
        """,
        "Invalid purchase prices": """
            SELECT COUNT(*) FROM order_items
            WHERE price_at_purchase <= 0
        """,
        "Invalid payment amounts": """
            SELECT COUNT(*) FROM payments
            WHERE amount <= 0
        """,
        "Invalid seller subtotals": """
            SELECT COUNT(*) FROM seller_orders
            WHERE subtotal <= 0
        """,
        "Invalid commission rates": """
            SELECT COUNT(*) FROM seller_orders
            WHERE commission_rate < 0 OR commission_rate > 100
        """,
        "Negative commission amounts": """
            SELECT COUNT(*) FROM seller_orders
            WHERE commission_amount < 0
        """,
        "Negative seller earnings": """
            SELECT COUNT(*) FROM seller_orders
            WHERE seller_earning < 0
        """,
    }

    for description, query in checks.items():
        count = connection.execute(
            sa.text(query)
        ).scalar_one()

        if count:
            raise RuntimeError(
                f"Cannot apply migration: {description}: {count}"
            )

    op.create_check_constraint(
        "ck_order_items_quantity_positive",
        "order_items",
        "quantity > 0"
    )

    op.create_check_constraint(
        "ck_order_items_price_positive",
        "order_items",
        "price_at_purchase > 0"
    )

    op.create_check_constraint(
        "ck_payments_amount_positive",
        "payments",
        "amount > 0"
    )

    op.create_check_constraint(
        "ck_seller_orders_subtotal_positive",
        "seller_orders",
        "subtotal > 0"
    )

    op.create_check_constraint(
        "ck_seller_orders_commission_rate_valid",
        "seller_orders",
        "commission_rate >= 0 AND commission_rate <= 100"
    )

    op.create_check_constraint(
        "ck_seller_orders_commission_nonnegative",
        "seller_orders",
        "commission_amount >= 0"
    )

    op.create_check_constraint(
        "ck_seller_orders_earning_nonnegative",
        "seller_orders",
        "seller_earning >= 0"
    )

    op.drop_constraint(
        "fk_order_items_seller_order_id_seller_orders",
        "order_items",
        type_="foreignkey"
    )

    op.create_unique_constraint(
        "uq_seller_orders_id_order_id",
        "seller_orders",
        ["id", "order_id"]
    )

    op.create_foreign_key(
        "fk_order_items_seller_order_order",
        "order_items",
        "seller_orders",
        ["seller_order_id", "order_id"],
        ["id", "order_id"]
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_order_items_seller_order_order",
        "order_items",
        type_="foreignkey"
    )

    op.drop_constraint(
        "uq_seller_orders_id_order_id",
        "seller_orders",
        type_="unique"
    )

    op.create_foreign_key(
        "fk_order_items_seller_order_id_seller_orders",
        "order_items",
        "seller_orders",
        ["seller_order_id"],
        ["id"]
    )

    op.drop_constraint(
        "ck_seller_orders_earning_nonnegative",
        "seller_orders",
        type_="check"
    )

    op.drop_constraint(
        "ck_seller_orders_commission_nonnegative",
        "seller_orders",
        type_="check"
    )

    op.drop_constraint(
        "ck_seller_orders_commission_rate_valid",
        "seller_orders",
        type_="check"
    )

    op.drop_constraint(
        "ck_seller_orders_subtotal_positive",
        "seller_orders",
        type_="check"
    )

    op.drop_constraint(
        "ck_payments_amount_positive",
        "payments",
        type_="check"
    )

    op.drop_constraint(
        "ck_order_items_price_positive",
        "order_items",
        type_="check"
    )

    op.drop_constraint(
        "ck_order_items_quantity_positive",
        "order_items",
        type_="check"
    )
