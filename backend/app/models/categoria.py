from typing import TYPE_CHECKING, Optional
from pydantic import field_validator
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from app.models.plato import PlatoRead
    from app.models.restaurante import Restaurante
    from app.models.plato import Plato

class CategoriaBase(SQLModel):
    nombre: str = Field(nullable=False, max_length=50)
    activo: bool = Field(default=True, nullable=False)

class Categoria(CategoriaBase, table=True):
    id: int | None = Field(default=None, primary_key=True, index=True)
    restaurante_id: int = Field(nullable=False, foreign_key="restaurante.id")

    platos: list["Plato"] = Relationship(back_populates="categoria")
    restaurante: Optional["Restaurante"] = Relationship(back_populates="categorias")

class CategoriaCreate(SQLModel):
    nombre: str = Field(nullable=False, max_length=50)
    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, value: str):
        nombre_sanitizado = value.strip()
        if not nombre_sanitizado:
            raise ValueError("Nombre no puede estar vacio ni contener solo espacios")
        return nombre_sanitizado

class CategoriaRead(CategoriaBase):
    id: int
    restaurante_id: int

class CategoriaUpdate(SQLModel):
    nombre: str | None = None
    activo: bool | None = None

    @field_validator("nombre")
    @classmethod
    def validar_nombre_opcional(cls, value: str | None):
        if value is not None:
            nombre_sanitizado = value.strip()
            if not nombre_sanitizado:
                raise ValueError("El nombre no puede estar vacío ni contener solo espacios")
            return nombre_sanitizado
        return value

class CategoriaWithPlatos(CategoriaRead):
    platos: list["PlatoRead"]

from app.models.plato import PlatoRead
from app.models.restaurante import Restaurante
from app.models.plato import Plato
Categoria.model_rebuild()
CategoriaWithPlatos.model_rebuild()