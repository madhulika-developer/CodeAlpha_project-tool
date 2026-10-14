from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from backend.database import get_db
from backend.models import Task, BoardColumn, User, TaskLabel, TaskChecklist, Activity, Notification
from backend.schemas import TaskCreate, TaskUpdate, TaskMove, ChecklistItemCreate, ChecklistItemUpdate, LabelCreate
from backend.auth import get_current_user
from backend.websocket_manager import manager
from backend.routes.project_routes import verify_project_access

router = APIRouter(tags=["tasks"])

@router.post("/api/projects/{project_id}/tasks")
async def create_task(project_id: int, req: TaskCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project, _ = verify_project_access(project_id, current_user.id, db)

    col = db.query(BoardColumn).filter(BoardColumn.id == req.column_id, BoardColumn.project_id == project_id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Target column not found in this project")

    # Determine order in this column
    last_task = db.query(Task).filter(Task.column_id == req.column_id).order_by(Task.order.desc()).first()
    order = (last_task.order + 1) if last_task else 0

    task = Task(
        project_id=project_id,
        column_id=req.column_id,
        title=req.title,
        description=req.description or "",
        priority=req.priority or "medium",
        due_date=req.due_date,
        order=order,
        created_by_id=current_user.id
    )
    db.add(task)
    db.flush()

    # Assignees
    assigned_users = []
    if req.assignee_ids:
        users = db.query(User).filter(User.id.in_(req.assignee_ids)).all()
        task.assignees = users
        assigned_users = users

    # Labels
    if req.labels:
        for lbl in req.labels:
            label_obj = TaskLabel(
                task_id=task.id,
                name=lbl.get("name", "Tag"),
                color=lbl.get("color", "#3B82F6")
            )
            db.add(label_obj)

    # Activity
    activity = Activity(
        project_id=project_id,
        task_id=task.id,
        user_id=current_user.id,
        action_type="task_created",
        description=f"created task '{task.title}' in '{col.name}'"
    )
    db.add(activity)

    # Notifications for assigned members
    for user in assigned_users:
        if user.id != current_user.id:
            notif = Notification(
                user_id=user.id,
                actor_id=current_user.id,
                project_id=project_id,
                task_id=task.id,
                message=f"{current_user.full_name} assigned you to '{task.title}'"
            )
            db.add(notif)
            db.flush()
            await manager.send_to_user(user.id, "new_notification", notif.to_dict())

    db.commit()
    db.refresh(task)

    data = task.to_dict()
    await manager.broadcast_to_project(project_id, "task_created", data)
    return data

@router.get("/api/tasks/{task_id}")
def get_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    verify_project_access(task.project_id, current_user.id, db)
    return task.to_dict()

@router.put("/api/tasks/{task_id}")
async def update_task(task_id: int, req: TaskUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    verify_project_access(task.project_id, current_user.id, db)

    changes = []
    if req.title is not None and req.title != task.title:
        changes.append(f"renamed task to '{req.title}'")
        task.title = req.title
    if req.description is not None:
        task.description = req.description
    if req.priority is not None and req.priority != task.priority:
        changes.append(f"set priority to {req.priority}")
        task.priority = req.priority
    if req.due_date is not None:
        task.due_date = req.due_date
    if req.order is not None:
        task.order = req.order

    if req.assignee_ids is not None:
        old_ids = {u.id for u in task.assignees}
        new_users = db.query(User).filter(User.id.in_(req.assignee_ids)).all()
        task.assignees = new_users
        new_ids = {u.id for u in new_users}

        # Newly assigned users
        added_ids = new_ids - old_ids
        for uid in added_ids:
            if uid != current_user.id:
                notif = Notification(
                    user_id=uid,
                    actor_id=current_user.id,
                    project_id=task.project_id,
                    task_id=task.id,
                    message=f"{current_user.full_name} assigned you to '{task.title}'"
                )
                db.add(notif)
                db.flush()
                await manager.send_to_user(uid, "new_notification", notif.to_dict())

    if changes:
        activity = Activity(
            project_id=task.project_id,
            task_id=task.id,
            user_id=current_user.id,
            action_type="task_updated",
            description=", ".join(changes)
        )
        db.add(activity)

    db.commit()
    db.refresh(task)

    data = task.to_dict()
    await manager.broadcast_to_project(task.project_id, "task_updated", data)
    return data

@router.post("/api/tasks/{task_id}/move")
async def move_task(task_id: int, req: TaskMove, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    verify_project_access(task.project_id, current_user.id, db)

    target_col = db.query(BoardColumn).filter(
        BoardColumn.id == req.column_id,
        BoardColumn.project_id == task.project_id
    ).first()
    if not target_col:
        raise HTTPException(status_code=400, detail="Invalid destination column")

    old_col_name = task.column.name
    moved_column = (task.column_id != req.column_id)

    # Shift orders in target column to make room at target_order
    tasks_in_target = db.query(Task).filter(
        Task.column_id == req.column_id,
        Task.id != task.id
    ).order_by(Task.order).all()

    tasks_in_target.insert(req.target_order, task)
    for idx, t in enumerate(tasks_in_target):
        t.order = idx
        if t.id == task.id:
            t.column_id = req.column_id

    if moved_column:
        activity = Activity(
            project_id=task.project_id,
            task_id=task.id,
            user_id=current_user.id,
            action_type="task_moved",
            description=f"moved '{task.title}' from {old_col_name} to {target_col.name}"
        )
        db.add(activity)

    db.commit()
    db.refresh(task)

    broadcast_data = {
        "task_id": task.id,
        "source_column_id": task.column_id if not moved_column else None,
        "destination_column_id": req.column_id,
        "target_order": req.target_order,
        "task": task.to_dict()
    }
    await manager.broadcast_to_project(task.project_id, "task_moved", broadcast_data)
    return task.to_dict()

@router.delete("/api/tasks/{task_id}")
async def delete_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    verify_project_access(task.project_id, current_user.id, db)

    project_id = task.project_id
    task_title = task.title

    activity = Activity(
        project_id=project_id,
        task_id=None,
        user_id=current_user.id,
        action_type="task_deleted",
        description=f"deleted task '{task_title}'"
    )
    db.add(activity)
    db.delete(task)
    db.commit()

    await manager.broadcast_to_project(project_id, "task_deleted", {"task_id": task_id})
    return {"message": "Task deleted"}

# Checklist Endpoints
@router.post("/api/tasks/{task_id}/checklists")
async def add_checklist_item(task_id: int, req: ChecklistItemCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    verify_project_access(task.project_id, current_user.id, db)

    last_item = db.query(TaskChecklist).filter(TaskChecklist.task_id == task_id).order_by(TaskChecklist.order.desc()).first()
    order = (last_item.order + 1) if last_item else 0

    item = TaskChecklist(
        task_id=task_id,
        title=req.title,
        order=order,
        is_completed=False
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    data = item.to_dict()
    await manager.broadcast_to_project(task.project_id, "checklist_item_added", {"task_id": task_id, "item": data})
    return data

@router.put("/api/checklists/{item_id}")
async def update_checklist_item(item_id: int, req: ChecklistItemUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = db.query(TaskChecklist).filter(TaskChecklist.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    verify_project_access(item.task.project_id, current_user.id, db)

    if req.title is not None:
        item.title = req.title
    if req.is_completed is not None:
        item.is_completed = req.is_completed
    if req.order is not None:
        item.order = req.order

    db.commit()
    db.refresh(item)

    data = item.to_dict()
    await manager.broadcast_to_project(item.task.project_id, "checklist_item_updated", {"task_id": item.task_id, "item": data})
    return data

@router.delete("/api/checklists/{item_id}")
async def delete_checklist_item(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = db.query(TaskChecklist).filter(TaskChecklist.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    task_id = item.task_id
    project_id = item.task.project_id
    verify_project_access(project_id, current_user.id, db)

    db.delete(item)
    db.commit()

    await manager.broadcast_to_project(project_id, "checklist_item_deleted", {"task_id": task_id, "item_id": item_id})
    return {"message": "Checklist item deleted"}

# Label Endpoints
@router.post("/api/tasks/{task_id}/labels")
async def add_label(task_id: int, req: LabelCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    verify_project_access(task.project_id, current_user.id, db)

    label = TaskLabel(
        task_id=task_id,
        name=req.name,
        color=req.color or "#3B82F6"
    )
    db.add(label)
    db.commit()
    db.refresh(label)

    data = label.to_dict()
    await manager.broadcast_to_project(task.project_id, "label_added", {"task_id": task_id, "label": data})
    return data

@router.delete("/api/labels/{label_id}")
async def delete_label(label_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    label = db.query(TaskLabel).filter(TaskLabel.id == label_id).first()
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")
    task_id = label.task_id
    project_id = label.task.project_id
    verify_project_access(project_id, current_user.id, db)

    db.delete(label)
    db.commit()

    await manager.broadcast_to_project(project_id, "label_deleted", {"task_id": task_id, "label_id": label_id})
    return {"message": "Label deleted"}
