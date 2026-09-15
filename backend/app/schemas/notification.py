from datetime import datetime
from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    procedure_id: int
    kind: str
    message: str
    is_read: bool
    created_at: datetime


class NotificationList(BaseModel):
    items: list[NotificationResponse]
    unread_count: int
