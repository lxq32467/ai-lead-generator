
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey

from app.database import Base

class SystemConfig(Base):
    __tablename__ = "system_config"

    id = Column(String(36), primary_key=True, default=uuid.uuid4)
    key = Column(String(255), unique=True, nullable=False)
    value = Column(Text, nullable=False)
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<SystemConfig {self.key}>"