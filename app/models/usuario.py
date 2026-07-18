from __future__ import annotations
from typing import TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from app.models.rol import Rol
    from app.models.pedido import Pedido
    from app.models.restaurante import Restaurante

class Usuario(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True, index=True)
    nombres: str = Field(nullable=False)
    apellidos: str = Field(nullable=False)
    telefono: str = Field(nullable=False, unique=True, max_length=10, index=True)
    correo: str = Field(nullable=False, unique=True, max_length=200, index=True)

    rol_id: int | None = Field(default=None, foreign_key="rol.id")

    rol: Rol | None = Relationship(back_populates="usuarios")
    pedidos: list[Pedido] = Relationship(back_populates="mesero")
    restaurante: Restaurante | None = Relationship(back_populates="usuarios")