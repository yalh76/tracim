"""add INTERRUPT to entity types

Revision ID: 7cb0ddd4ed08
Revises: 94893551ad7c
Create Date: 2021-07-19 15:54:30.492433

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "7cb0ddd4ed08"
down_revision = "94893551ad7c"

old_enum_values = (
    "USER",
    "WORKSPACE",
    "WORKSPACE_MEMBER",
    "WORKSPACE_SUBSCRIPTION",
    "CONTENT",
    "MENTION",
    "REACTION",
    "TAG",
    "CONTENT_TAG",
)
old_enum = sa.Enum(*old_enum_values, name="entitytype")
new_enum = sa.Enum(*(old_enum_values + ("INTERRUPT",)), name="entitytype")


def upgrade():
    op.replace_enum("events", "entity_type", old_enum, new_enum, None)


def downgrade():
    op.replace_enum("events", "entity_type", new_enum, old_enum, None)
