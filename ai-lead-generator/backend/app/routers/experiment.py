"""A/B Testing Router — Experiment variants for pricing and landing page optimization."""
from fastapi import APIRouter, Query
import hashlib
import time

router = APIRouter()

EXPERIMENTS = {
    "pricing_layout": {
        "variants": ["control", "value_focused", "social_proof"],
        "traffic_split": [0.34, 0.33, 0.33],
    },
    "cta_copy": {
        "variants": ["start_free_trial", "get_customers_now", "see_leads"],
        "traffic_split": [0.50, 0.30, 0.20],
    },
    "landing_hero": {
        "variants": ["revenue_focused", "growth_focused", "efficiency_focused"],
        "traffic_split": [0.34, 0.33, 0.33],
    },
}


def assign_variant(experiment_name: str, user_id: str) -> dict:
    """Deterministic variant assignment based on user_id hash."""
    exp = EXPERIMENTS.get(experiment_name)
    if not exp:
        return {"experiment": experiment_name, "variant": "control", "error": "Unknown experiment"}

    # Deterministic hash-based assignment
    hash_val = int(hashlib.md5(f"{experiment_name}:{user_id}".encode()).hexdigest(), 16)
    bucket = hash_val % 100

    cumulative = 0
    for i, split in enumerate(exp["traffic_split"]):
        cumulative += int(split * 100)
        if bucket < cumulative:
            return {"experiment": experiment_name, "variant": exp["variants"][i], "bucket": bucket}
    return {"experiment": experiment_name, "variant": exp["variants"][-1], "bucket": bucket}


def track_conversion(experiment_name: str, variant: str, user_id: str, event: str):
    """Track conversion event (in production, send to analytics)."""
    print(f"[ANALYTICS] experiment={experiment_name} variant={variant} user={user_id} event={event}")
    return {"tracked": True, "experiment": experiment_name, "variant": variant, "event": event}


@router.get("/variant")
def get_variant(experiment: str = Query(...), user_id: str = Query(...)):
    """Get the variant assigned to a user for a given experiment."""
    return assign_variant(experiment, user_id)


@router.post("/track")
def track_event(experiment: str = Query(...), variant: str = Query(...), user_id: str = Query(...), event: str = Query(...)):
    """Track a conversion event."""
    return track_conversion(experiment, variant, user_id, event)


@router.get("/experiments")
def list_experiments():
    return {"experiments": EXPERIMENTS}
