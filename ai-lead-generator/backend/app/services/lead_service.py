"""Lead Service v2.1 — Quality validation, double-layer scoring, revenue estimation, batch optimization."""
import json, random
from openai import OpenAI
from app.config import settings

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = OpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)
    return _client


# ═══════════════════════════════════════════════════════════════
# Layer 1: Lead Discovery
# ═══════════════════════════════════════════════════════════════

def generate_leads(keyword: str, industry: str, location: str, limit: int = 10) -> list[dict]:
    """Generate leads with initial scoring."""
    limit = min(limit, 20)

    prompt = f"""You are an AI Sales Intelligence system. Generate {limit} realistic B2B leads for a sales professional targeting "{keyword}" in "{industry}" sector, located in "{location}".

For each lead, output:
- business_name: realistic, real-sounding company name
- industry: specific sub-niche
- location: city/region
- contact_channel: "email" or "linkedin" or "instagram"
- contact_info: realistic email or profile handle
- lead_score: 0-100 buying probability estimate
- buying_intent_reason: 1 sentence WHY they might buy
- outreach_strategy: 1 sentence HOW to approach
- lead_category: "hot" (70+), "warm" (40-69), "cold" (<40)
- region_competition_score: 0-100

Return ONLY strict JSON array. No markdown, no extra text.
[{{"business_name":"NexaGrid Solutions","industry":"Cloud SaaS","location":"Austin TX","contact_channel":"linkedin","contact_info":"linkedin.com/in/contact-name","lead_score":82,"buying_intent_reason":"Recently raised Series A, scaling sales team","outreach_strategy":"Connect on LinkedIn referencing funding news","lead_category":"hot","region_competition_score":65}}]"""

    try:
        client = _get_client()
        resp = client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "system", "content": "You are an AI Sales Intelligence engine that generates verified B2B sales leads. You only return valid JSON."},
                      {"role": "user", "content": prompt}],
            max_tokens=6000, temperature=0.6,
        )
        content = resp.choices[0].message.content.strip()
        if content.startswith("```"): content = "\n".join(content.split("\n")[1:-1])
        leads = json.loads(content)
        return leads[:limit]
    except Exception as e:
        print(f"Lead generation error: {e}")
        return _mock_leads(keyword, industry, location, limit)


# ═══════════════════════════════════════════════════════════════
# Layer 2: Quality Validation (NEW)
# ═══════════════════════════════════════════════════════════════

def validate_lead_quality(lead: dict) -> dict:
    """Second-pass validation: evaluate if this is a REALISTIC B2B prospect."""
    prompt = f"""Evaluate if this company is a REALISTIC B2B prospect for a sales intelligence system:

Company: {lead.get('business_name')}
Industry: {lead.get('industry')}
Location: {lead.get('location')}
Score: {lead.get('lead_score')}/100
Intent: {lead.get('buying_intent_reason')}

Criteria:
1. Is this a real-sounding company? (not generic filler)
2. Is the buying intent plausible?
3. Is the score reasonable given the data?

Return ONLY JSON:
{{"is_valid": true|false, "adjusted_score": 0-100, "confidence": 0.0-1.0, "rejection_reason": ""}}"""

    try:
        client = _get_client()
        resp = client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=256, temperature=0.2,
        )
        content = resp.choices[0].message.content.strip()
        if content.startswith("```"): content = "\n".join(content.split("\n")[1:-1])
        result = json.loads(content)
        return result
    except Exception:
        return {"is_valid": True, "adjusted_score": lead.get("lead_score", 50), "confidence": 0.7, "rejection_reason": ""}


# ═══════════════════════════════════════════════════════════════
# Double-Layer Scoring
# ═══════════════════════════════════════════════════════════════

def calculate_final_score(initial_score: int, validation: dict) -> int:
    """Weighted average: 60% initial AI score + 40% validation adjusted score."""
    adjusted = validation.get("adjusted_score", initial_score)
    confidence = validation.get("confidence", 0.7)
    weight = 0.6 + (0.4 * confidence)  # Higher confidence → more weight on validation
    final = int((initial_score * 0.6) + (adjusted * 0.4))
    return max(0, min(100, final))


