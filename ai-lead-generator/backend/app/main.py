"""AI Sales Intelligence v2.1 — Commercial Growth Edition."""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.database import Base, engine
from app.routers import leads, subscribe, usage, experiment

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Sales Intelligence",
    version="2.1.0",
    docs_url="/docs",
    description="AI-powered B2B lead discovery and customer acquisition platform.",
)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

app.include_router(leads.router, prefix="/api/leads", tags=["Leads"])
app.include_router(subscribe.router, prefix="/api", tags=["Subscription"])
app.include_router(usage.router, prefix="/api/usage", tags=["Usage"])
app.include_router(experiment.router, prefix="/api/experiment", tags=["Experiment"])

static_dir = os.path.join(os.path.dirname(__file__), "..", "..", "static")
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")


@app.get("/")
async def root():
    return {"app": "AI Sales Intelligence", "version": "2.1.0", "plans": settings.PLAN_LIMITS}


@app.get("/health")
async def health():
    return {"status": "healthy"}
