from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Table
)
from sqlalchemy.orm import relationship
from backend.database import Base

task_assignees = Table(
    'task_assignees',
    Base.metadata,
    Column('task_id', Integer, ForeignKey('tasks.id', ondelete='CASCADE'), primary_key=True),
    Column('user_id', Integer, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(50), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    avatar_color = Column(String(20), default="#4F46E5")
    bio = Column(String(255), default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    project_memberships = relationship("ProjectMember", back_populates="user", cascade="all, delete-orphan")
    owned_projects = relationship("Project", back_populates="owner")
    comments = relationship("Comment", back_populates="author", cascade="all, delete-orphan")
    notifications = relationship("Notification", foreign_keys="Notification.user_id", back_populates="recipient", cascade="all, delete-orphan")
    assigned_tasks = relationship("Task", secondary=task_assignees, back_populates="assignees")

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "username": self.username,
            "full_name": self.full_name,
            "avatar_color": self.avatar_color,
            "bio": self.bio,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, default="")
    color = Column(String(20), default="#6366F1")
    icon = Column(String(30), default="briefcase")
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    is_archived = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    owner = relationship("User", back_populates="owned_projects")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    columns = relationship("BoardColumn", back_populates="project", cascade="all, delete-orphan", order_by="BoardColumn.order")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    activities = relationship("Activity", back_populates="project", cascade="all, delete-orphan", order_by="desc(Activity.created_at)")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "color": self.color,
            "icon": self.icon,
            "owner_id": self.owner_id,
            "is_archived": self.is_archived,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "member_count": len(self.members) if self.members else 0,
            "task_count": len(self.tasks) if self.tasks else 0,
        }

class ProjectMember(Base):
    __tablename__ = "project_members"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), default="member")  # owner, admin, member, viewer
    joined_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="members")
    user = relationship("User", back_populates="project_memberships")

    def to_dict(self):
        return {
            "id": self.id,
            "project_id": self.project_id,
            "user_id": self.user_id,
            "role": self.role,
            "joined_at": self.joined_at.isoformat() if self.joined_at else None,
            "user": self.user.to_dict() if self.user else None
        }

class BoardColumn(Base):
    __tablename__ = "board_columns"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(60), nullable=False)
    order = Column(Integer, default=0)
    color = Column(String(20), default="#64748B")
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="columns")
    tasks = relationship("Task", back_populates="column", cascade="all, delete-orphan", order_by="Task.order")

    def to_dict(self):
        return {
            "id": self.id,
            "project_id": self.project_id,
            "name": self.name,
            "order": self.order,
            "color": self.color,
            "tasks": [t.to_dict() for t in self.tasks] if self.tasks else []
        }

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    column_id = Column(Integer, ForeignKey("board_columns.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, default="")
    priority = Column(String(20), default="medium")  # low, medium, high, urgent
    due_date = Column(DateTime, nullable=True)
    order = Column(Integer, default=0)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="tasks")
    column = relationship("BoardColumn", back_populates="tasks")
    created_by = relationship("User", foreign_keys=[created_by_id])
    assignees = relationship("User", secondary=task_assignees, back_populates="assigned_tasks")
    labels = relationship("TaskLabel", back_populates="task", cascade="all, delete-orphan")
    checklists = relationship("TaskChecklist", back_populates="task", cascade="all, delete-orphan", order_by="TaskChecklist.order")
    comments = relationship("Comment", back_populates="task", cascade="all, delete-orphan", order_by="Comment.created_at")

    def to_dict(self):
        checklist_items = [c.to_dict() for c in self.checklists] if self.checklists else []
        total_checks = len(checklist_items)
        completed_checks = sum(1 for c in checklist_items if c["is_completed"])

        return {
            "id": self.id,
            "project_id": self.project_id,
            "column_id": self.column_id,
            "title": self.title,
            "description": self.description,
            "priority": self.priority,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "order": self.order,
            "created_by": self.created_by.to_dict() if self.created_by else None,
            "assignees": [u.to_dict() for u in self.assignees] if self.assignees else [],
            "labels": [l.to_dict() for l in self.labels] if self.labels else [],
            "checklists": checklist_items,
            "checklist_stats": {
                "total": total_checks,
                "completed": completed_checks
            },
            "comment_count": len(self.comments) if self.comments else 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

class TaskLabel(Base):
    __tablename__ = "task_labels"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(50), nullable=False)
    color = Column(String(20), default="#3B82F6")

    task = relationship("Task", back_populates="labels")

    def to_dict(self):
        return {
            "id": self.id,
            "task_id": self.task_id,
            "name": self.name,
            "color": self.color
        }

class TaskChecklist(Base):
    __tablename__ = "task_checklists"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    is_completed = Column(Boolean, default=False)
    order = Column(Integer, default=0)

    task = relationship("Task", back_populates="checklists")

    def to_dict(self):
        return {
            "id": self.id,
            "task_id": self.task_id,
            "title": self.title,
            "is_completed": self.is_completed,
            "order": self.order
        }

class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    task = relationship("Task", back_populates="comments")
    author = relationship("User", back_populates="comments")

    def to_dict(self):
        return {
            "id": self.id,
            "task_id": self.task_id,
            "user_id": self.user_id,
            "content": self.content,
            "author": self.author.to_dict() if self.author else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    action_type = Column(String(50), nullable=False) # e.g. "task_created", "task_moved", "comment_added", "task_assigned"
    description = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="activities")
    user = relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "project_id": self.project_id,
            "task_id": self.task_id,
            "user_id": self.user_id,
            "action_type": self.action_type,
            "description": self.description,
            "user": self.user.to_dict() if self.user else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    actor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True)
    message = Column(String(255), nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    recipient = relationship("User", foreign_keys=[user_id], back_populates="notifications")
    actor = relationship("User", foreign_keys=[actor_id])

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "actor_id": self.actor_id,
            "actor": self.actor.to_dict() if self.actor else None,
            "project_id": self.project_id,
            "task_id": self.task_id,
            "message": self.message,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
