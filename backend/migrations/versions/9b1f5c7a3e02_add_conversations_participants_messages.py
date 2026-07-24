"""Add conversations, conversation_participants, and messages tables

Revision ID: 9b1f5c7a3e02
Revises: a4d2e8f91c33
Create Date: 2026-07-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '9b1f5c7a3e02'
down_revision: Union[str, Sequence[str], None] = 'a4d2e8f91c33'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


conversation_type_enum = postgresql.ENUM('direct', 'group', name='conversation_type', create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    conversation_type_enum.create(bind, checkfirst=True)

    op.create_table('conversations',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('type', conversation_type_enum, nullable=False),
    sa.Column('last_message_id', sa.UUID(), nullable=True),
    sa.Column('last_message_at', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )

    op.create_table('conversation_participants',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('conversation_id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('joined_at', sa.DateTime(), nullable=False),
    sa.Column('left_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('conversation_id', 'user_id', name='uq_conversation_participants_conversation_id_user_id')
    )
    op.create_index(op.f('ix_conversation_participants_conversation_id'), 'conversation_participants', ['conversation_id'], unique=False)
    op.create_index(op.f('ix_conversation_participants_user_id'), 'conversation_participants', ['user_id'], unique=False)

    op.create_table('messages',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('conversation_id', sa.UUID(), nullable=False),
    sa.Column('sender_id', sa.UUID(), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_messages_conversation_id'), 'messages', ['conversation_id'], unique=False)
    op.create_index(op.f('ix_messages_sender_id'), 'messages', ['sender_id'], unique=False)

    # conversations.last_message_id -> messages.id is added *after* the
    # messages table exists, avoiding the chicken-and-egg FK ordering
    # problem - same trick already used for user_profiles.profile_picture_id
    # -> media in the posts/media migration.
    op.create_foreign_key(
        'fk_conversations_last_message_id_messages',
        'conversations', 'messages',
        ['last_message_id'], ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    op.drop_constraint('fk_conversations_last_message_id_messages', 'conversations', type_='foreignkey')

    op.drop_index(op.f('ix_messages_sender_id'), table_name='messages')
    op.drop_index(op.f('ix_messages_conversation_id'), table_name='messages')
    op.drop_table('messages')

    op.drop_index(op.f('ix_conversation_participants_user_id'), table_name='conversation_participants')
    op.drop_index(op.f('ix_conversation_participants_conversation_id'), table_name='conversation_participants')
    op.drop_table('conversation_participants')

    op.drop_table('conversations')

    bind = op.get_bind()
    conversation_type_enum.drop(bind, checkfirst=True)