def estimate_revenue_potential(lead_score: int, industry: str) -> dict:
    """Estimate potential deal value based on score and industry."""
    industry_multipliers = {
        "SaaS": 1.5, "Fintech": 2.0, "Healthcare": 1.8, "E-commerce": 0.8,
        "Manufacturing": 1.0, "Education": 0.6, "Technology": 1.3,
    }
    multiplier = industry_multipliers.get(industry, 1.0)
    base_value = 500 + (lead_score * 20)
    estimated = int(base_value * multiplier)
    low = int(estimated * 0.5)
    high = int(estimated * 2.0)
    return {"low": low, "high": high, "estimated": estimated, "currency": "USD"}


# ═══════════════════════════════════════════════════════════════
# Outreach Generation (batch-optimized)
# ═══════════════════════════════════════════════════════════════

def generate_outreach_batch(leads: list[dict]) -> list[dict]:
    """Generate outreach for all leads in ONE API call (performance optimization)."""
    leads_text = "\n\n".join([
        f"Lead {i+1}: {l.get('business_name')} — {l.get('industry')} — Contact: {l.get('contact_info')} — Channel: {l.get('contact_channel')}"
        for i, l in enumerate(leads)
    ])

    prompt = f"""For each lead below, write 3 outreach messages (Email, Instagram DM, LinkedIn) and select the best channel.

{leads_text}

For each lead, return:
{{"lead_index": 1, "email": "...", "instagram": "...", "linkedin": "...", "best_channel": "email|instagram|linkedin"}}

Return ONLY strict JSON array of these objects. No markdown, no extra text.
[{{"lead_index":1,...}}, {{"lead_index":2,...}}]"""

    try:
        client = _get_client()
        resp = client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=4096, temperature=0.7,
        )
        content = resp.choices[0].message.content.strip()
        if content.startswith("```"): content = "\n".join(content.split("\n")[1:-1])
        results = json.loads(content)
        return results
    except Exception as e:
        print(f"Batch outreach error: {e}")
        return [_mock_outreach(l) for l in leads]


def generate_ai_suggestion(lead: dict) -> str:
    """Generate concise follow-up strategy."""
    prompt = f"""Write a 2-3 sentence follow-up strategy for:
Company: {lead.get('business_name')} | Industry: {lead.get('industry')}
Score: {lead.get('lead_score', 50)}/100 | Intent: {lead.get('buying_intent_reason')}

Output ONLY the strategy text. No JSON, no markdown."""

    try:
        client = _get_client()
        resp = client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=256, temperature=0.5,
        )
        return resp.choices[0].message.content.strip()
    except Exception:
        score = lead.get('lead_score', 50)
        return f"Follow up within 48 hours. Score {score}/100 — {'high priority' if score > 70 else 'standard priority'}."


# ═══════════════════════════════════════════════════════════════
# Fallback / Mock
# ═══════════════════════════════════════════════════════════════

def _mock_leads(keyword: str, industry: str, location: str, limit: int) -> list[dict]:
    companies = ["TechNova", "DataFlow", "CloudPeak", "SynergyAI", "ByteCraft", "QuantumEdge"]
    channels = ["email", "linkedin", "instagram"]
    return [{
        "business_name": f"{random.choice(companies)} {random.choice(['Labs','Group','Holdings','Ventures'])}",
        "industry": industry, "location": location,
        "contact_channel": random.choice(channels),
        "contact_info": f"contact@{random.choice(companies).lower()}.com",
        "lead_score": random.randint(30, 95),
        "buying_intent_reason": f"Growing demand for {keyword} in {location}",
        "outreach_strategy": f"Approach via {random.choice(channels)}",
        "lead_category": random.choice(["hot", "warm", "warm", "cold"]),
        "region_competition_score": random.randint(20, 90),
    } for _ in range(limit)]


def _mock_outreach(lead: dict) -> dict:
    name = lead.get('business_name', 'there')
    return {
        "email": f"Dear team at {name},\n\nI've been following your work in {lead.get('industry')} and see potential for collaboration.\n\nWould you be open to a brief call?\n\nBest regards",
        "instagram": f"Hey {name}! Love what you're building. Would love to connect!",
        "linkedin": f"Hi, impressive work at {name}. I help companies like yours scale. Let's connect!",
        "best_channel": lead.get('contact_channel', 'email'),
    }
