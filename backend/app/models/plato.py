from enum import Enum
from typing import TYPE_CHECKING, Optional
from decimal import Decimal
from pydantic import field_validator
from sqlalchemy import UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.categoria import Categoria
    from app.models.pedido import DetallePedido
    from app.models.restaurante import Restaurante

class TamanoPlato(str, Enum):
    PEQUENO = "Pequeño"
    NORMAL = "Normal"
    GRANDE = "Grande"

class PlatoBase(SQLModel):
    nombre: str = Field(max_length=120)
    precio: Decimal = Field(default=0, max_digits=5, decimal_places=2, ge=0)
    tamano: TamanoPlato = Field(default=TamanoPlato.NORMAL, max_length=50)
    activo: bool = Field(default=True, nullable= False)
    descripcion: str | None = Field(default=None, max_length=150)
    img_url: str | None = Field(default=None)
    categoria_id: int

class Plato(PlatoBase, table=True):
    __tablename__ = "plato"

    __table_args__ = (
        UniqueConstraint(
            "restaurante_id",
            "nombre",
            "tamano",
            name="uq_plato_restaurante_nombre_tamano"
        ),
    )

    id: int | None = Field(default=None, primary_key=True, index=True)
    restaurante_id: int  = Field(nullable=False, foreign_key="restaurante.id")
    categoria_id: int = Field(nullable=False, foreign_key="categoria.id")

    categoria: Optional["Categoria"] = Relationship(back_populates="platos")
    detalles_pedido: list["DetallePedido"] = Relationship(back_populates="plato")
    restaurante: Optional["Restaurante"] = Relationship(back_populates="platos")

class PlatoCreate(PlatoBase):
    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, value: str):
        nombre_sanitizado = value.strip()
        if not nombre_sanitizado:
            raise ValueError("Nombre no puede estar vacio ni contener solo espacios")
        return nombre_sanitizado

class PlatoUpdate(SQLModel):
    nombre: str | None = Field(default=None, max_length=120)
    precio: Decimal | None = Field(default=None, max_digits=5, decimal_places=2, ge=0)
    tamano: TamanoPlato | None = None
    activo: bool | None = None
    descripcion: str | None = Field(default=None, max_length=150)
    img_url: str | None = Field(default=None)
    categoria_id: int | None = None

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, value: str):
        nombre_sanitizado = value.strip()
        if not nombre_sanitizado:
            raise ValueError("Nombre no puede estar vacio ni contener solo espacios")
        return nombre_sanitizado

class PlatoRead(PlatoBase):
    id: int
    restaurante_id: int

from app.models.categoria import Categoria
from app.models.pedido import DetallePedido
from app.models.restaurante import Restaurante
Plato.model_rebuild()