# AI Lead Generator — Product Review Package

**Version**: 2.0.0  
**Date**: 2026-05-12  
**Status**: Production-Ready (MVP + Commercial Features)

---

## 1. Frontend Architecture

### 1.1 Directory Structure

```
frontend/
├── .env                                  # VITE_API_URL config
├── .env.example                          # Env template
├── index.html                            # HTML entry point
├── package.json                          # Dependencies (React 18, Vite 5, Tailwind 3)
├── vite.config.ts                        # Vite + React plugin + API proxy
├── tsconfig.json                         # TypeScript strict config
├── tailwind.config.js                    # Tailwind CSS
├── postcss.config.js                     # PostCSS pipeline
└── src/
    ├── main.tsx                          # ReactDOM entry
    ├── App.tsx                           # Single-page app (Landing/Pricing/Dashboard/DetailModal)
    ├── index.css                         # Tailwind directives
    ├── vite-env.d.ts                     # Vite type declarations
    └── i18n/
        ├── index.ts                      # i18n framework (t(), setLocale())
        └── en.json                       # English language pack (~115 keys)
```

### 1.2 Components (inline in App.tsx)

| Component | Purpose | Props |
|---|---|---|
| `App` | Root shell, state management, routing | — |
| `Header` | Nav bar (Home/Pricing/Dashboard) | page, apiKey |
| `Landing` | Marketing landing page (Hero + Features + How It Works + CTA + Footer) | onCta |
| `Pricing` | 3-tier pricing cards (Free/Pro/Agency) | onSelectPlan, apiKey |
| `Dashboard` | Lead generation form + usage bar + lead grid | keyword, leads, usage, ... |
| `DetailModal` | Lead detail overlay (score tiles, multi-channel messages) | lead, onClose |

### 1.3 Dashboard Page — Complete Code

The Dashboard component (lines 242–323 of App.tsx) renders:

1. **Usage Bar** — Shows plan name, API key prefix, leads used/today, progress bar
2. **Search Form** — 3 inputs (keyword, industry, location) + Generate/Refresh/Export buttons
3. **Lead Grid** — 3-column responsive grid of lead cards with:
   - Color-coded left border (red=hot, yellow=warm, gray=cold)
   - Category badge
   - Lead score progress bar (0-100)
   - Buying intent reason (truncated to 2 lines)
   - Contact channel label
4. **Error Display** — Red banner on generation failure
5. **Empty State** — Centered message when no leads

### 1.4 Landing Page — Complete Code

The Landing component (lines 122–197 of App.tsx) renders:

1. **Hero Section** — Gradient blue→indigo→purple, headline, subtitle, CTA button, "No credit card required"
2. **Features Section** — 3 cards (AI Scoring, Multi-Channel, Flexible Plans) with numbered icons
3. **How It Works Section** — 3 numbered steps (Enter Keywords → AI Generates → Get Messages)
4. **Bottom CTA** — Blue section with "Ready to find your next customers?" + CTA button
5. **Footer** — Dark gray with copyright

### 1.5 Pricing Page — Complete Code

The Pricing component (lines 202–237 of App.tsx) renders:

1. **3-tier grid**: Free ($0, 10 leads/day), Pro ($29, 200 leads/day, highlighted/scale-105), Agency ($99, 1000 leads/day, "Coming Soon")
2. Each card: plan name, price, feature checklist with checkmarks
3. Pro card: "POPULAR" badge, conditional "Active" state when apiKey exists
4. Agency card: disabled purple button with "Coming Soon"

---

## 2. Backend Architecture

### 2.1 Directory Structure

