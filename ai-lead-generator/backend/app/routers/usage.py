"""Usage Dashboard Router."""
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.lead import Lead
from app.middleware.usage import PLAN_LIMITS
from datetime import date

router = APIRouter()


@router.get("/{api_key}")
def get_usage(api_key: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.api_key == api_key).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    today = str(date.today())
    # Reset daily counter if new day
    if user.usage_date != today:
        user.daily_lead_count = 0
        user.daily_message_count = 0
        user.usage_date = today
        db.commit()

    total_leads = db.query(Lead).filter(Lead.user_id == user.id).count()
    limit = PLAN_LIMITS.get(user.plan, 10)

    return {
        "plan": user.plan,
        "subscription_status": user.subscription_status,
        "daily": {
            "leads_used": user.daily_lead_count,
            "leads_limit": limit,
            "messages_used": user.daily_message_count,
            "remaining": max(0, limit - user.daily_lead_count),
        },
        "total": {
            "leads_generated": total_leads,
            "since": str(user.created_at),
        },
    }


@router.get("/{api_key}/logs")
def get_logs(api_key: str, limit: int = Query(20, le=100), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.api_key == api_key).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    leads = db.query(Lead).filter(Lead.user_id == user.id).order_by(Lead.created_at.desc()).limit(limit).all()
    return {"logs": [{"business_name": l.business_name, "lead_score": l.lead_score, "lead_category": l.lead_category, "created_at": str(l.created_at)} for l in leads]}
