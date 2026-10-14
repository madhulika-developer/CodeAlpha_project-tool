from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from backend.database import get_db
from backend.models import Notification, User
from backend.schemas import NotificationMarkRead
from backend.auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

@router.get("")
def get_user_notifications(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    notifications = db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(Notification.created_at.desc()).limit(30).all()

    unread_count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).count()

    return {
        "notifications": [n.to_dict() for n in notifications],
        "unread_count": unread_count
    }

@router.post("/read")
def mark_notifications_read(req: NotificationMarkRead, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(Notification).filter(Notification.user_id == current_user.id)
    if req.notification_ids:
        q = q.filter(Notification.id.in_(req.notification_ids))
    
    q.update({"is_read": True}, synchronize_session=False)
    db.commit()
    return {"message": "Notifications marked as read"}

@router.delete("/{notification_id}")
def delete_notification(notification_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    if notif:
        db.delete(notif)
        db.commit()
    return {"message": "Notification deleted"}
