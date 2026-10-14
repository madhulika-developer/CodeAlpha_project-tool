import json
from typing import Dict, List, Any
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # project_id -> list of WebSockets
        self.project_connections: Dict[int, List[WebSocket]] = {}
        # user_id -> list of WebSockets (user might have multiple tabs)
        self.user_connections: Dict[int, List[WebSocket]] = {}

    async def connect_project(self, project_id: int, websocket: WebSocket):
        await websocket.accept()
        if project_id not in self.project_connections:
            self.project_connections[project_id] = []
        self.project_connections[project_id].append(websocket)

    def disconnect_project(self, project_id: int, websocket: WebSocket):
        if project_id in self.project_connections:
            if websocket in self.project_connections[project_id]:
                self.project_connections[project_id].remove(websocket)
            if not self.project_connections[project_id]:
                del self.project_connections[project_id]

    async def broadcast_to_project(self, project_id: int, event_type: str, data: Any, exclude_ws: WebSocket = None):
        """Broadcasts event to everyone currently watching project_id"""
        if project_id not in self.project_connections:
            return
        
        message = json.dumps({
            "type": event_type,
            "project_id": project_id,
            "data": data
        })

        dead_connections = []
        for connection in self.project_connections[project_id]:
            if connection == exclude_ws:
                continue
            try:
                await connection.send_text(message)
            except Exception:
                dead_connections.append(connection)

        for dead in dead_connections:
            self.disconnect_project(project_id, dead)

    async def connect_user(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.user_connections:
            self.user_connections[user_id] = []
        self.user_connections[user_id].append(websocket)

    def disconnect_user(self, user_id: int, websocket: WebSocket):
        if user_id in self.user_connections:
            if websocket in self.user_connections[user_id]:
                self.user_connections[user_id].remove(websocket)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]

    async def send_to_user(self, user_id: int, event_type: str, data: Any):
        """Send notification or direct message to a specific user"""
        if user_id not in self.user_connections:
            return

        message = json.dumps({
            "type": event_type,
            "data": data
        })

        dead_connections = []
        for connection in self.user_connections[user_id]:
            try:
                await connection.send_text(message)
            except Exception:
                dead_connections.append(connection)

        for dead in dead_connections:
            self.disconnect_user(user_id, dead)

manager = ConnectionManager()
