"""Add friend_requests and friendships tables

Revision ID: a4d2e8f91c33
Revises: f1a9c3d7e820
Create Date: 2026-07-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a4d2e8f91c33'
down_revision: Union[str, Sequence[str], None] = 'f1a9c3d7e820'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


friend_request_status_enum = postgresql.ENUM(
    'pending', 'accepted', 'rejected', name='friend_request_status', create_type=False
)


def upgrade() -> None:
    bind = op.get_bind()
    friend_request_status_enum.create(bind, checkfirst=True)

    op.create_table('friend_requests',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('from_user_id', sa.UUID(), nullable=False),
    sa.Column('to_user_id', sa.UUID(), nullable=False),
    sa.Column('status', friend_request_status_enum, nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.CheckConstraint('from_user_id != to_user_id', name='ck_friend_requests_no_self_request'),
    sa.ForeignKeyConstraint(['from_user_id'], ['users.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['to_user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('from_user_id', 'to_user_id', name='uq_friend_requests_from_user_id_to_user_id')
    )
    op.create_index(op.f('ix_friend_requests_from_user_id'), 'friend_requests', ['from_user_id'], unique=False)
    op.create_index(op.f('ix_friend_requests_to_user_id'), 'friend_requests', ['to_user_id'], unique=False)

    op.create_table('friendships',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user1_id', sa.UUID(), nullable=False),
    sa.Column('user2_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.CheckConstraint('user1_id < user2_id', name='ck_friendships_ordered_pair'),
    sa.ForeignKeyConstraint(['user1_id'], ['users.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user2_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user1_id', 'user2_id', name='uq_friendships_user1_id_user2_id')
    )
    op.create_index(op.f('ix_friendships_user1_id'), 'friendships', ['user1_id'], unique=False)
    op.create_index(op.f('ix_friendships_user2_id'), 'friendships', ['user2_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_friendships_user2_id'), table_name='friendships')
    op.drop_index(op.f('ix_friendships_user1_id'), table_name='friendships')
    op.drop_table('friendships')

    op.drop_index(op.f('ix_friend_requests_to_user_id'), table_name='friend_requests')
    op.drop_index(op.f('ix_friend_requests_from_user_id'), table_name='friend_requests')
    op.drop_table('friend_requests')

    bind = op.get_bind()
    friend_request_status_enum.drop(bind, checkfirst=True)