from alembic import op
import sqlalchemy as sa


revision = "20260313_0005"
down_revision = "20260312_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "roles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("permissions_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_roles")),
    )
    op.create_index(op.f("ix_roles_code"), "roles", ["code"], unique=True)
    op.create_index(op.f("ix_roles_name"), "roles", ["name"], unique=True)

    op.create_table(
        "departments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_departments")),
    )
    op.create_index(op.f("ix_departments_name"), "departments", ["name"], unique=True)

    roles_table = sa.table(
        "roles",
        sa.column("code", sa.String(length=50)),
        sa.column("name", sa.String(length=100)),
        sa.column("permissions_json", sa.JSON()),
    )
    departments_table = sa.table(
        "departments",
        sa.column("name", sa.String(length=100)),
    )

    op.bulk_insert(
        roles_table,
        [
            {"code": "ceo", "name": "CEO", "permissions_json": {"scope": "all"}},
            {"code": "cto", "name": "CTO", "permissions_json": {"scope": "engineering_admin"}},
            {"code": "manager", "name": "Manager", "permissions_json": {"scope": "team_admin"}},
            {"code": "hr", "name": "HR", "permissions_json": {"scope": "people_admin"}},
            {"code": "developer", "name": "Developer", "permissions_json": {"scope": "member"}},
            {"code": "designer", "name": "Designer", "permissions_json": {"scope": "member"}},
            {"code": "product", "name": "Product", "permissions_json": {"scope": "member"}},
            {"code": "qa", "name": "QA", "permissions_json": {"scope": "member"}},
            {"code": "intern", "name": "Intern", "permissions_json": {"scope": "restricted_member"}},
        ],
    )
    op.bulk_insert(
        departments_table,
        [
            {"name": "Executive"},
            {"name": "Engineering"},
            {"name": "Product"},
            {"name": "Design"},
            {"name": "HR"},
            {"name": "Operations"},
            {"name": "Sales"},
        ],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_departments_name"), table_name="departments")
    op.drop_table("departments")

    op.drop_index(op.f("ix_roles_name"), table_name="roles")
    op.drop_index(op.f("ix_roles_code"), table_name="roles")
    op.drop_table("roles")
