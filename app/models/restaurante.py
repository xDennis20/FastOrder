from typing import TYPE_CHECKING
from datetime import datetime, UTC
from pydantic import field_validator
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from app.models.usuario import Usuario
    from app.models.mesa import Mesa
    from app.models.plato import Plato
    from app.models.categoria import Categoria
    from app.models.pedido import Pedido

class Restaurante(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True, index=True)
    nombre: str = Field(nullable=False, max_length=100)
    ruc: str = Field(nullable=False, unique=True, max_length=13, index=True)
    direccion: str | None = Field(default=None, max_length=250)
    telefono: str | None = Field(default=None, max_length=15)

    fecha_registro: datetime = Field(default_factory=lambda: datetime.now(UTC), nullable=False)

    usuarios: list["Usuario"] = Relationship(back_populates="restaurante")
    mesas: list["Mesa"] = Relationship(back_populates="restaurante")
    platos: list["Plato"] = Relationship(back_populates="restaurante")
    categorias: list["Categoria"] = Relationship(back_populates="restaurante")
    pedidos: list["Pedido"] = Relationship(back_populates="restaurante")

class RestauranteBase(SQLModel):
    nombre: str = Field(nullable=False, max_length=100)
    ruc: str = Field(nullable=False, unique=True, max_length=13, index=True)
    direccion: str | None = Field(default=None, max_length=250)
    telefono: str | None = Field(default=None, max_length=15)

class RestauranteCreate(RestauranteBase):
    @field_validator("ruc","telefono")
    @classmethod
    def validar_digits(cls, value: str) -> str:
        if not value.isdigit():
            raise ValueError(f"Error: El RUC contiene letras")
        return value

class RestauranteRead(RestauranteBase):
    id: int
    fecha_registro: datetime

from app.models.usuario import Usuario
from app.models.mesa import Mesa
from app.models.plato import Plato
from app.models.categoria import Categoria
from app.models.pedido import Pedido
Restaurante.model_rebuild()