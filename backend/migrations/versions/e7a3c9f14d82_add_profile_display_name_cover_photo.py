"""Add display_name and cover_photo_id to user_profiles; add 'cover' media_type

Revision ID: e7a3c9f14d82
Revises: d15e6b3af420
Create Date: 2026-07-20 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7a3c9f14d82'
down_revision: Union[str, Sequence[str], None] = 'd15e6b3af420'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # New Postgres enum values must not be used in the same transaction
    # they're added in - that's fine here since we're only adding the
    # value, not writing rows with it yet.
    op.execute("ALTER TYPE media_type ADD VALUE IF NOT EXISTS 'cover'")

    op.add_column('user_profiles', sa.Column('display_name', sa.String(length=150), nullable=True))
    op.add_column('user_profiles', sa.Column('cover_photo_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_user_profiles_cover_photo_id_media',
        'user_profiles', 'media',
        ['cover_photo_id'], ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    op.drop_constraint('fk_user_profiles_cover_photo_id_media', 'user_profiles', type_='foreignkey')
    op.drop_column('user_profiles', 'cover_photo_id')
    op.drop_column('user_profiles', 'display_name')
    # Note: Postgres does not support removing a value from an enum type,
    # so 'cover' is intentionally left in place on downgrade.