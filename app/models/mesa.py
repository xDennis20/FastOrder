from __future__ import annotations
from typing import TYPE_CHECKING
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from app.models.pedido import Pedido
    from app.models.restaurante import Restaurante

class Mesa(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True, index=True)
    numero_mesa: str = Field(nullable=False, unique=True)
    estado: str = Field(default="Disponible", max_length=50)

    mesa_principal_id: int | None = Field(default=None, foreign_key="mesa.id",nullable=True)

    mesa_principal: Mesa | None = Relationship(
        back_populates="mesas_unidas",
        sa_relationship_kwargs={"remote_side", "Mesa.id"}
    )

    mesa_unidas: list[Mesa] = Relationship(back_populates="mesa_principal")
    pedidos: list[Pedido] = Relationship(back_populates="mesa")
    restaurante: Restaurante | None = Relationship(back_populates="mesas")