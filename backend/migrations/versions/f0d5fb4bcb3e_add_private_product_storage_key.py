"""add private product storage key

Revision ID: f0d5fb4bcb3e
Revises: ac3905bb9625
Create Date: 2026-11-14 22:54:13.274637

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f0d5fb4bcb3e'
down_revision: Union[str, Sequence[str], None] = 'ac3905bb9625'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column(
            "file_storage_key",
            sa.String(length=255),
            nullable=True
        )
    )

    op.create_unique_constraint(
        "uq_products_file_storage_key",
        "products",
        ["file_storage_key"]
    )

    op.alter_column(
        "products",
        "product_url",
        existing_type=sa.String(length=255),
        nullable=True
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_products_file_storage_key",
        "products",
        type_="unique"
    )

    op.drop_column(
        "products",
        "file_storage_key"
    )

    op.alter_column(
        "products",
        "product_url",
        existing_type=sa.String(length=255),
        nullable=False
    )