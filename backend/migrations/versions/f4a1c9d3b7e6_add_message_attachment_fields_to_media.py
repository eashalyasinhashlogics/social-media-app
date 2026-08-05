"""Add message_id and file_name to media table for chat attachments

Revision ID: f4a1c9d3b7e6
Revises: e2b7f4a83c19
Create Date: 2026-07-29 00:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f4a1c9d3b7e6'
down_revision: Union[str, Sequence[str], None] = 'e2b7f4a83c19'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('media', sa.Column('message_id', sa.UUID(), nullable=True))
    op.add_column('media', sa.Column('file_name', sa.String(length=255), nullable=True))
    op.create_foreign_key(
        'fk_media_message_id_messages', 'media', 'messages', ['message_id'], ['id'], ondelete='CASCADE'
    )
    op.create_index(op.f('ix_media_message_id'), 'media', ['message_id'], unique=False)

    # Widen the media_type enum to add "document" for chat file attachments
    # (PDF, DOCX, TXT, etc.) alongside the existing image/video/avatar/cover.
    op.execute("ALTER TYPE media_type ADD VALUE IF NOT EXISTS 'document'")


def downgrade() -> None:
    op.drop_index(op.f('ix_media_message_id'), table_name='media')
    op.drop_constraint('fk_media_message_id_messages', 'media', type_='foreignkey')
    op.drop_column('media', 'file_name')
    op.drop_column('media', 'message_id')
    # Note: PostgreSQL does not support removing a value from an enum type,
    # so "document" is intentionally left in place on downgrade.