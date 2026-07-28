from datetime import datetime, timezone
from pydantic import field_serializer


class UTCTimestampMixin:
    """Every model in this app stores `created_at` / `updated_at` using
    `datetime.utcnow()`, which produces a *naive* datetime (no tzinfo).
    When Pydantic serializes a naive datetime to JSON it just prints the
    wall-clock value with no offset, e.g. "2026-07-20T10:15:30". The
    frontend's `new Date(...)` then parses that string as if it were in
    the *browser's local* timezone instead of UTC, so every "Xh/Xd ago"
    label ends up off by the viewer's UTC offset.

    Mixing this into a response schema re-stamps any naive datetime as
    UTC before it goes out, so the wire format is always an unambiguous
    "...+00:00" string that every JS Date parser reads correctly.
    """

    @field_serializer("created_at", "updated_at", check_fields=False, when_used="json")
    def _serialize_as_utc(self, value: datetime | None) -> str | None:
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()