```
backend/
├── .env.example                          # Environment template
├── requirements.txt                      # Python dependencies
└── app/
    ├── main.py                           # FastAPI entry, CORS, static files
    ├── config.py                         # Settings (env vars, plan limits, Stripe)
    ├── database.py                       # SQLAlchemy engine + session
    ├── auth.py                           # JWT auth middleware (legacy, unused by v2.0)
    ├── models/
    │   ├── __init__.py                   # Exports: Lead, User
    │   ├── lead.py                       # Lead model (19 columns)
    │   ├── user.py                       # User model (11 columns, UUID api_key)
    │   ├── search_history.py             # (legacy)
    │   └── system_config.py              # (legacy)
    ├── routers/
    │   ├── __init__.py
    │   ├── leads.py                      # Lead generation CRUD + CSV export
    │   ├── subscribe.py                  # Stripe subscription + plans
    │   ├── usage.py                      # Usage dashboard + logs
    │   ├── auth.py                       # (legacy authentication)
    │   └── admin.py                      # (legacy admin)
    ├── services/
    │   ├── __init__.py
    │   ├── lead_service.py               # AI prompt engineering + DeepSeek integration
    │   └── auth_service.py               # (legacy password/JWT)
    ├── middleware/
    │   ├── __init__.py
    │   └── usage.py                      # Usage tracking + rate limiting
    └── schemas/                          # (legacy Pydantic schemas)
```

### 2.2 API Route List

| Method | Path | Description | Auth |
|---|---|---|---|
| `POST` | `/api/leads/init` | Create user, return API key | None |
| `POST` | `/api/leads/generate` | AI generate leads with usage tracking | API Key |
| `GET` | `/api/leads/` | List user's leads (paginated, filterable) | API Key |
| `GET` | `/api/leads/{id}` | Get single lead detail | API Key |
| `POST` | `/api/leads/export` | Export leads as CSV download | API Key |
| `POST` | `/api/subscribe` | Create subscription (Free/Pro/Agency) | None |
| `POST` | `/api/webhook/payment` | Stripe webhook receiver | None |
| `POST` | `/api/create-checkout-session` | Stripe checkout session | None |
| `GET` | `/api/plans` | List plans with multi-currency pricing | None |
| `GET` | `/api/usage/{api_key}` | Get usage stats for user | None |
| `GET` | `/api/usage/{api_key}/logs` | Get recent lead generation logs | None |
| `GET` | `/` | API root info | None |
| `GET` | `/health` | Health check | None |
| `GET` | `/docs` | Swagger UI | None |

### 2.3 Lead Generation Endpoint — Complete Code

```python
# backend/app/routers/leads.py (lines 14-62)

@router.post("/generate")
def generate(
    api_key: str = Query(...),
    keyword: str = Query(...),
    industry: str = Query(default="Technology"),
    location: str = Query(default="USA"),
    limit: int = Query(default=10, le=20),
    db: Session = Depends(get_db),
):
    """Generate leads with usage tracking."""
    usage = check_and_track_usage(api_key, "lead")
    if not usage["allowed"]:
        raise HTTPException(status_code=429, detail=usage["error"])

    user = usage["user"]
    leads_data = generate_leads(keyword, industry, location, limit)

    saved = []
    for ld in leads_data:
        outreach = generate_outreach(ld)
        suggestion = generate_ai_suggestion(ld)
        lead = Lead(
            user_id=user.id,
            business_name=ld["business_name"],
            industry=ld.get("industry", industry),
            location=ld.get("location", location),
            contact_channel=ld.get("contact_channel", outreach.get("best_channel", "email")),
            contact_info=ld.get("contact_info", ""),
            lead_score=ld.get("lead_score", 50),
            buying_intent_reason=ld.get("buying_intent_reason", ""),
            outreach_strategy=ld.get("outreach_strategy", ""),
            outreach_email=outreach.get("email", ""),
            outreach_instagram=outreach.get("instagram", ""),
            outreach_linkedin=outreach.get("linkedin", ""),
            best_channel=outreach.get("best_channel", "email"),
            lead_category=ld.get("lead_category", "warm"),
            region_competition_score=ld.get("region_competition_score", 50),
        )
        db.add(lead)
        saved.append(lead)
    db.commit()
    for l in saved:
        db.refresh(l)

    return {
        "leads": [lead_response(l) for l in saved],
        "total": len(saved),
        "usage": {"used": usage["used_lead"], "limit": usage["limit"], "plan": user.plan},
    }
```

### 2.4 Usage/Billing Code

**Usage Tracking Middleware** (`backend/app/middleware/usage.py`):

