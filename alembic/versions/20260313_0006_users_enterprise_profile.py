from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PGEnum


revision = "20260313_0006"
down_revision = "20260313_0005"
branch_labels = None
depends_on = None


user_status_enum = PGEnum(
    "available",
    "in_meeting",
    "busy",
    "on_break",
    "offline",
    "remote",
    name="user_status",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    user_status_enum.create(bind, checkfirst=True)

    op.add_column("users", sa.Column("full_name", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("avatar_url", sa.String(length=2048), nullable=True))
    op.add_column("users", sa.Column("role_id", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("department_id", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("title", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("about", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("timezone", sa.String(length=64), nullable=False, server_default="UTC"))
    op.add_column("users", sa.Column("phone", sa.String(length=32), nullable=True))
    op.add_column("users", sa.Column("handle", sa.String(length=64), nullable=True))
    op.add_column("users", sa.Column("office_location", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("manager_id", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("status", user_status_enum, nullable=False, server_default="available"))

    op.create_foreign_key(
        op.f("fk_users_role_id_roles"),
        "users",
        "roles",
        ["role_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        op.f("fk_users_department_id_departments"),
        "users",
        "departments",
        ["department_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        op.f("fk_users_manager_id_users"),
        "users",
        "users",
        ["manager_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_index(op.f("ix_users_role_id"), "users", ["role_id"], unique=False)
    op.create_index(op.f("ix_users_department_id"), "users", ["department_id"], unique=False)
    op.create_index(op.f("ix_users_manager_id"), "users", ["manager_id"], unique=False)
    op.create_index(op.f("ix_users_handle"), "users", ["handle"], unique=True)

    op.execute("UPDATE users SET full_name = username WHERE full_name IS NULL")


def downgrade() -> None:
    op.drop_index(op.f("ix_users_handle"), table_name="users")
    op.drop_index(op.f("ix_users_manager_id"), table_name="users")
    op.drop_index(op.f("ix_users_department_id"), table_name="users")
    op.drop_index(op.f("ix_users_role_id"), table_name="users")

    op.drop_constraint(op.f("fk_users_manager_id_users"), "users", type_="foreignkey")
    op.drop_constraint(op.f("fk_users_department_id_departments"), "users", type_="foreignkey")
    op.drop_constraint(op.f("fk_users_role_id_roles"), "users", type_="foreignkey")

    op.drop_column("users", "status")
    op.drop_column("users", "last_seen_at")
    op.drop_column("users", "manager_id")
    op.drop_column("users", "office_location")
    op.drop_column("users", "handle")
    op.drop_column("users", "phone")
    op.drop_column("users", "timezone")
    op.drop_column("users", "about")
    op.drop_column("users", "title")
    op.drop_column("users", "department_id")
    op.drop_column("users", "role_id")
    op.drop_column("users", "avatar_url")
    op.drop_column("users", "full_name")

    user_status_enum.drop(op.get_bind(), checkfirst=True)
