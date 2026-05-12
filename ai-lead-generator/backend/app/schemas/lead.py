from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class LeadSearchRequest(BaseModel):
    keyword: str = Field(..., min_length=1, max_length=200)
    limit: int = Field(default=10, ge=1, le=50)

class LeadResponse(BaseModel):
    id: str
    user_id: str
    company_name: str
    industry: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    source: str
    status: str
    ai_suggestion: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class LeadUpdateRequest(BaseModel):
    status: Optional[str] = Field(None, pattern="^(new|interested|contacted|invalid)$")

class LeadBatchStatusRequest(BaseModel):
    lead_ids: List[str] = Field(..., min_length=1)
    status: str = Field(..., pattern="^(new|interested|contacted|invalid)$")

class LeadExportResponse(BaseModel):
    csv_url: str