from typing import Dict, List
from fastapi import WebSocket
import uuid


class ConnectionManager:
    """Keyed by user_id rather than by connection, because one user can have
    several tabs/devices open at once, each holding its own socket. All of
    them should receive a broadcast, not just the first one found."""

    def __init__(self):
        self._connections: Dict[uuid.UUID, List[WebSocket]] = {}

    async def connect(self, user_id: uuid.UUID, websocket: WebSocket) -> None:
        self._connections.setdefault(user_id, []).append(websocket)

    def disconnect(self, user_id: uuid.UUID, websocket: WebSocket) -> None:
        connections = self._connections.get(user_id, [])
        if websocket in connections:
            connections.remove(websocket)
        if not connections and user_id in self._connections:
            del self._connections[user_id]

    async def send_to_user(self, user_id: uuid.UUID, payload: dict) -> None:
        """Best-effort: if a socket has gone stale (client vanished without
        a clean close), drop it instead of letting one dead connection
        break the broadcast to everyone else."""
        dead = []
        for ws in self._connections.get(user_id, []):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(user_id, ws)

    def is_online(self, user_id: uuid.UUID) -> bool:
        return bool(self._connections.get(user_id))


# Single process-wide instance - fine for a single-instance Lightsail
# deployment. If this ever runs behind multiple app instances, broadcasting
# would need to move to something shared like Redis pub/sub instead of
# this in-memory dict.
manager = ConnectionManager()