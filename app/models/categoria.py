from __future__ import annotations
from typing import TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from app.models.plato import Plato
    from app.models.restaurante import Restaurante

class Categoria(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True, index=True)
    nombre: str = Field(nullable=False, max_length=50)

    platos: list[Plato] = Relationship(back_populates="categoria")
    restaurante: Restaurante | None = Relationship(back_populates="categorias")
