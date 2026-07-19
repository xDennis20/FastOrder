from typing import TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from app.models.usuario import Usuario

class Rol(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True, index=True)
    nombre: str = Field(nullable=False)

    usuarios: list["Usuario"] = Relationship(back_populates="rol")

from app.models.usuario import Usuario
Rol.model_rebuild()