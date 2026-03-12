from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PGEnum


revision = "20260312_0003"
down_revision = "20260312_0002"
branch_labels = None
depends_on = None


delivery_state_enum = PGEnum("queued", "persisted", "delivered", "read", "failed", name="delivery_state", create_type=False)
analytics_event_type_enum = PGEnum(
    "message_sent",
    "message_delivered",
    "message_read",
    "user_online",
    "conversation_created",
    name="analytics_event_type",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    delivery_state_enum.create(bind, checkfirst=True)
    analytics_event_type_enum.create(bind, checkfirst=True)

    op.add_column(
        "messages",
        sa.Column("delivery_state", delivery_state_enum, nullable=False, server_default="persisted"),
    )
    op.add_column("messages", sa.Column("queued_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("messages", sa.Column("persisted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("messages", sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("messages", sa.Column("read_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("messages", sa.Column("delivery_updated_at", sa.DateTime(timezone=True), nullable=True))
    op.execute(
        "UPDATE messages SET "
        "delivery_state='persisted', "
        "queued_at=created_at, "
        "persisted_at=created_at, "
        "delivery_updated_at=COALESCE(delivered_at, read_at, created_at)"
    )

    op.add_column(
        "message_delivery_receipts",
        sa.Column("state", delivery_state_enum, nullable=False, server_default="delivered"),
    )
    op.add_column("message_delivery_receipts", sa.Column("queued_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("message_delivery_receipts", sa.Column("persisted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("message_delivery_receipts", sa.Column("read_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "message_delivery_receipts",
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.add_column("message_delivery_receipts", sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"))
    op.execute(
        "UPDATE message_delivery_receipts SET "
        "state='delivered', "
        "queued_at=delivered_at, "
        "persisted_at=delivered_at, "
        "updated_at=delivered_at"
    )

    op.create_table(
        "message_dedup_keys",
        sa.Column("client_message_id", sa.String(length=64), nullable=False),
        sa.Column("conversation_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("message_id", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["conversations.id"],
            name=op.f("fk_message_dedup_keys_conversation_id_conversations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_message_dedup_keys_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["message_id"],
            ["messages.id"],
            name=op.f("fk_message_dedup_keys_message_id_messages"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("client_message_id", name=op.f("pk_message_dedup_keys")),
    )
    op.create_index(op.f("ix_message_dedup_keys_conversation_id"), "message_dedup_keys", ["conversation_id"], unique=False)
    op.create_index(op.f("ix_message_dedup_keys_user_id"), "message_dedup_keys", ["user_id"], unique=False)
    op.create_index(op.f("ix_message_dedup_keys_message_id"), "message_dedup_keys", ["message_id"], unique=False)
    op.execute(
        "INSERT INTO message_dedup_keys (client_message_id, conversation_id, user_id, message_id, created_at) "
        "SELECT client_message_id, conversation_id, sender_id, id, created_at FROM messages WHERE sender_id IS NOT NULL "
        "ON CONFLICT (client_message_id) DO NOTHING"
    )

    op.execute("DROP INDEX IF EXISTS ix_messages_client_message_id")
    op.execute("DROP INDEX IF EXISTS ix_messages_content_tsv")

    op.execute("ALTER TABLE message_attachments DROP CONSTRAINT fk_message_attachments_message_id_messages")
    op.execute("ALTER TABLE message_read_receipts DROP CONSTRAINT fk_message_read_receipts_message_id_messages")
    op.execute("ALTER TABLE message_delivery_receipts DROP CONSTRAINT fk_message_delivery_receipts_message_id_messages")
    op.execute("ALTER TABLE message_dedup_keys DROP CONSTRAINT fk_message_dedup_keys_message_id_messages")

    op.execute("ALTER TABLE message_attachments ALTER COLUMN message_id TYPE BIGINT")
    op.execute("ALTER TABLE message_read_receipts ALTER COLUMN message_id TYPE BIGINT")
    op.execute("ALTER TABLE message_delivery_receipts ALTER COLUMN message_id TYPE BIGINT")
    op.execute("ALTER TABLE message_dedup_keys ALTER COLUMN message_id TYPE BIGINT")

    op.execute("ALTER TABLE messages RENAME TO messages_legacy")
    op.execute(
        "CREATE TABLE messages ("
        "id BIGINT GENERATED BY DEFAULT AS IDENTITY NOT NULL,"
        "conversation_id INTEGER NOT NULL,"
        "sender_id INTEGER,"
        "content TEXT,"
        "client_message_id VARCHAR(64) NOT NULL,"
        "message_type message_type NOT NULL,"
        "status message_status NOT NULL,"
        "delivery_state delivery_state NOT NULL,"
        "queued_at TIMESTAMPTZ,"
        "persisted_at TIMESTAMPTZ,"
        "delivered_at TIMESTAMPTZ,"
        "read_at TIMESTAMPTZ,"
        "delivery_updated_at TIMESTAMPTZ,"
        "created_at TIMESTAMPTZ NOT NULL DEFAULT now(),"
        "edited_at TIMESTAMPTZ,"
        "deleted_at TIMESTAMPTZ,"
        "PRIMARY KEY (id),"
        "FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,"
        "FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE SET NULL"
        ")"
    )
    op.execute(
        "CREATE OR REPLACE FUNCTION ensure_messages_partitions(months_ahead INTEGER DEFAULT 12) RETURNS VOID AS $$ "
        "BEGIN "
        "RETURN; "
        "END; "
        "$$ LANGUAGE plpgsql"
    )
    op.execute("SELECT ensure_messages_partitions(24)")
    op.execute(
        "INSERT INTO messages ("
        "id, conversation_id, sender_id, content, client_message_id, message_type, status, "
        "delivery_state, queued_at, persisted_at, delivered_at, read_at, delivery_updated_at, "
        "created_at, edited_at, deleted_at"
        ") "
        "SELECT "
        "id, conversation_id, sender_id, content, client_message_id, message_type, status, "
        "delivery_state, queued_at, persisted_at, delivered_at, read_at, delivery_updated_at, "
        "created_at, edited_at, deleted_at "
        "FROM messages_legacy ORDER BY id"
    )
    op.execute(
        "SELECT setval(pg_get_serial_sequence('messages', 'id'), COALESCE((SELECT MAX(id) FROM messages), 1), true)"
    )

    op.execute(
        "ALTER TABLE message_attachments ADD CONSTRAINT fk_message_attachments_message_id_messages "
        "FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE"
    )
    op.execute(
        "ALTER TABLE message_read_receipts ADD CONSTRAINT fk_message_read_receipts_message_id_messages "
        "FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE"
    )
    op.execute(
        "ALTER TABLE message_delivery_receipts ADD CONSTRAINT fk_message_delivery_receipts_message_id_messages "
        "FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE"
    )
    op.execute(
        "ALTER TABLE message_dedup_keys ADD CONSTRAINT fk_message_dedup_keys_message_id_messages "
        "FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE SET NULL"
    )
    op.execute("DROP TABLE messages_legacy")

    op.create_index(op.f("ix_messages_conversation_id"), "messages", ["conversation_id"], unique=False)
    op.create_index(op.f("ix_messages_sender_id"), "messages", ["sender_id"], unique=False)
    op.create_index(op.f("ix_messages_client_message_id"), "messages", ["client_message_id"], unique=False)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_messages_content_tsv "
        "ON messages USING GIN (to_tsvector('simple', COALESCE(content, '')))"
    )

    op.create_table(
        "analytics_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.String(length=64), nullable=False),
        sa.Column("event_type", analytics_event_type_enum, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("conversation_id", sa.Integer(), nullable=True),
        sa.Column("message_id", sa.BigInteger(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_analytics_events")),
    )
    op.create_index(op.f("ix_analytics_events_event_id"), "analytics_events", ["event_id"], unique=True)
    op.create_index(op.f("ix_analytics_events_event_type"), "analytics_events", ["event_type"], unique=False)
    op.create_index(op.f("ix_analytics_events_user_id"), "analytics_events", ["user_id"], unique=False)
    op.create_index(op.f("ix_analytics_events_conversation_id"), "analytics_events", ["conversation_id"], unique=False)
    op.create_index(op.f("ix_analytics_events_message_id"), "analytics_events", ["message_id"], unique=False)
    op.create_index(op.f("ix_analytics_events_occurred_at"), "analytics_events", ["occurred_at"], unique=False)

    op.create_table(
        "analytics_daily_metrics",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("metric_date", sa.Date(), nullable=False),
        sa.Column("metric_name", sa.String(length=128), nullable=False),
        sa.Column("dimension_key", sa.String(length=255), nullable=False),
        sa.Column("metric_value", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_analytics_daily_metrics")),
        sa.UniqueConstraint("metric_date", "metric_name", "dimension_key", name="uq_analytics_daily_metrics_dim"),
    )
    op.create_index(op.f("ix_analytics_daily_metrics_metric_date"), "analytics_daily_metrics", ["metric_date"], unique=False)
    op.create_index(op.f("ix_analytics_daily_metrics_metric_name"), "analytics_daily_metrics", ["metric_name"], unique=False)

    op.create_table(
        "analytics_daily_user_activity",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("metric_date", sa.Date(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_analytics_daily_user_activity")),
        sa.UniqueConstraint("metric_date", "user_id", name="uq_analytics_daily_user_activity_user"),
    )
    op.create_index(
        op.f("ix_analytics_daily_user_activity_metric_date"),
        "analytics_daily_user_activity",
        ["metric_date"],
        unique=False,
    )
    op.create_index(
        op.f("ix_analytics_daily_user_activity_user_id"),
        "analytics_daily_user_activity",
        ["user_id"],
        unique=False,
    )

    op.create_table(
        "analytics_daily_conversation_activity",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("metric_date", sa.Date(), nullable=False),
        sa.Column("conversation_id", sa.Integer(), nullable=False),
        sa.Column("first_activity_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_analytics_daily_conversation_activity")),
        sa.UniqueConstraint(
            "metric_date",
            "conversation_id",
            name="uq_analytics_daily_conversation_activity_conv",
        ),
    )
    op.create_index(
        op.f("ix_analytics_daily_conversation_activity_metric_date"),
        "analytics_daily_conversation_activity",
        ["metric_date"],
        unique=False,
    )
    op.create_index(
        op.f("ix_analytics_daily_conversation_activity_conversation_id"),
        "analytics_daily_conversation_activity",
        ["conversation_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_analytics_daily_conversation_activity_conversation_id"), table_name="analytics_daily_conversation_activity")
    op.drop_index(op.f("ix_analytics_daily_conversation_activity_metric_date"), table_name="analytics_daily_conversation_activity")
    op.drop_table("analytics_daily_conversation_activity")

    op.drop_index(op.f("ix_analytics_daily_user_activity_user_id"), table_name="analytics_daily_user_activity")
    op.drop_index(op.f("ix_analytics_daily_user_activity_metric_date"), table_name="analytics_daily_user_activity")
    op.drop_table("analytics_daily_user_activity")

    op.drop_index(op.f("ix_analytics_daily_metrics_metric_name"), table_name="analytics_daily_metrics")
    op.drop_index(op.f("ix_analytics_daily_metrics_metric_date"), table_name="analytics_daily_metrics")
    op.drop_table("analytics_daily_metrics")

    op.drop_index(op.f("ix_analytics_events_occurred_at"), table_name="analytics_events")
    op.drop_index(op.f("ix_analytics_events_message_id"), table_name="analytics_events")
    op.drop_index(op.f("ix_analytics_events_conversation_id"), table_name="analytics_events")
    op.drop_index(op.f("ix_analytics_events_user_id"), table_name="analytics_events")
    op.drop_index(op.f("ix_analytics_events_event_type"), table_name="analytics_events")
    op.drop_index(op.f("ix_analytics_events_event_id"), table_name="analytics_events")
    op.drop_table("analytics_events")

    op.execute("ALTER TABLE message_attachments DROP CONSTRAINT fk_message_attachments_message_id_messages")
    op.execute("ALTER TABLE message_read_receipts DROP CONSTRAINT fk_message_read_receipts_message_id_messages")
    op.execute("ALTER TABLE message_delivery_receipts DROP CONSTRAINT fk_message_delivery_receipts_message_id_messages")
    op.execute("ALTER TABLE message_dedup_keys DROP CONSTRAINT fk_message_dedup_keys_message_id_messages")

    op.execute("ALTER TABLE messages RENAME TO messages_partitioned")
    op.execute(
        "CREATE TABLE messages AS TABLE messages_partitioned WITH NO DATA"
    )
    op.execute(
        "ALTER TABLE messages "
        "ALTER COLUMN id TYPE BIGINT, "
        "ALTER COLUMN conversation_id TYPE INTEGER, "
        "ALTER COLUMN sender_id TYPE INTEGER"
    )
    op.execute(
        "INSERT INTO messages SELECT * FROM messages_partitioned"
    )
    op.execute("DROP TABLE messages_partitioned CASCADE")

    op.execute("ALTER TABLE message_attachments ALTER COLUMN message_id TYPE INTEGER")
    op.execute("ALTER TABLE message_read_receipts ALTER COLUMN message_id TYPE INTEGER")
    op.execute("ALTER TABLE message_delivery_receipts ALTER COLUMN message_id TYPE INTEGER")
    op.execute("ALTER TABLE message_dedup_keys ALTER COLUMN message_id TYPE INTEGER")

    op.execute(
        "ALTER TABLE message_attachments ADD CONSTRAINT fk_message_attachments_message_id_messages "
        "FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE"
    )
    op.execute(
        "ALTER TABLE message_read_receipts ADD CONSTRAINT fk_message_read_receipts_message_id_messages "
        "FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE"
    )
    op.execute(
        "ALTER TABLE message_delivery_receipts ADD CONSTRAINT fk_message_delivery_receipts_message_id_messages "
        "FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE"
    )
    op.execute(
        "ALTER TABLE message_dedup_keys ADD CONSTRAINT fk_message_dedup_keys_message_id_messages "
        "FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE SET NULL"
    )

    op.drop_index(op.f("ix_message_dedup_keys_message_id"), table_name="message_dedup_keys")
    op.drop_index(op.f("ix_message_dedup_keys_user_id"), table_name="message_dedup_keys")
    op.drop_index(op.f("ix_message_dedup_keys_conversation_id"), table_name="message_dedup_keys")
    op.drop_table("message_dedup_keys")

    op.drop_column("message_delivery_receipts", "retry_count")
    op.drop_column("message_delivery_receipts", "updated_at")
    op.drop_column("message_delivery_receipts", "read_at")
    op.drop_column("message_delivery_receipts", "persisted_at")
    op.drop_column("message_delivery_receipts", "queued_at")
    op.drop_column("message_delivery_receipts", "state")

    op.drop_column("messages", "delivery_updated_at")
    op.drop_column("messages", "read_at")
    op.drop_column("messages", "delivered_at")
    op.drop_column("messages", "persisted_at")
    op.drop_column("messages", "queued_at")
    op.drop_column("messages", "delivery_state")

    op.execute("DROP FUNCTION IF EXISTS ensure_messages_partitions(INTEGER)")
    op.execute("DROP FUNCTION IF EXISTS create_messages_partition(DATE)")
    analytics_event_type_enum.drop(op.get_bind(), checkfirst=True)
    delivery_state_enum.drop(op.get_bind(), checkfirst=True)