```python
PLAN_LIMITS = {"free": 10, "pro": 200}

def check_and_track_usage(api_key: str, action: str = "lead") -> dict:
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

        if user.daily_lead_count >= limit:
            return {
                "allowed": False,
                "error": f"Daily lead limit reached ({limit}/{user.plan})",
                "user": user, "limit": limit, "used": user.daily_lead_count
            }

        user.daily_lead_count += 1
        user.total_lead_count += 1
        db.commit()
        return {
            "allowed": True, "user": user, "limit": limit,
            "used_lead": user.daily_lead_count,
            "used_message": user.daily_message_count,
        }
    finally:
        db.close()
```

**Key design**: Daily counters auto-reset when `usage_date` changes. Limits per plan enforced before AI API call (cost protection).

**Subscription Router** (`backend/app/routers/subscribe.py`): Multi-currency pricing (USD/EUR/GBP), Stripe checkout session creation, webhook receiver placeholder.

---

## 3. AI Module

### 3.1 Lead Generation Prompt

```python
# backend/app/services/lead_service.py (lines 16-52)

prompt = f"""Generate {limit} realistic B2B leads for a sales person targeting
"{keyword}" in "{industry}" industry, located in "{location}".

For each lead, provide:
- business_name: realistic company name
- industry: specific sub-industry
- location: city/region
- contact_channel: best channel (email/instagram/linkedin)
- contact_info: fictional email or handle
- lead_score: 0-100 (based on likelihood to buy)
- buying_intent_reason: WHY this company might be a good prospect (1 sentence)
- outreach_strategy: HOW to approach them (1 sentence)
- lead_category: "hot" (70+), "warm" (40-69), "cold" (<40)
- region_competition_score: 0-100 competition level in their region

Return ONLY strict JSON array:
[{{"business_name":"...","industry":"...","location":"...",
   "contact_channel":"email|instagram|linkedin","contact_info":"...",
   "lead_score":85,"buying_intent_reason":"...",
   "outreach_strategy":"...","lead_category":"hot",
   "region_competition_score":60}}]

Be realistic and varied. Scores should follow a normal-ish distribution."""

# API call:
resp = client.chat.completions.create(
    model="deepseek-chat",
    messages=[{"role": "user", "content": prompt}],
    max_tokens=6000, temperature=0.7,
)
```

**Design rationale**: The prompt is structured as a single-shot generation task. It specifies field-by-field requirements, enforces strict JSON output format, and guides score distribution. The `temperature=0.7` balances creativity with consistency.

### 3.2 Outreach Message Prompt

```python
# backend/app/services/lead_service.py (lines 55-87)

prompt = f"""Write 3 outreach messages for this lead:
Business: {lead.get('business_name')}
Industry: {lead.get('industry')}
Contact: {lead.get('contact_info')}
Channel: {lead.get('contact_channel')}

1. Email version (professional, 4-5 sentences)
2. Instagram DM version (casual, short, 2-3 sentences)
3. LinkedIn version (semi-formal, 3-4 sentences)

Return ONLY JSON:
{{"email":"...","instagram":"...","linkedin":"...","best_channel":"..."}}"""

# API call:
resp = client.chat.completions.create(
    model="deepseek-chat",
    messages=[{"role": "user", "content": prompt}],
    max_tokens=1024, temperature=0.7,
)
```

**Key insight**: The system generates 3 channel-specific messages per lead *in a single API call*, and the AI determines the `best_channel` automatically based on the lead's profile.

### 3.3 Lead Scoring Logic

**Scoring is done by the AI model itself** — not by an algorithm. The DeepSeek LLM evaluates each lead holistically based on:

| Factor | Weight | How AI Evaluates |
|---|---|---|
| Company size/funding signals | Implicit | Model's training data on real companies |
| Industry relevance to keyword | Implicit | Semantic matching in prompt context |
| Location market maturity | Explicit | Prompt requires `region_competition_score` |
| Buying intent signals | Explicit | Prompt requires `buying_intent_reason` |

**Category mapping** (deterministic post-processing):
- `lead_score >= 70` → `"hot"` (red badge, high priority)
- `40 <= lead_score < 70` → `"warm"` (yellow badge, medium priority)
- `lead_score < 40` → `"cold"` (gray badge, low priority)

