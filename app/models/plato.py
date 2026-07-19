from __future__ import annotations
from typing import TYPE_CHECKING
from decimal import Decimal

from pydantic import field_validator
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.categoria import Categoria
    from app.models.pedido import DetallePedido
    from app.models.restaurante import Restaurante

class Plato(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True, index=True)
    nombre: str = Field(max_length=120)
    precio: Decimal = Field(default=0, max_digits=5, decimal_places=2)
    tamano: str = Field(default="Normal", max_length=50)
    descripcion: str | None = Field(default=None, max_length=150)
    img_url: str | None = Field(default=None)

    categoria_id: int | None = Field(default=None, foreign_key="categoria.id")

    categoria: Categoria | None = Relationship(back_populates="platos")
    detalles_pedido: list[DetallePedido] = Relationship(back_populates="plato")
    restaurante: Restaurante | None = Relationship(back_populates="platos")

class PlatoBase(SQLModel):
    nombre: str = Field(max_length=120)
    precio: Decimal = Field(default=0, max_digits=5, decimal_places=2)
    tamano: str = Field(default="Normal", max_length=50)
    descripcion: str | None = Field(default=None, max_length=150)
    img_url: str | None = Field(default=None)
    categoria_id: int | None = Field(default=None)

class PlatoCreate(PlatoBase):
    @field_validator("tamano")
    @classmethod
    def restringir_tamano(cls, value: str) -> str:
        tamanos = ["Pequeño", "Normal", "Grande"]
        value_sanitado = value.capitalize() if value.strip() else ""

        if value_sanitado not in tamanos:
            raise ValueError(f"Tamaño no valido: '{value_sanitado}'")

        return value_sanitado

class PlatoRead(PlatoBase):
    id: int
