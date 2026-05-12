"""Admin Router — User management & statistics."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.lead import Lead
from app.auth import get_current_user, require_admin

router = APIRouter(dependencies=[Depends(require_admin)])


@router.get("/users")
def list_users(page: int = 1, limit: int = 20, db: Session = Depends(get_db)):
    total = db.query(User).count()
    users = db.query(User).order_by(User.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {
        "users": [{"id": str(u.id), "email": u.email, "name": u.name, "role": u.role, "is_active": u.is_active, "created_at": str(u.created_at)} for u in users],
        "total": total,
    }


@router.put("/users/{user_id}")
def update_user(user_id: str, data: dict, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for key in ("is_active", "role"):
        if key in data:
            setattr(user, key, data[key])
    db.commit()
    return {"message": "User updated"}


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    return {
        "total_users": db.query(User).count(),
        "active_users": db.query(User).filter(User.is_active == True).count(),
        "total_leads": db.query(Lead).count(),
        "leads_by_status": {
            row[0]: row[1]
            for row in db.query(Lead.status, db.func.count(Lead.id)).group_by(Lead.status).all()
        },
    }
