
"""enforce order item seller ownership and financial balance

Revision ID: 757d856086eb
Revises: 3a32305687e1
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '757d856086eb'
down_revision: Union[str, Sequence[str], None] = '3a32305687e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:

    connection = op.get_bind()

    # 1. Validate existing financial records.
    invalid_financials = connection.execute(
        sa.text("""
            SELECT COUNT(*)
            FROM seller_orders
            WHERE commission_amount + seller_earning <> subtotal
        """)
    ).scalar_one()

    if invalid_financials:
        raise RuntimeError(
            f"{invalid_financials} seller orders have invalid financial balances."
        )

    # 2. Validate existing product and seller-order relationships.
    mismatches = connection.execute(
        sa.text("""
            SELECT COUNT(*)
            FROM order_items oi
            JOIN products p ON p.id = oi.product_id
            JOIN seller_orders so ON so.id = oi.seller_order_id
            WHERE p.seller_id <> so.seller_id
        """)
    ).scalar_one()

    if mismatches:
        raise RuntimeError(
            f"{mismatches} order items have mismatched sellers."
        )

    # 3. Add seller_id as nullable first.
    op.add_column(
        'order_items',
        sa.Column('seller_id', sa.BigInteger(), nullable=True)
    )

    # 4. Backfill historical order items.
    connection.execute(
        sa.text("""
            UPDATE order_items oi
            SET seller_id = p.seller_id
            FROM products p
            WHERE oi.product_id = p.id
        """)
    )

    # 5. Validate the backfill.
    missing_sellers = connection.execute(
        sa.text("""
            SELECT COUNT(*)
            FROM order_items
            WHERE seller_id IS NULL
        """)
    ).scalar_one()

    if missing_sellers:
        raise RuntimeError(
            f"{missing_sellers} order items have no seller_id after backfill."
        )

    remaining_mismatches = connection.execute(
        sa.text("""
            SELECT COUNT(*)
            FROM order_items oi
            JOIN products p ON p.id = oi.product_id
            JOIN seller_orders so ON so.id = oi.seller_order_id
            WHERE oi.seller_id <> p.seller_id
               OR oi.seller_id <> so.seller_id
        """)
    ).scalar_one()

    if remaining_mismatches:
        raise RuntimeError(
            f"{remaining_mismatches} order items have inconsistent seller IDs."
        )

    # 6. Make seller_id mandatory.
    op.alter_column(
        'order_items',
        'seller_id',
        existing_type=sa.BigInteger(),
        nullable=False
    )

    # 7. Add composite unique constraints.
    op.create_unique_constraint(
        'uq_products_id_seller_id',
        'products',
        ['id', 'seller_id']
    )

    op.create_unique_constraint(
        'uq_seller_orders_id_seller_id',
        'seller_orders',
        ['id', 'seller_id']
    )

    # 8. Add composite foreign keys.
    op.create_foreign_key(
        'fk_order_items_product_seller',
        'order_items',
        'products',
        ['product_id', 'seller_id'],
        ['id', 'seller_id']
    )

    op.create_foreign_key(
        'fk_order_items_seller_order_seller',
        'order_items',
        'seller_orders',
        ['seller_order_id', 'seller_id'],
        ['id', 'seller_id']
    )

    # 9. Enforce financial arithmetic.
    op.create_check_constraint(
        'ck_seller_orders_financials_balance',
        'seller_orders',
        'commission_amount + seller_earning = subtotal'
    )


def downgrade() -> None:

    # Remove financial constraint.
    op.drop_constraint(
        'ck_seller_orders_financials_balance',
        'seller_orders',
        type_='check'
    )

    # Remove composite foreign keys.
    op.drop_constraint(
        'fk_order_items_seller_order_seller',
        'order_items',
        type_='foreignkey'
    )

    op.drop_constraint(
        'fk_order_items_product_seller',
        'order_items',
        type_='foreignkey'
    )

    # Remove composite unique constraints.
    op.drop_constraint(
        'uq_seller_orders_id_seller_id',
        'seller_orders',
        type_='unique'
    )

    op.drop_constraint(
        'uq_products_id_seller_id',
        'products',
        type_='unique'
    )

    # Remove the added column.
    op.drop_column('order_items', 'seller_id')
