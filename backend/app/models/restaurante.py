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
    from app.models.factura import Factura

class RestauranteBase(SQLModel):
    nombre: str = Field(nullable=False, max_length=100)
    ruc: str | None = Field(default=None, unique=True, max_length=13, index=True)
    logo_url: str | None = Field(default=None)
    direccion: str | None = Field(default=None, max_length=250)
    telefono: str | None = Field(default=None, max_length=10)

class Restaurante(RestauranteBase, table=True):
    id: int | None = Field(default=None, primary_key=True, index=True)
    activo: bool = Field(default=True, nullable=False)

    fecha_registro: datetime = Field(default_factory=lambda: datetime.now(UTC), nullable=False)

    usuarios: list["Usuario"] = Relationship(back_populates="restaurante")
    mesas: list["Mesa"] = Relationship(back_populates="restaurante")
    platos: list["Plato"] = Relationship(back_populates="restaurante")
    categorias: list["Categoria"] = Relationship(back_populates="restaurante")
    pedidos: list["Pedido"] = Relationship(back_populates="restaurante")
    facturas: list["Factura"] = Relationship(back_populates="restaurante")

class RestauranteCreate(RestauranteBase):
    @field_validator("ruc")
    @classmethod
    def validar_digits_ruc(cls, value: str) -> str | None:
        if value is not None:
            if not value.isdigit():
                raise ValueError(f"Error: El RUC contiene letras")
        return value

    @field_validator("telefono")
    @classmethod
    def validar_digits_telefono(cls, value: str) -> str | None:
        if value is not None:
            if not value.isdigit():
                raise ValueError(f"Error: El telefono contiene letras")
        return value

class RestauranteUpdate(SQLModel):
    nombre: str | None = Field(default=None, max_length=100)
    ruc: str | None = Field(default=None, max_length=13)
    logo_url: str | None = None
    direccion: str | None = Field(default=None, max_length=250)
    telefono: str | None = Field(default=None, max_length=10)

    @field_validator("ruc")
    @classmethod
    def validar_digits_ruc(cls, value: str) -> str | None:
        if value is not None:
            if not value.isdigit():
                raise ValueError(f"Error: El RUC contiene letras")
        return value

    @field_validator("telefono")
    @classmethod
    def validar_digits_telefono(cls, value: str) -> str | None:
        if value is not None:
            if not value.isdigit():
                raise ValueError(f"Error: El telefono contiene letras")
        return value

class RestauranteRead(RestauranteBase):
    id: int
    fecha_registro: datetime

from app.models.usuario import Usuario
from app.models.mesa import Mesa
from app.models.plato import Plato
from app.models.categoria import Categoria
from app.models.pedido import Pedido
from app.models.factura import Factura
Restaurante.model_rebuild()