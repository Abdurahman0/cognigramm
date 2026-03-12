import asyncio
from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.user_connections: dict[int, set[WebSocket]] = defaultdict(set)
        self.room_connections: dict[int, set[WebSocket]] = defaultdict(set)
        self.socket_user: dict[WebSocket, int] = {}
        self.socket_rooms: dict[WebSocket, set[int]] = defaultdict(set)
        self.lock = asyncio.Lock()

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self.lock:
            self.user_connections[user_id].add(websocket)
            self.socket_user[websocket] = user_id

    async def disconnect(self, user_id: int, websocket: WebSocket) -> list[int]:
        removed_rooms: list[int] = []
        async with self.lock:
            for room_id in list(self.socket_rooms.get(websocket, set())):
                self.room_connections[room_id].discard(websocket)
                if not self.room_connections[room_id]:
                    del self.room_connections[room_id]
                    removed_rooms.append(room_id)

            self.socket_rooms.pop(websocket, None)
            self.socket_user.pop(websocket, None)
            self.user_connections[user_id].discard(websocket)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
        return removed_rooms

    async def join_room(self, websocket: WebSocket, room_id: int) -> bool:
        async with self.lock:
            had_local = room_id in self.room_connections and len(self.room_connections[room_id]) > 0
            self.room_connections[room_id].add(websocket)
            self.socket_rooms[websocket].add(room_id)
            return not had_local

    async def leave_room(self, websocket: WebSocket, room_id: int) -> bool:
        async with self.lock:
            became_empty = False
            self.room_connections[room_id].discard(websocket)
            if not self.room_connections[room_id]:
                del self.room_connections[room_id]
                became_empty = True
            rooms = self.socket_rooms.get(websocket)
            if rooms is not None:
                rooms.discard(room_id)
                if not rooms:
                    self.socket_rooms.pop(websocket, None)
            return became_empty

    async def local_room_size(self, room_id: int) -> int:
        async with self.lock:
            return len(self.room_connections.get(room_id, set()))

    async def broadcast_room(self, room_id: int, message: dict[str, Any]) -> None:
        async with self.lock:
            sockets = list(self.room_connections.get(room_id, set()))
        await self._broadcast(sockets, message)

    async def broadcast_all(self, message: dict[str, Any]) -> None:
        async with self.lock:
            sockets: list[WebSocket] = []
            for user_sockets in self.user_connections.values():
                sockets.extend(list(user_sockets))
        await self._broadcast(sockets, message)

    async def send_to_user(self, user_id: int, message: dict[str, Any]) -> None:
        async with self.lock:
            sockets = list(self.user_connections.get(user_id, set()))
        await self._broadcast(sockets, message)

    async def connection_count(self, user_id: int) -> int:
        async with self.lock:
            return len(self.user_connections.get(user_id, set()))

    async def _broadcast(self, sockets: list[WebSocket], message: dict[str, Any]) -> None:
        if not sockets:
            return
        semaphore = asyncio.Semaphore(500)
        disconnected: list[tuple[int, WebSocket]] = []

        async def send_one(socket: WebSocket) -> None:
            async with semaphore:
                try:
                    await socket.send_json(message)
                except Exception:
                    user_id = self.socket_user.get(socket)
                    if user_id is not None:
                        disconnected.append((user_id, socket))

        await asyncio.gather(*(send_one(socket) for socket in sockets), return_exceptions=True)
        for user_id, socket in disconnected:
            await self.disconnect(user_id, socket)
