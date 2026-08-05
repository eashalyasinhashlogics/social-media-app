"""Add message_reads table

Revision ID: c7f3a1d9b204
Revises: 9b1f5c7a3e02
Create Date: 2026-07-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7f3a1d9b204'
down_revision: Union[str, Sequence[str], None] = '9b1f5c7a3e02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('message_reads',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('message_id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('read_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['message_id'], ['messages.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('message_id', 'user_id', name='uq_message_reads_message_id_user_id')
    )
    op.create_index(op.f('ix_message_reads_message_id'), 'message_reads', ['message_id'], unique=False)
    op.create_index(op.f('ix_message_reads_user_id'), 'message_reads', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_message_reads_user_id'), table_name='message_reads')
    op.drop_index(op.f('ix_message_reads_message_id'), table_name='message_reads')
    op.drop_table('message_reads')