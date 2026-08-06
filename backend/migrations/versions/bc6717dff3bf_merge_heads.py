"""merge heads

Revision ID: bc6717dff3bf
Revises: a1b2c3d4e5f6, b2e4f7a91c05
Create Date: 2026-08-05 18:50:47.464482

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bc6717dff3bf'
down_revision: Union[str, Sequence[str], None] = ('a1b2c3d4e5f6', 'b2e4f7a91c05')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
