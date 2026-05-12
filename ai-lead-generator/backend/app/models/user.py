import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    api_key = Column(String(64), unique=True, nullable=False, default=lambda: str(uuid.uuid4()).replace("-", ""))
    plan = Column(String(10), nullable=False, default="free")  # free | pro
    subscription_status = Column(String(20), default="active")  # active | cancelled | expired
    daily_lead_count = Column(Integer, default=0)
    daily_message_count = Column(Integer, default=0)
    total_lead_count = Column(Integer, default=0)
    usage_date = Column(String(10), default="")  # YYYY-MM-DD for daily reset
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    def __repr__(self):
        return f"<User {self.id} plan={self.plan}>"