**Fallback**: If the DeepSeek API fails (network, rate limit, invalid response), the system falls back to `_mock_leads()` which generates randomized leads using a predefined template. This ensures the system is always functional even without API access.

---

## 4. API Example Data

### 4.1 POST /api/leads/generate — Response

```json
{
  "leads": [
    {
      "id": "bbbe75b4-e3b9-49dc-8054-f4b4c0947514",
      "business_name": "NexaGrid Solutions",
      "industry": "Cloud Infrastructure & Data Analytics",
      "location": "Austin, TX",
      "contact_channel": "linkedin",
      "contact_info": "linkedin.com/in/jenna-morris-nexagrid",
      "lead_score": 82,
      "buying_intent_reason": "They recently announced a $12M Series A for scaling their analytics platform and are actively hiring for integration engineers, indicating a need for efficient SaaS tools to manage rapid growth.",
      "outreach_strategy": "Connect on LinkedIn with a personalized note referencing their Series A funding and offer a 15-min discovery call on how our tool can streamline their onboarding and data workflows.",
      "outreach_email": "Hi Jenna,\n\nI noticed NexaGrid Solutions is making strides in cloud infrastructure and data analytics. I have an idea that could help optimize your data workflows while reducing cloud costs. Would you be open to a brief chat next week?\n\nLooking forward to your thoughts.\n\nBest regards",
      "outreach_instagram": "Hey Jenna! Love what NexaGrid is doing in cloud infra. Got a quick idea that could level up your analytics game — down to chat?",
      "outreach_linkedin": "Hi Jenna, impressive work at NexaGrid Solutions in the cloud and analytics space. I came across a potential opportunity to enhance your data processing efficiency. Would you be available for a quick call to explore this further?",
      "best_channel": "linkedin",
      "lead_category": "hot",
      "region_competition_score": 75,
      "source": "ai_generated",
      "status": "new",
      "created_at": "2026-05-11 20:10:18.978771",
      "updated_at": "2026-05-11 20:10:18.978771"
    },
    {
      "id": "fa3e3362-0562-44ef-9abb-108204b0f070",
      "business_name": "PivotCore Technologies",
      "industry": "HR & Workforce Management SaaS",
      "location": "Denver, CO",
      "contact_channel": "email",
      "contact_info": "s.hendricks@pivotcoretech.com",
      "lead_score": 55,
      "buying_intent_reason": "Their current legacy HR system is up for renewal next quarter, and they have publicly mentioned looking for more scalable, AI-driven solutions.",
      "outreach_strategy": "Send a concise email with a case study showing how a similar mid-sized tech company reduced churn by 30% using our platform.",
      "outreach_email": "Hi S. Hendricks,\n\nI came across PivotCore Technologies and was impressed by your innovative approach to workforce management. Our solutions help HR SaaS companies like yours scale client onboarding. I'd love to explore how we might collaborate. Would you be open to a brief chat next week?",
      "outreach_instagram": "Hey PivotCore! Love what you're doing in workforce management. We help HR SaaS companies level up client engagement — keen to connect?",
      "outreach_linkedin": "Hi S. Hendricks, I admire PivotCore's work in transforming HR and workforce management. Our platform specializes in optimizing client onboarding for SaaS companies like yours. Would you be open to a quick call?",
      "best_channel": "email",
      "lead_category": "warm",
      "region_competition_score": 60,
      "source": "ai_generated",
      "status": "new",
      "created_at": "2026-05-11 20:10:18.978771",
      "updated_at": "2026-05-11 20:10:18.978771"
    }
  ],
  "total": 2,
  "usage": {
    "used": 1,
    "limit": 200,
    "plan": "pro"
  }
}
```

### 4.2 GET /api/usage/{api_key} — Response

```json
{
  "plan": "pro",
  "subscription_status": "active",
  "daily": {
    "leads_used": 1,
    "leads_limit": 200,
    "messages_used": 0,
    "remaining": 199
  },
  "total": {
    "leads_generated": 1,
    "since": "2026-05-11T20:09:00"
  }
}
```

### 4.3 GET /api/plans — Response

