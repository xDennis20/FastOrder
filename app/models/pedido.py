from __future__ import annotations
from typing import TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime, UTC

if TYPE_CHECKING:
    from app.models.usuario import Usuario
    from app.models.plato import Plato
    from app.models.factura import Factura
    from app.models.mesa import Mesa
    from app.models.restaurante import Restaurante

class Pedido(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True, index=True)
    estado: str = Field(default="Pendiente", nullable=False)
    mesa_id: int | None = Field(default=None, foreign_key="mesa.id")
    mesero_id: int | None = Field(default=None, foreign_key="usuario.id")

    fecha_creacion: datetime = Field(default_factory=lambda: datetime.now(UTC), nullable=False)

    mesero: Usuario | None = Relationship(back_populates="pedidos")
    detalles: list[DetallePedido] = Relationship(back_populates="pedido")
    factura: Factura | None = Relationship(back_populates="pedido")
    mesa: Mesa | None = Relationship(back_populates="pedidos")
    restaurante: Restaurante | None = Relationship(back_populates="pedidos")

class DetallePedido(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True, index=True)
    pedido_id: int | None = Field(default=None, foreign_key="pedido.id")
    plato_id: int | None = Field(default=None, foreign_key="plato.id")
    cantidad: int = Field(default=1)
    notas: str | None = Field(max_length=100)
    estado: str = Field(default="Pendiente", nullable=False)

    pedido: Pedido | None = Relationship(back_populates="detalles")
    plato: Plato | None = Relationship(back_populates="detalles_pedido")
