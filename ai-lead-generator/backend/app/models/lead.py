import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, Float, DateTime
from app.database import Base


class Lead(Base):
    __tablename__ = "leads"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=True, index=True)
    business_name = Column(String(255), nullable=False)
    industry = Column(String(255), nullable=True)
    location = Column(String(255), nullable=True)
    contact_channel = Column(String(50), nullable=True)  # email | instagram | linkedin
    contact_info = Column(String(255), nullable=True)
    lead_score = Column(Integer, default=50)  # 0-100
    buying_intent_reason = Column(Text, nullable=True)
    outreach_strategy = Column(Text, nullable=True)
    outreach_email = Column(Text, nullable=True)
    outreach_instagram = Column(Text, nullable=True)
    outreach_linkedin = Column(Text, nullable=True)
    best_channel = Column(String(20), nullable=True)
    lead_category = Column(String(10), default="warm")  # hot | warm | cold
    region_competition_score = Column(Integer, default=50)
    source = Column(String(50), default="ai_generated")
    status = Column(String(20), default="new")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Lead {self.business_name}>"
