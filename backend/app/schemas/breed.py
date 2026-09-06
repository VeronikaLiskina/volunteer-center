from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class BreedResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    animal_type_id: int
    name: str
    min_weight: Decimal | None
    max_weight: Decimal | None
