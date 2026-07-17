"""Add original_post_id to posts for sharing

Revision ID: d15e6b3af420
Revises: c94f2a88d701
Create Date: 2026-07-17 00:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd15e6b3af420'
down_revision: Union[str, Sequence[str], None] = 'c94f2a88d701'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('posts', sa.Column('original_post_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_posts_original_post_id_posts',
        'posts', 'posts',
        ['original_post_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_index(op.f('ix_posts_original_post_id'), 'posts', ['original_post_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_posts_original_post_id'), table_name='posts')
    op.drop_constraint('fk_posts_original_post_id_posts', 'posts', type_='foreignkey')
    op.drop_column('posts', 'original_post_id')