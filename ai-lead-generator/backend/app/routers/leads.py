"""Leads Router v2.1 — Quality validation, double-layer scoring, revenue estimation, KPIs."""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.lead import Lead
from app.models.user import User
from app.middleware.usage import check_and_track_usage, create_user
from app.services.lead_service import (
    generate_leads, validate_lead_quality, calculate_final_score,
    estimate_revenue_potential, generate_outreach_batch, generate_ai_suggestion,
)

router = APIRouter()


@router.post("/generate")
def generate(
    api_key: str = Query(...),
    keyword: str = Query(...),
    industry: str = Query(default="Technology"),
    location: str = Query(default="USA"),
    limit: int = Query(default=10, le=20),
    db: Session = Depends(get_db),
):
    """Generate leads with quality validation and double-layer scoring."""
    usage = check_and_track_usage(api_key, "lead")
    if not usage["allowed"]:
        raise HTTPException(status_code=429, detail=usage["error"])

    user = usage["user"]

    # Layer 1: AI generates leads
    leads_data = generate_leads(keyword, industry, location, limit)

    # Batch outreach generation (single API call for all leads)
    outreach_results = generate_outreach_batch(leads_data)

    saved = []
    rejected = 0

    for i, ld in enumerate(leads_data):
        # Layer 2: Quality validation (per-lead)
        validation = validate_lead_quality(ld)
        if not validation.get("is_valid", True):
            rejected += 1
            continue

        # Double-layer scoring
        initial_score = ld.get("lead_score", 50)
        final_score = calculate_final_score(initial_score, validation)
        category = "hot" if final_score >= 70 else "warm" if final_score >= 40 else "cold"

        # Revenue estimation
        revenue = estimate_revenue_potential(final_score, ld.get("industry", industry))

        # Outreach (from batch result)
        outreach = outreach_results[i] if i < len(outreach_results) else {}
        if not outreach.get("email"):
            from app.services.lead_service import _mock_outreach
            outreach = _mock_outreach(ld)

        # AI suggestion
        suggestion = generate_ai_suggestion({**ld, "lead_score": final_score})

        lead = Lead(
            user_id=user.id,
            business_name=ld["business_name"],
            industry=ld.get("industry", industry),
            location=ld.get("location", location),
            contact_channel=ld.get("contact_channel", outreach.get("best_channel", "email")),
            contact_info=ld.get("contact_info", ""),
            lead_score=final_score,
            buying_intent_reason=ld.get("buying_intent_reason", ""),
            outreach_strategy=ld.get("outreach_strategy", ""),
            outreach_email=outreach.get("email", ""),
            outreach_instagram=outreach.get("instagram", ""),
            outreach_linkedin=outreach.get("linkedin", ""),
            best_channel=outreach.get("best_channel", "email"),
            lead_category=category,
            region_competition_score=ld.get("region_competition_score", 50),
        )
        db.add(lead)
        saved.append({"lead": lead, "revenue": revenue, "suggestion": suggestion})

    db.commit()

    results = []
    total_revenue_low = 0
    total_revenue_high = 0
    high_intent_count = 0

    for item in saved:
        l = item["lead"]
        db.refresh(l)
        rev = item["revenue"]
        total_revenue_low += rev["low"]
        total_revenue_high += rev["high"]
        if l.lead_score >= 70:
            high_intent_count += 1
        results.append({
            **lead_response(l),
            "revenue_potential": rev,
            "ai_suggestion": item["suggestion"],
        })

    return {
        "leads": results,
        "total": len(results),
        "rejected": rejected,
        "kpi": {
            "total_generated": len(results),
            "high_intent_leads": high_intent_count,
            "estimated_revenue_low": total_revenue_low,
            "estimated_revenue_high": total_revenue_high,
            "conversion_probability": round(high_intent_count / max(len(results), 1) * 100, 1),
        },
        "usage": {"used": usage["used_lead"], "limit": usage["limit"], "plan": user.plan},
    }


@router.get("/")
def list_leads(
    api_key: str = Query(...),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    lead_category: str | None = None,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.api_key == api_key).first()
    if not user:
        raise HTTPException(status_code=404, detail="Invalid API key")
    query = db.query(Lead).filter(Lead.user_id == user.id)
    if lead_category:
        query = query.filter(Lead.lead_category == lead_category)
    total = query.count()
    leads = query.order_by(Lead.lead_score.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"leads": [lead_response(l) for l in leads], "total": total}


@router.get("/kpi")
def get_kpi(api_key: str = Query(...), db: Session = Depends(get_db)):
    """Dashboard KPIs — leads today, high-intent count, estimated revenue."""
    user = db.query(User).filter(User.api_key == api_key).first()
    if not user:
        raise HTTPException(status_code=404, detail="Invalid API key")
    leads = db.query(Lead).filter(Lead.user_id == user.id).all()
    high_intent = [l for l in leads if l.lead_score >= 70]
    total_rev = sum(500 + (l.lead_score * 20) for l in high_intent)
    return {
        "leads_today": user.daily_lead_count,
        "total_leads": len(leads),
        "high_intent_leads": len(high_intent),
        "estimated_revenue_potential": total_rev,
        "conversion_probability": round(len(high_intent) / max(len(leads), 1) * 100, 1),
        "plan": user.plan,
        "limit": {"free": 10, "pro": 200, "agency": 1000}.get(user.plan, 10),
    }


@router.get("/{lead_id}")
def get_lead(lead_id: str, api_key: str = Query(...), db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Not found")
    revenue = estimate_revenue_potential(lead.lead_score, lead.industry or "Technology")
    return {"lead": {**lead_response(lead), "revenue_potential": revenue}}


@router.post("/export")
def export_leads(api_key: str = Query(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.api_key == api_key).first()
    if not user:
        raise HTTPException(status_code=404, detail="Invalid API key")
    import csv, io
    leads = db.query(Lead).filter(Lead.user_id == user.id).order_by(Lead.lead_score.desc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Business", "Industry", "Location", "Channel", "Contact", "Score", "Category", "Est. Revenue ($)", "Buying Intent", "Email Outreach", "LinkedIn Outreach", "Instagram Outreach"])
    for l in leads:
        rev = estimate_revenue_potential(l.lead_score, l.industry or "")
        writer.writerow([l.business_name, l.industry, l.location, l.contact_channel, l.contact_info, l.lead_score, l.lead_category, f"${rev['estimated']}", l.buying_intent_reason, l.outreach_email, l.outreach_linkedin, l.outreach_instagram])
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=leads.csv"})


@router.post("/init")
def init_user(db: Session = Depends(get_db)):
    user = create_user(db, "pro")
    return {"api_key": user.api_key, "plan": user.plan, "message": "Use this API key in all requests"}


def lead_response(l: Lead) -> dict:
    return {
        "id": str(l.id), "business_name": l.business_name, "industry": l.industry,
        "location": l.location, "contact_channel": l.contact_channel, "contact_info": l.contact_info,
        "lead_score": l.lead_score, "buying_intent_reason": l.buying_intent_reason,
        "outreach_strategy": l.outreach_strategy,
        "outreach_email": l.outreach_email, "outreach_instagram": l.outreach_instagram,
        "outreach_linkedin": l.outreach_linkedin, "best_channel": l.best_channel,
        "lead_category": l.lead_category, "region_competition_score": l.region_competition_score,
        "source": l.source, "status": l.status,
        "created_at": str(l.created_at), "updated_at": str(l.updated_at),
    }
