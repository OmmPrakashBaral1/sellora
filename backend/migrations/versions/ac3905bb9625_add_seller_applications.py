
"""add seller applications

Revision ID: ac3905bb9625
Revises: 757d856086eb
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "ac3905bb9625"
down_revision: Union[str, Sequence[str], None] = "757d856086eb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "seller_applications",
        sa.Column("id", sa.BigInteger(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("store_name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            server_default=sa.text("'PENDING'"),
            nullable=False,
        ),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("reviewed_by", sa.BigInteger(), nullable=True),
        sa.Column(
            "reviewed_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('PENDING', 'APPROVED', 'REJECTED')",
            name="ck_seller_applications_status_valid",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by"],
            ["users.id"],
        ),
    )

    op.create_index(
        "ix_seller_applications_user_id",
        "seller_applications",
        ["user_id"],
        unique=False,
    )

    op.create_index(
        "uq_seller_applications_one_pending_per_user",
        "seller_applications",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("status = 'PENDING'"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_seller_applications_one_pending_per_user",
        table_name="seller_applications",
    )

    op.drop_index(
        "ix_seller_applications_user_id",
        table_name="seller_applications",
    )

    op.drop_table("seller_applications")
