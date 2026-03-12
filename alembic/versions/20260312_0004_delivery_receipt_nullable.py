from alembic import op
import sqlalchemy as sa


revision = "20260312_0004"
down_revision = "20260312_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "message_delivery_receipts",
        "delivered_at",
        existing_type=sa.DateTime(timezone=True),
        nullable=True,
    )
    op.execute(
        "CREATE OR REPLACE FUNCTION ensure_messages_partitions(months_ahead INTEGER DEFAULT 12) RETURNS VOID AS $$ "
        "BEGIN "
        "RETURN; "
        "END; "
        "$$ LANGUAGE plpgsql"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE message_delivery_receipts "
        "SET delivered_at = COALESCE(delivered_at, persisted_at, queued_at, now()) "
        "WHERE delivered_at IS NULL"
    )
    op.alter_column(
        "message_delivery_receipts",
        "delivered_at",
        existing_type=sa.DateTime(timezone=True),
        nullable=False,
    )
