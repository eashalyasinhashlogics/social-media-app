"""Add notifications table

Revision ID: a3f8c1d92e55
Revises: c7f3a1d9b204
Create Date: 2026-07-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'a3f8c1d92e55'
down_revision: Union[str, Sequence[str], None] = 'c7f3a1d9b204'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Define the PostgreSQL ENUM with create_type=False
notification_type_enum = postgresql.ENUM(
    'like', 'comment', 'reply', 'friend_request', 'friend_accept', 'follow',
    name='notification_type',
    create_type=False  # <-- Prevents SQLAlchemy from auto-creating it during op.create_table
)


def upgrade() -> None:
    # 1. Explicitly create the type only if it does not exist
    notification_type_enum.create(op.get_bind(), checkfirst=True)

    # 2. Create table using the ENUM
    op.create_table(
        'notifications',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('recipient_id', sa.UUID(), nullable=False),
        sa.Column('actor_id', sa.UUID(), nullable=True),
        sa.Column('type', notification_type_enum, nullable=False),
        sa.Column('post_id', sa.UUID(), nullable=True),
        sa.Column('comment_id', sa.UUID(), nullable=True),
        sa.Column('friend_request_id', sa.UUID(), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['recipient_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['comment_id'], ['comments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['friend_request_id'], ['friend_requests.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_notifications_recipient_id'), 'notifications', ['recipient_id'], unique=False)
    op.create_index(op.f('ix_notifications_actor_id'), 'notifications', ['actor_id'], unique=False)
    op.create_index(op.f('ix_notifications_post_id'), 'notifications', ['post_id'], unique=False)
    op.create_index(op.f('ix_notifications_comment_id'), 'notifications', ['comment_id'], unique=False)
    op.create_index(op.f('ix_notifications_friend_request_id'), 'notifications', ['friend_request_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_notifications_friend_request_id'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_comment_id'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_post_id'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_actor_id'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_recipient_id'), table_name='notifications')
    op.drop_table('notifications')
    notification_type_enum.drop(op.get_bind(), checkfirst=True)