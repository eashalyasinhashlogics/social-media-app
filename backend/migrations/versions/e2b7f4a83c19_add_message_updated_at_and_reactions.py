"""Add message updated_at and message_reactions table

Revision ID: e2b7f4a83c19
Revises: a3f8c1d92e55
Create Date: 2026-07-29 00:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e2b7f4a83c19'
down_revision: Union[str, Sequence[str], None] = 'a3f8c1d92e55'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('messages', sa.Column('updated_at', sa.DateTime(), nullable=True))
    op.create_table('message_reactions',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('message_id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('emoji', sa.String(length=16), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['message_id'], ['messages.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('message_id', 'user_id', 'emoji', name='uq_message_reactions_message_id_user_id_emoji')
    )
    op.create_index(op.f('ix_message_reactions_message_id'), 'message_reactions', ['message_id'], unique=False)
    op.create_index(op.f('ix_message_reactions_user_id'), 'message_reactions', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_message_reactions_user_id'), table_name='message_reactions')
    op.drop_index(op.f('ix_message_reactions_message_id'), table_name='message_reactions')
    op.drop_table('message_reactions')
    op.drop_column('messages', 'updated_at')