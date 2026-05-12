import os


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./leadgen.db")
    DEEPSEEK_API_KEY: str = os.getenv("DEEPSEEK_API_KEY", "")
    DEEPSEEK_BASE_URL: str = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
    DEFAULT_SEARCH_LIMIT: int = int(os.getenv("DEFAULT_SEARCH_LIMIT", "20"))
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "*")
    APP_ENV: str = os.getenv("APP_ENV", "development")
    APP_NAME: str = os.getenv("APP_NAME", "AI Lead Generator")
    APP_VERSION: str = os.getenv("APP_VERSION", "2.0.0")
    STRIPE_SECRET_KEY: str = os.getenv("STRIPE_SECRET_KEY", "")
    STRIPE_WEBHOOK_SECRET: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    PLAN_LIMITS: dict = {"free": 10, "pro": 200, "agency": 1000}
    PLAN_PRICES: dict = {
        "free": {"usd": 0, "eur": 0, "gbp": 0},
        "pro": {"usd": 29, "eur": 25, "gbp": 22},
        "agency": {"usd": 99, "eur": 85, "gbp": 79},
    }


settings = Settings()
