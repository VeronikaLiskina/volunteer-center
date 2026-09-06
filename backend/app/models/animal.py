from decimal import Decimal
from enum import StrEnum

from sqlalchemy import CheckConstraint, Enum, ForeignKey, ForeignKeyConstraint, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.animal_type import AnimalType
from app.models.breed import Breed


class AnimalStatus(StrEnum):
    IN_CARE = "in_care"
    ARCHIVED = "archived"


class Animal(Base):
    __tablename__ = "animals"
    __table_args__ = (
        CheckConstraint("weight > 0", name="ck_animals_weight"),
        CheckConstraint(
            "birth_year BETWEEN 1900 AND EXTRACT(YEAR FROM CURRENT_DATE)",
            name="ck_animals_birth_year",
        ),
        ForeignKeyConstraint(
            ["breed_id", "animal_type_id"], ["breeds.id", "breeds.animal_type_id"],
            name="fk_animals_breed_type",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50))
    animal_type_id: Mapped[int] = mapped_column(ForeignKey("animal_types.id"), index=True)
    breed_id: Mapped[int] = mapped_column(index=True)
    weight: Mapped[Decimal] = mapped_column(Numeric(6, 2))
    birth_year: Mapped[int]
    owner_name: Mapped[str | None] = mapped_column(String(100))
    owner_phone: Mapped[str | None] = mapped_column(String(12))
    note: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[AnimalStatus] = mapped_column(
        Enum(AnimalStatus, values_callable=lambda enum: [item.value for item in enum],
             name="animal_status", native_enum=False, create_constraint=True),
        default=AnimalStatus.IN_CARE, server_default=AnimalStatus.IN_CARE.value, index=True,
    )
    # Server-generated fingerprint, deliberately absent from public API schemas.
    duplicate_key: Mapped[str] = mapped_column(String(64), unique=True) #??

    animal_type: Mapped[AnimalType] = relationship(lazy="raise", viewonly=True)
    breed: Mapped[Breed] = relationship(lazy="raise", viewonly=True)
