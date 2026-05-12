
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey

from app.database import Base

class SearchHistory(Base):
    __tablename__ = "search_history"

    id = Column(String(36), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    keyword = Column(String(200), nullable=False)
    result_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    def __repr__(self):
        return f"<SearchHistory {self.keyword}>"