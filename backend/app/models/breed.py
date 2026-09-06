from decimal import Decimal

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Breed(Base):
    __tablename__ = "breeds"
    __table_args__ = (
        UniqueConstraint("animal_type_id", "name", name="uq_breeds_type_name"),
        UniqueConstraint("id", "animal_type_id", name="uq_breeds_id_type"),
        CheckConstraint("min_weight IS NULL OR min_weight > 0", name="ck_breeds_min_weight"),
        CheckConstraint("max_weight IS NULL OR max_weight > 0", name="ck_breeds_max_weight"),
        CheckConstraint("min_weight <= max_weight", name="ck_breeds_weight_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    animal_type_id: Mapped[int] = mapped_column(ForeignKey("animal_types.id"))
    name: Mapped[str] = mapped_column(String(100))
    min_weight: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    max_weight: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
