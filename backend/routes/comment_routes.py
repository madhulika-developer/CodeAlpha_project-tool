from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Comment, Task, Notification, Activity, User
from backend.schemas import CommentCreate
from backend.auth import get_current_user
from backend.websocket_manager import manager
from backend.routes.project_routes import verify_project_access

router = APIRouter(tags=["comments"])

@router.get("/api/tasks/{task_id}/comments")
def get_task_comments(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    verify_project_access(task.project_id, current_user.id, db)

    comments = db.query(Comment).filter(Comment.task_id == task_id).order_by(Comment.created_at.asc()).all()
    return [c.to_dict() for c in comments]

@router.post("/api/tasks/{task_id}/comments")
async def add_task_comment(task_id: int, req: CommentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    verify_project_access(task.project_id, current_user.id, db)

    comment = Comment(
        task_id=task_id,
        user_id=current_user.id,
        content=req.content
    )
    db.add(comment)

    # Activity
    activity = Activity(
        project_id=task.project_id,
        task_id=task.id,
        user_id=current_user.id,
        action_type="comment_added",
        description=f"commented on '{task.title}'"
    )
    db.add(activity)

    # Notify assignees and task creator if not current user
    notified_user_ids = set()
    for assignee in task.assignees:
        if assignee.id != current_user.id:
            notified_user_ids.add(assignee.id)
    if task.created_by_id and task.created_by_id != current_user.id:
        notified_user_ids.add(task.created_by_id)

    for uid in notified_user_ids:
        notif = Notification(
            user_id=uid,
            actor_id=current_user.id,
            project_id=task.project_id,
            task_id=task.id,
            message=f"{current_user.full_name} commented on '{task.title}'"
        )
        db.add(notif)
        db.flush()
        await manager.send_to_user(uid, "new_notification", notif.to_dict())

    db.commit()
    db.refresh(comment)

    data = comment.to_dict()
    # Broadcast to all users on this project
    await manager.broadcast_to_project(task.project_id, "comment_added", {
        "task_id": task_id,
        "comment": data
    })
    return data

@router.delete("/api/comments/{comment_id}")
async def delete_comment(comment_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    task = comment.task
    verify_project_access(task.project_id, current_user.id, db)

    if comment.user_id != current_user.id and task.project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")

    task_id = comment.task_id
    project_id = task.project_id
    db.delete(comment)
    db.commit()

    await manager.broadcast_to_project(project_id, "comment_deleted", {
        "task_id": task_id,
        "comment_id": comment_id
    })
    return {"message": "Comment deleted"}
