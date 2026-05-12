from pydantic import BaseModel
from typing import Any, Optional

class APIResponse(BaseModel):
    success: bool = True
    message: str = "Success"
    data: Optional[Any] = None

class Pagination(BaseModel):
    page: int
    limit: int
    total: int