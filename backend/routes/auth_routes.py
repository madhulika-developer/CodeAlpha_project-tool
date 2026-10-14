from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import User
from backend.schemas import UserRegister, UserLogin, TokenResponse
from backend.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=TokenResponse)
def register(req: UserRegister, db: Session = Depends(get_db)):
    # Check if email or username already exists
    if db.query(User).filter(User.email == req.email.lower()).first():
        raise HTTPException(status_code=400, detail="Email is already registered")
    if db.query(User).filter(User.username == req.username.lower()).first():
        raise HTTPException(status_code=400, detail="Username is already taken")

    user = User(
        email=req.email.lower(),
        username=req.username.lower(),
        full_name=req.full_name,
        hashed_password=hash_password(req.password),
        avatar_color=req.avatar_color or "#4F46E5"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(data={"sub": str(user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user.to_dict()
    }

@router.post("/login", response_model=TokenResponse)
def login(req: UserLogin, db: Session = Depends(get_db)):
    identity = req.username_or_email.lower().strip()
    user = db.query(User).filter(
        (User.email == identity) | (User.username == identity)
    ).first()

    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username/email or password")

    token = create_access_token(data={"sub": str(user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user.to_dict()
    }

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return current_user.to_dict()

@router.get("/users")
def get_all_users(query: str = "", db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Search/list users for assigning or inviting to projects"""
    q = db.query(User)
    if query:
        q = q.filter(
            (User.username.ilike(f"%{query}%")) | 
            (User.full_name.ilike(f"%{query}%")) | 
            (User.email.ilike(f"%{query}%"))
        )
    users = q.limit(20).all()
    return [u.to_dict() for u in users]

@router.get("/demo-users")
def get_demo_users(db: Session = Depends(get_db)):
    """Convenience list of available users for quick collaboration switching"""
    users = db.query(User).limit(5).all()
    return [u.to_dict() for u in users]

@router.post("/demo-login/{user_id}", response_model=TokenResponse)
def demo_login(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Demo user not found")
    token = create_access_token(data={"sub": str(user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user.to_dict()
    }
