from typing import TYPE_CHECKING, Optional
from pydantic import field_validator
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from app.models.plato import PlatoRead
    from app.models.restaurante import Restaurante
    from app.models.plato import Plato

class Categoria(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True, index=True)
    nombre: str = Field(nullable=False, max_length=50)

    restaurante_id: int | None = Field(default=None, foreign_key="restaurante.id")

    platos: list["Plato"] = Relationship(back_populates="categoria")
    restaurante: Optional["Restaurante"] = Relationship(back_populates="categorias")

class CategoriaBase(SQLModel):
    nombre: str = Field(nullable=False, max_length=50)
    restaurante_id: int | None = Field(default=None)

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
    platos: list["PlatoRead"]

from app.models.plato import PlatoRead
from app.models.restaurante import Restaurante
from app.models.plato import Plato
Categoria.model_rebuild()
CategoriaWithPlatos.model_rebuild()