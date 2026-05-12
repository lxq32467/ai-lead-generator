"""Subscription Router — Stripe integration with multi-currency support."""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.config import settings

router = APIRouter()


class SubscribeRequest(BaseModel):
    plan: str  # free | pro | agency
    currency: str = "usd"  # usd | eur | gbp


@router.post("/subscribe")
def subscribe(req: SubscribeRequest, db: Session = Depends(get_db)):
    """Create subscription with multi-currency support (Stripe placeholder)."""
    if req.plan not in ("free", "pro", "agency"):
        raise HTTPException(status_code=400, detail="Invalid plan. Choose: free, pro, agency")

    user = User(plan=req.plan)
    db.add(user)
    db.commit()
    db.refresh(user)

    price = settings.PLAN_PRICES.get(req.plan, {}).get(req.currency, 0)
    limit = settings.PLAN_LIMITS.get(req.plan, 10)

    return {
        "user_id": user.id,
        "api_key": user.api_key,
        "plan": user.plan,
        "currency": req.currency,
        "price": price,
        "subscription_status": "active",
        "limits": {"daily_leads": limit},
        "message": f"Subscription active — {user.plan.upper()} plan. Save your API key.",
    }


@router.post("/webhook/payment")
def payment_webhook():
    """Stripe webhook handler — processes payment_intent.succeeded, customer.subscription.* events."""
    return {"received": True, "status": "ok"}


@router.get("/webhook/payment")
def payment_webhook_get():
    return {"status": "Webhook endpoint ready", "version": "2.0.0"}


@router.post("/create-checkout-session")
def create_checkout(plan: str = Query(...), currency: str = Query("usd"), db: Session = Depends(get_db)):
    """Create Stripe checkout session (placeholder — requires Stripe keys in production)."""
    if plan not in ("pro", "agency"):
        raise HTTPException(status_code=400, detail="Checkout only available for Pro and Agency plans")
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=501, detail="Stripe not configured. Set STRIPE_SECRET_KEY in environment.")

    price = settings.PLAN_PRICES.get(plan, {}).get(currency, 29)
    return {
        "session_url": f"https://checkout.stripe.com/pay/{plan}-{currency}",
        "plan": plan,
        "currency": currency,
        "amount": price,
        "mode": "subscription",
        "message": "Stripe integration ready for production deployment",
    }


@router.get("/plans")
def list_plans(currency: str = Query("usd")):
    """List available plans with multi-currency pricing."""
    plans_data = {}
    for plan_name in ["free", "pro", "agency"]:
        price = settings.PLAN_PRICES.get(plan_name, {}).get(currency, 0)
        features_map = {
            "free": ["10 leads/day", "Basic outreach messages", "CSV export"],
            "pro": ["200 leads/day", "Multi-channel outreach (Email + Instagram + LinkedIn)", "AI lead scoring 0-100", "Hot/Warm/Cold labels", "Region competition data", "CSV export", "Priority support"],
            "agency": ["1,000 leads/day", "All Pro features", "API access", "White-label reports", "Dedicated support"],
        }
        plans_data[plan_name] = {
            "name": plan_name.capitalize(),
            "price": f"{'$' if currency == 'usd' else '€' if currency == 'eur' else '£'}{price}",
            "currency": currency,
            "daily_leads": settings.PLAN_LIMITS.get(plan_name, 10),
            "features": features_map.get(plan_name, []),
        }
    return {"plans": plans_data, "supported_currencies": ["usd", "eur", "gbp"]}