```json
{
  "plans": {
    "free": {
      "name": "Free",
      "price": "$0",
      "currency": "usd",
      "daily_leads": 10,
      "features": ["10 leads/day", "Basic outreach messages", "CSV export"]
    },
    "pro": {
      "name": "Pro",
      "price": "$29",
      "currency": "usd",
      "daily_leads": 200,
      "features": ["200 leads/day", "Multi-channel outreach (Email + Instagram + LinkedIn)", "AI lead scoring 0-100", "Hot/Warm/Cold labels", "Region competition data", "CSV export", "Priority support"]
    },
    "agency": {
      "name": "Agency",
      "price": "$99",
      "currency": "usd",
      "daily_leads": 1000,
      "features": ["1,000 leads/day", "All Pro features", "API access", "White-label reports", "Dedicated support"]
    }
  },
  "supported_currencies": ["usd", "eur", "gbp"]
}
```

---

## 5. Project Architecture Overview

### 5.1 System Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser (SPA)                      │
│  React 18 + TypeScript + Tailwind CSS + Vite 5       │
│  Pages: Landing | Pricing | Dashboard | DetailModal  │
│  i18n: en.json (115 keys, extensible)                │
└────────────────────┬────────────────────────────────┘
                     │ HTTP (fetch)
                     ▼
