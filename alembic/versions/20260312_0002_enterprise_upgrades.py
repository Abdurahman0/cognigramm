from alembic import op
import sqlalchemy as sa


revision = "20260312_0002"
down_revision = "20260312_0001"
branch_labels = None
depends_on = None


message_status_enum = sa.Enum("sent", "failed", name="message_status")


def upgrade() -> None:
    message_status_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "messages",
        sa.Column("client_message_id", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "messages",
        sa.Column("status", message_status_enum, nullable=False, server_default="sent"),
    )
    op.execute("UPDATE messages SET client_message_id = CONCAT('legacy-', id) WHERE client_message_id IS NULL")
    op.alter_column("messages", "client_message_id", nullable=False)
    op.create_index(op.f("ix_messages_client_message_id"), "messages", ["client_message_id"], unique=True)

    op.create_table(
        "message_attachments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("message_id", sa.Integer(), nullable=False),
        sa.Column("bucket", sa.String(length=128), nullable=False),
        sa.Column("object_key", sa.String(length=1024), nullable=False),
        sa.Column("original_name", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=255), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("public_url", sa.String(length=2048), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["message_id"],
            ["messages.id"],
            name=op.f("fk_message_attachments_message_id_messages"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_message_attachments")),
    )
    op.create_index(op.f("ix_message_attachments_message_id"), "message_attachments", ["message_id"], unique=False)

    op.create_table(
        "message_delivery_receipts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("message_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("delivered_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["message_id"],
            ["messages.id"],
            name=op.f("fk_message_delivery_receipts_message_id_messages"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_message_delivery_receipts_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_message_delivery_receipts")),
        sa.UniqueConstraint("message_id", "user_id", name="uq_message_delivery_receipts_message_user"),
    )
    op.create_index(
        op.f("ix_message_delivery_receipts_message_id"),
        "message_delivery_receipts",
        ["message_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_message_delivery_receipts_user_id"),
        "message_delivery_receipts",
        ["user_id"],
        unique=False,
    )

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_messages_content_tsv "
        "ON messages USING GIN (to_tsvector('simple', COALESCE(content, '')))"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_messages_content_tsv")

    op.drop_index(op.f("ix_message_delivery_receipts_user_id"), table_name="message_delivery_receipts")
    op.drop_index(op.f("ix_message_delivery_receipts_message_id"), table_name="message_delivery_receipts")
    op.drop_table("message_delivery_receipts")

    op.drop_index(op.f("ix_message_attachments_message_id"), table_name="message_attachments")
    op.drop_table("message_attachments")

    op.drop_index(op.f("ix_messages_client_message_id"), table_name="messages")
    op.drop_column("messages", "status")
    op.drop_column("messages", "client_message_id")

    message_status_enum.drop(op.get_bind(), checkfirst=True)
