# AI Lead Generator v2.0

AI-Powered Lead Generation SaaS — Global English Version.

## Quick Start

```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env  # Edit with your DeepSeek API key
uvicorn app.main:app --port 8000

# Frontend
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:5173

## Production

```bash
# Build frontend
cd frontend && npm run build

# Build with Docker
docker build -t leadgen .
docker run -p 8000:8000 -e DEEPSEEK_API_KEY=sk-... leadgen
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| DEEPSEEK_API_KEY | DeepSeek API key | (required) |
| DATABASE_URL | Database URL | sqlite:///./leadgen.db |
| STRIPE_SECRET_KEY | Stripe secret key | (optional) |
| CORS_ORIGINS | Allowed origins | * |
