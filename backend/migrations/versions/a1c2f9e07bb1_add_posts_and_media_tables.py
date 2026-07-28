"""Add posts and media tables

Revision ID: a1c2f9e07bb1
Revises: 25a9f2d720af
Create Date: 2026-07-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a1c2f9e07bb1'
down_revision: Union[str, Sequence[str], None] = '25a9f2d720af'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


post_status_enum = postgresql.ENUM('active', 'archived', 'deleted', name='post_status', create_type=False)
media_type_enum = postgresql.ENUM('image', 'video', 'avatar', name='media_type', create_type=False)


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    post_status_enum.create(bind, checkfirst=True)
    media_type_enum.create(bind, checkfirst=True)

    op.create_table('posts',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('author_id', sa.UUID(), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('status', post_status_enum, nullable=False),
    sa.Column('like_count', sa.Integer(), nullable=False),
    sa.Column('comment_count', sa.Integer(), nullable=False),
    sa.Column('share_count', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.Column('deleted_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['author_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_posts_author_id'), 'posts', ['author_id'], unique=False)

    op.create_table('media',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('uploader_id', sa.UUID(), nullable=False),
    sa.Column('post_id', sa.UUID(), nullable=True),
    sa.Column('url', sa.String(length=1000), nullable=False),
    sa.Column('public_id', sa.String(length=255), nullable=True),
    sa.Column('media_type', media_type_enum, nullable=False),
    sa.Column('file_size', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['uploader_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_media_uploader_id'), 'media', ['uploader_id'], unique=False)
    op.create_index(op.f('ix_media_post_id'), 'media', ['post_id'], unique=False)

    op.create_foreign_key(
        'fk_user_profiles_profile_picture_id_media',
        'user_profiles', 'media',
        ['profile_picture_id'], ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_user_profiles_profile_picture_id_media', 'user_profiles', type_='foreignkey')

    op.drop_index(op.f('ix_media_post_id'), table_name='media')
    op.drop_index(op.f('ix_media_uploader_id'), table_name='media')
    op.drop_table('media')

    op.drop_index(op.f('ix_posts_author_id'), table_name='posts')
    op.drop_table('posts')

    bind = op.get_bind()
    media_type_enum.drop(bind, checkfirst=True)
    post_status_enum.drop(bind, checkfirst=True)