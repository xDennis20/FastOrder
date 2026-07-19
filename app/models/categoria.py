from __future__ import annotations
from typing import TYPE_CHECKING
from pydantic import field_validator
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from app.models.plato import Plato, PlatoRead
    from app.models.restaurante import Restaurante

class Categoria(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True, index=True)
    nombre: str = Field(nullable=False, max_length=50)

    platos: list[Plato] = Relationship(back_populates="categoria")
    restaurante: Restaurante | None = Relationship(back_populates="categorias")

class CategoriaBase(SQLModel):
    nombre: str = Field(nullable=False, max_length=50)

class CategoriaCreate(CategoriaBase):
    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, value: str):
        nombre_sanitado = value.capitalize() if value.strip() else ""
        if not nombre_sanitado:
            raise ValueError("Error: Nombre Vacio")
        return nombre_sanitado

class CategoriaRead(CategoriaBase):
    id: int

class CategoriaWithPlatos(CategoriaBase):
    id: int
    platos: list[PlatoRead]