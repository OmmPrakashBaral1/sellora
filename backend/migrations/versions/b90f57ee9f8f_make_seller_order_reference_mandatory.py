
"""Make seller order reference mandatory

Revision ID: b90f57ee9f8f
Revises: a4dc1a32e050
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b90f57ee9f8f'
down_revision: Union[str, Sequence[str], None] = 'a4dc1a32e050'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:

    connection = op.get_bind()

    # 1. Verify every order item has a valid seller.
    unmatched = connection.execute(
        sa.text("""
            SELECT COUNT(*)
            FROM order_items oi
            LEFT JOIN products p ON p.id = oi.product_id
            LEFT JOIN seller_profiles sp ON sp.id = p.seller_id
            WHERE p.id IS NULL OR sp.id IS NULL
        """)
    ).scalar_one()

    if unmatched:
        raise RuntimeError(
            f"{unmatched} order items have no valid seller."
        )

    # 2. Create missing SellerOrders.
    # Historical financial values remain unchanged.
    connection.execute(
        sa.text("""
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
                SUM(oi.price_at_purchase * oi.quantity),
                0.00,
                0.00,
                SUM(oi.price_at_purchase * oi.quantity),
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
            ON CONFLICT (order_id, seller_id) DO NOTHING
        """)
    )

    # 3. Link historical order items.
    connection.execute(
        sa.text("""
            UPDATE order_items oi
            SET seller_order_id = so.id
            FROM products p, seller_orders so
            WHERE p.id = oi.product_id
              AND so.order_id = oi.order_id
              AND so.seller_id = p.seller_id
              AND oi.seller_order_id IS NULL
        """)
    )

    # 4. Verify every item is linked.
    unlinked = connection.execute(
        sa.text("""
            SELECT COUNT(*)
            FROM order_items
            WHERE seller_order_id IS NULL
        """)
    ).scalar_one()

    if unlinked:
        raise RuntimeError(
            f"{unlinked} order items remain unlinked."
        )

    # 5. Make the relationship mandatory.
    op.alter_column(
        'order_items',
        'seller_order_id',
        existing_type=sa.BIGINT(),
        nullable=False
    )


def downgrade() -> None:

    op.alter_column(
        'order_items',
        'seller_order_id',
        existing_type=sa.BIGINT(),
        nullable=True
    )
