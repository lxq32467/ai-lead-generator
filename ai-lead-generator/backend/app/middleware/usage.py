"""Usage tracking middleware — counts leads and messages per user per day."""
from datetime import date
from fastapi import Request, HTTPException
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.user import User

PLAN_LIMITS = {"free": 10, "pro": 200}


def get_user_by_api_key(api_key: str, db: Session) -> User | None:
    return db.query(User).filter(User.api_key == api_key).first()


def create_user(db: Session, plan: str = "free") -> User:
    user = User(plan=plan)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def check_and_track_usage(api_key: str, action: str = "lead") -> dict:
    """Check usage limits and track. Returns status dict."""
    db = SessionLocal()
    try:
        user = get_user_by_api_key(api_key, db)
        if not user:
            return {"allowed": False, "error": "Invalid API key", "user": None}

        today = str(date.today())
        if user.usage_date != today:
            user.daily_lead_count = 0
            user.daily_message_count = 0
            user.usage_date = today

        limit = PLAN_LIMITS.get(user.plan, 10)

        if action == "lead":
            if user.daily_lead_count >= limit:
                return {"allowed": False, "error": f"Daily lead limit reached ({limit}/{user.plan})", "user": user, "limit": limit, "used": user.daily_lead_count}
            user.daily_lead_count += 1
            user.total_lead_count += 1

        elif action == "message":
            if user.daily_message_count >= limit:
                return {"allowed": False, "error": f"Daily message limit reached ({limit}/{user.plan})", "user": user, "limit": limit, "used": user.daily_message_count}
            user.daily_message_count += 1

        db.commit()
        return {"allowed": True, "user": user, "limit": limit, "used_lead": user.daily_lead_count, "used_message": user.daily_message_count}
    finally:
        db.close()
