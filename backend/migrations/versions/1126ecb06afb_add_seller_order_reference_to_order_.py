
"""Add seller order reference to order items

Revision ID: 1126ecb06afb
Revises: e3d3d8806aef
Create Date: 2026-11-06 22:45:28.679873

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '1126ecb06afb'
down_revision: Union[str, Sequence[str], None] = 'e3d3d8806aef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    op.add_column(
        'order_items',
        sa.Column(
            'seller_order_id',
            sa.BigInteger(),
            nullable=True
        )
    )

    op.create_index(
        'ix_order_items_seller_order_id',
        'order_items',
        ['seller_order_id'],
        unique=False
    )

    op.create_foreign_key(
        'fk_order_items_seller_order_id_seller_orders',
        'order_items',
        'seller_orders',
        ['seller_order_id'],
        ['id']
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_constraint(
        'fk_order_items_seller_order_id_seller_orders',
        'order_items',
        type_='foreignkey'
    )

    op.drop_index(
        'ix_order_items_seller_order_id',
        table_name='order_items'
    )

    op.drop_column(
        'order_items',
        'seller_order_id'
    )