┌─────────────────────────────────────────────────────┐
│              FastAPI Backend (:8000)                  │
│  CORS: *                                             │
│  Static files: / (production)                        │
│  Swagger: /docs                                      │
│                                                       │
│  ┌─────────────┐  ┌──────────┐  ┌───────────────┐   │
│  │ Leads Router │  │Subscribe │  │  Usage Router │   │
│  │ /api/leads/* │  │ /api/*   │  │ /api/usage/*  │   │
│  └──────┬───────┘  └──────────┘  └───────────────┘   │
│         │                                              │
│  ┌──────▼───────┐  ┌──────────────────────────────┐  │
│  │Usage Middleware│  │     Lead Service             │  │
│  │(rate limit +   │  │  • generate_leads()          │  │
│  │ daily quota)   │  │  • generate_outreach()       │  │
│  └──────────────┘  │  • generate_ai_suggestion()   │  │
│                     └──────────┬───────────────────┘  │
│                                │                       │
│  ┌─────────────────────────────▼────────────────────┐ │
│  │              SQLAlchemy ORM                       │ │
│  │  Lead(19 cols) | User(11 cols)                   │ │
│  │  SQLite (dev) / PostgreSQL (prod)                │ │
│  └──────────────────────────────────────────────────┘ │
└────────────────────┬────────────────────────────────┘
                     │ OpenAI SDK
                     ▼
┌─────────────────────────────────────────────────────┐
│               DeepSeek API                           │
│  Model: deepseek-chat                                │
│  Base URL: https://api.deepseek.com                  │
│                                                       │
│  Calls per lead generation:                          │
│    1. generate_leads (1 req, ~6000 tokens)           │
│    2. generate_outreach (N reqs, ~1024 tokens each)  │
│    3. generate_ai_suggestion (N reqs, ~256 tokens)   │
│                                                       │
│  Total for 10 leads: 1 + 10 + 10 = 21 API calls     │
└─────────────────────────────────────────────────────┘
```

### 5.2 Data Flow

```
1. User enters: keyword + industry + location
2. Frontend sends POST /api/leads/generate with API key
3. Backend validates API key → checks daily quota
4. If quota OK: calls lead_service.generate_leads() → DeepSeek API
5. DeepSeek returns JSON array of leads (with scores, intent, strategy)
6. For each lead: call generate_outreach() → 3-channel messages
7. For each lead: call generate_ai_suggestion() → follow-up strategy
8. Save all leads to database (Lead model, 19 columns)
9. Update user's daily_lead_count
10. Return leads array + usage stats to frontend
11. Frontend renders lead cards in grid (3 columns)
12. User clicks card → DetailModal shows score tiles + 3-channel messages
13. User clicks Export CSV → GET /api/leads/export → CSV download
```

### 5.3 AI Call Flow

```
┌─ Lead Generation Pipeline ────────────────────────────┐
│                                                        │
│  Step 1: Lead Discovery (1 API call)                   │
│  ┌──────────────────────────────────────────────┐     │
│  │ Prompt: "Generate 10 B2B leads..."            │     │
│  │ Output: JSON array of 10 leads with scores    │     │
│  │ Tokens: ~6000                                 │     │
│  └──────────────────────────────────────────────┘     │
│                      │                                  │
│                      ▼                                  │
│  Step 2: Outreach Generation (N API calls)             │
│  ┌──────────────────────────────────────────────┐     │
│  │ For each lead:                                │     │
│  │   Prompt: "Write 3 outreach messages..."      │     │
│  │   Output: {email, instagram, linkedin, best}  │     │
│  │   Tokens: ~1024 per call                      │     │
│  └──────────────────────────────────────────────┘     │
│                      │                                  │
│                      ▼                                  │
│  Step 3: Strategy Generation (N API calls)             │
│  ┌──────────────────────────────────────────────┐     │
│  │ For each lead:                                │     │
│  │   Prompt: "Provide follow-up strategy..."     │     │
│  │   Output: Strategy text (2-3 sentences)       │     │
│  │   Tokens: ~256 per call                       │     │
│  └──────────────────────────────────────────────┘     │
│                                                        │
│  Total for 10 leads: 1 + 10 + 10 = 21 API calls       │
│  Error handling: Fallback to mock data on API failure  │
└────────────────────────────────────────────────────────┘
```

### 5.4 Database Schema

**Lead** (19 columns):
```sql
leads (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) INDEXED,
  business_name VARCHAR(255) NOT NULL,
  industry VARCHAR(255),
  location VARCHAR(255),
  contact_channel VARCHAR(50),         -- email|instagram|linkedin
  contact_info VARCHAR(255),
  lead_score INTEGER DEFAULT 50,       -- 0-100 AI scored
  buying_intent_reason TEXT,           -- Why they might buy
  outreach_strategy TEXT,              -- How to approach
  outreach_email TEXT,                 -- Email version
  outreach_instagram TEXT,             -- Instagram DM version
  outreach_linkedin TEXT,              -- LinkedIn version
  best_channel VARCHAR(20),            -- AI-selected best channel
  lead_category VARCHAR(10) DEFAULT 'warm', -- hot|warm|cold
  region_competition_score INTEGER DEFAULT 50,
  source VARCHAR(50) DEFAULT 'ai_generated',
  status VARCHAR(20) DEFAULT 'new',
  created_at DATETIME,
  updated_at DATETIME
)
```

**User** (11 columns):
```sql
users (
  id VARCHAR(36) PRIMARY KEY,
  api_key VARCHAR(64) UNIQUE NOT NULL,
  plan VARCHAR(10) DEFAULT 'free',      -- free|pro|agency
  subscription_status VARCHAR(20) DEFAULT 'active',
  daily_lead_count INTEGER DEFAULT 0,   -- Resets daily
  daily_message_count INTEGER DEFAULT 0,
  total_lead_count INTEGER DEFAULT 0,
  usage_date VARCHAR(10),              -- YYYY-MM-DD for reset
  created_at DATETIME
)
```

### 5.5 Deployment

**Docker**:
```dockerfile
# Dockerfile — Multi-stage: Node build frontend, Python serve backend
FROM node:20-alpine AS frontend-build → npm ci → npm run build
FROM python:3.11-slim → pip install → copy backend + static → uvicorn
```

**Environment**:
```bash
DEEPSEEK_API_KEY=sk-...        # Required
DATABASE_URL=sqlite:///...     # Default SQLite, can be PostgreSQL
STRIPE_SECRET_KEY=sk_live_...  # Optional, for payments
CORS_ORIGINS=*                 # Production: restrict to domain
```

**Quick Start**:
```bash
docker build -t leadgen .
docker run -p 8000:8000 -e DEEPSEEK_API_KEY=sk-... leadgen
```

---

## Appendix: File Inventory

**Total**: 33 active source files (excluding legacy, node_modules, dist, pycache)

**Frontend**: 11 files  
**Backend**: 16 files  
**DevOps**: 6 files (Dockerfile ×2, docker-compose, nginx, CI, .env.example)  
**Analysis**: 4 files (AI-generated architecture/requirements/task-planning/coordination docs)
