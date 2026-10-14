import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from backend.auth import decode_access_token
from backend.websocket_manager import manager
from backend.database import SessionLocal
from backend.models import User, ProjectMember, Project

router = APIRouter(tags=["websockets"])

def authenticate_ws_token(token: str):
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == int(user_id)).first()
        return user
    finally:
        db.close()

@router.websocket("/ws/project/{project_id}")
async def websocket_project_endpoint(websocket: WebSocket, project_id: int, token: str = Query(None)):
    user = authenticate_ws_token(token)
    if not user:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    # Verify project access
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            await websocket.close(code=4004, reason="Project not found")
            return
        is_member = db.query(ProjectMember).filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user.id
        ).first() or (project.owner_id == user.id)
        if not is_member:
            await websocket.close(code=4003, reason="Access denied")
            return
    finally:
        db.close()

    await manager.connect_project(project_id, websocket)

    # Broadcast user joined presence
    await manager.broadcast_to_project(project_id, "user_presence", {
        "user": user.to_dict(),
        "status": "online"
    }, exclude_ws=websocket)

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                # Handle client ping or typing/presence indicators
                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
                elif msg.get("type") == "typing":
                    await manager.broadcast_to_project(project_id, "user_typing", {
                        "user": user.to_dict(),
                        "task_id": msg.get("task_id")
                    }, exclude_ws=websocket)
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect_project(project_id, websocket)
        await manager.broadcast_to_project(project_id, "user_presence", {
            "user": user.to_dict(),
            "status": "offline"
        })

@router.websocket("/ws/notifications")
async def websocket_notifications_endpoint(websocket: WebSocket, token: str = Query(None)):
    user = authenticate_ws_token(token)
    if not user:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await manager.connect_user(user.id, websocket)

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect_user(user.id, websocket)
