"""Backfill conversations.last_message_id / last_message_at

Revision ID: b2e4f7a91c05
Revises: f4a1c9d3b7e6
Create Date: 2026-07-30 00:00:00.000000

conversation_service.send_message now keeps last_message_id/last_message_at
in sync on every new message, but that write only happens going forward.
Any conversation that already had messages *before* that fix shipped still
has both columns sitting at NULL, which is why the Messages list keeps
showing "No messages yet" for real, populated conversations. This backfills
every existing conversation from its actual most recent message.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2e4f7a91c05'
down_revision: Union[str, Sequence[str], None] = 'f4a1c9d3b7e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE conversations c
        SET last_message_id = m.id,
            last_message_at = m.created_at
        FROM (
            SELECT DISTINCT ON (conversation_id) conversation_id, id, created_at
            FROM messages
            ORDER BY conversation_id, created_at DESC
        ) m
        WHERE m.conversation_id = c.id
          AND c.last_message_id IS NULL
        """
    )


def downgrade() -> None:
    # Data backfill only - nothing to structurally reverse. Leaving the
    # backfilled values in place on downgrade is intentional; wiping them
    # would just reintroduce the "No messages yet" bug.
    pass