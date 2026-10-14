from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class UserRegister(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    username: str = Field(..., min_length=3, max_length=50)
    full_name: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=6)
    avatar_color: Optional[str] = "#4F46E5"

class UserLogin(BaseModel):
    username_or_email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = ""
    color: Optional[str] = "#6366F1"
    icon: Optional[str] = "briefcase"

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    is_archived: Optional[bool] = None

class ProjectMemberAdd(BaseModel):
    username_or_email: str
    role: Optional[str] = "member"

class ColumnCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)
    color: Optional[str] = "#64748B"
    order: Optional[int] = None

class ColumnUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    order: Optional[int] = None

class TaskCreate(BaseModel):
    column_id: int
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = ""
    priority: Optional[str] = "medium"
    due_date: Optional[datetime] = None
    assignee_ids: Optional[List[int]] = []
    labels: Optional[List[dict]] = []

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    column_id: Optional[int] = None
    priority: Optional[str] = None
    due_date: Optional[datetime] = None
    order: Optional[int] = None
    assignee_ids: Optional[List[int]] = None

class TaskMove(BaseModel):
    column_id: int
    target_order: int

class ChecklistItemCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)

class ChecklistItemUpdate(BaseModel):
    title: Optional[str] = None
    is_completed: Optional[bool] = None
    order: Optional[int] = None

class LabelCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    color: Optional[str] = "#3B82F6"

class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1)

class NotificationMarkRead(BaseModel):
    notification_ids: Optional[List[int]] = None
