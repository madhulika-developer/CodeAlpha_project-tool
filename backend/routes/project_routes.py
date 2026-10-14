from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List
from backend.database import get_db
from backend.models import User, Project, ProjectMember, BoardColumn, Task, Activity, Notification
from backend.schemas import ProjectCreate, ProjectUpdate, ProjectMemberAdd
from backend.auth import get_current_user
from backend.websocket_manager import manager

router = APIRouter(prefix="/api/projects", tags=["projects"])

def verify_project_access(project_id: int, user_id: int, db: Session, require_admin: bool = False):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    membership = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id
    ).first()

    if not membership and project.owner_id != user_id:
        raise HTTPException(status_code=403, detail="You do not have access to this project")

    if require_admin:
        role = "owner" if project.owner_id == user_id else (membership.role if membership else "")
        if role not in ["owner", "admin"]:
            raise HTTPException(status_code=403, detail="Admin or owner role required")

    return project, membership

@router.get("")
def get_user_projects(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Find all projects where user is owner or member
    projects = db.query(Project).join(
        ProjectMember, ProjectMember.project_id == Project.id, isouter=True
    ).filter(
        or_(
            Project.owner_id == current_user.id,
            ProjectMember.user_id == current_user.id
        )
    ).distinct().order_by(Project.updated_at.desc()).all()

    result = []
    for p in projects:
        data = p.to_dict()
        data["role"] = "owner" if p.owner_id == current_user.id else "member"
        result.append(data)
    return result

@router.post("")
async def create_project(req: ProjectCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = Project(
        name=req.name,
        description=req.description or "",
        color=req.color or "#6366F1",
        icon=req.icon or "briefcase",
        owner_id=current_user.id
    )
    db.add(project)
    db.flush()

    # Add owner as project member with "owner" role
    owner_member = ProjectMember(
        project_id=project.id,
        user_id=current_user.id,
        role="owner"
    )
    db.add(owner_member)

    # Create default columns
    default_columns = [
        ("To Do", "#94A3B8", 0),
        ("In Progress", "#38BDF8", 1),
        ("In Review", "#FBBF24", 2),
        ("Done", "#34D399", 3)
    ]
    for col_name, col_color, col_order in default_columns:
        col = BoardColumn(
            project_id=project.id,
            name=col_name,
            color=col_color,
            order=col_order
        )
        db.add(col)

    # Activity log
    activity = Activity(
        project_id=project.id,
        user_id=current_user.id,
        action_type="project_created",
        description=f"created project '{project.name}'"
    )
    db.add(activity)

    db.commit()
    db.refresh(project)
    return project.to_dict()

@router.get("/{project_id}")
def get_project_details(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project, _ = verify_project_access(project_id, current_user.id, db)
    
    # Columns with tasks sorted
    columns = db.query(BoardColumn).filter(
        BoardColumn.project_id == project_id
    ).order_by(BoardColumn.order).all()

    members = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id
    ).all()

    proj_dict = project.to_dict()
    proj_dict["columns"] = [c.to_dict() for c in columns]
    proj_dict["members"] = [m.to_dict() for m in members]
    return proj_dict

@router.put("/{project_id}")
async def update_project(project_id: int, req: ProjectUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project, _ = verify_project_access(project_id, current_user.id, db, require_admin=True)

    if req.name is not None:
        project.name = req.name
    if req.description is not None:
        project.description = req.description
    if req.color is not None:
        project.color = req.color
    if req.icon is not None:
        project.icon = req.icon
    if req.is_archived is not None:
        project.is_archived = req.is_archived

    db.commit()
    db.refresh(project)

    await manager.broadcast_to_project(project_id, "project_updated", project.to_dict())
    return project.to_dict()

@router.delete("/{project_id}")
async def delete_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only project owner can delete this project")

    db.delete(project)
    db.commit()

    await manager.broadcast_to_project(project_id, "project_deleted", {"project_id": project_id})
    return {"message": "Project deleted successfully"}

@router.get("/{project_id}/members")
def get_project_members(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    verify_project_access(project_id, current_user.id, db)
    members = db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()
    return [m.to_dict() for m in members]

@router.post("/{project_id}/members")
async def add_project_member(project_id: int, req: ProjectMemberAdd, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project, _ = verify_project_access(project_id, current_user.id, db, require_admin=True)

    query_val = req.username_or_email.lower().strip()
    target_user = db.query(User).filter(
        or_(User.email == query_val, User.username == query_val)
    ).first()

    if not target_user:
        raise HTTPException(status_code=404, detail=f"User '{req.username_or_email}' not found")

    existing = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == target_user.id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="User is already a member of this project")

    member = ProjectMember(
        project_id=project_id,
        user_id=target_user.id,
        role=req.role or "member"
    )
    db.add(member)

    # Activity
    activity = Activity(
        project_id=project_id,
        user_id=current_user.id,
        action_type="member_added",
        description=f"added {target_user.full_name} to the project as {req.role or 'member'}"
    )
    db.add(activity)

    # Notification for the added user
    notif = Notification(
        user_id=target_user.id,
        actor_id=current_user.id,
        project_id=project_id,
        message=f"{current_user.full_name} added you to '{project.name}'"
    )
    db.add(notif)
    db.commit()
    db.refresh(member)
    db.refresh(notif)

    member_data = member.to_dict()
    await manager.broadcast_to_project(project_id, "member_added", member_data)
    await manager.send_to_user(target_user.id, "new_notification", notif.to_dict())

    return member_data

@router.delete("/{project_id}/members/{user_id}")
async def remove_project_member(project_id: int, user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project, current_mem = verify_project_access(project_id, current_user.id, db)

    # User can leave themselves, or an admin/owner can remove others
    if current_user.id != user_id and project.owner_id != current_user.id and (not current_mem or current_mem.role != "admin"):
        raise HTTPException(status_code=403, detail="Permission denied to remove member")

    if user_id == project.owner_id:
        raise HTTPException(status_code=400, detail="Cannot remove project owner")

    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id
    ).first()

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    target_user = member.user
    db.delete(member)

    # Activity
    activity = Activity(
        project_id=project_id,
        user_id=current_user.id,
        action_type="member_removed",
        description=f"removed {target_user.full_name if target_user else 'user'} from the project"
    )
    db.add(activity)
    db.commit()

    await manager.broadcast_to_project(project_id, "member_removed", {"user_id": user_id})
    return {"message": "Member removed successfully"}

@router.get("/{project_id}/activity")
def get_project_activity(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    verify_project_access(project_id, current_user.id, db)
    activities = db.query(Activity).filter(
        Activity.project_id == project_id
    ).order_by(Activity.created_at.desc()).limit(50).all()
    return [a.to_dict() for a in activities]
