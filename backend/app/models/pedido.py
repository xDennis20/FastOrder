from datetime import datetime, UTC
from decimal import Decimal
from typing import TYPE_CHECKING,  Optional
from sqlmodel import SQLModel, Field, Relationship
from enum import Enum

if TYPE_CHECKING:
    from app.models.usuario import Usuario
    from app.models.plato import Plato, PlatoRead
    from app.models.factura import Factura
    from app.models.mesa import Mesa
    from app.models.restaurante import Restaurante

class EstadosValidosPedidos(str, Enum):
    PENDIENTE = "Pendiente"
    EN_PREPARACION = "En preparacion"
    LISTO = "Listo"
    SERVIDO = "Servido"
    PAGADO = "Pagado"
    CANCELADO = "Cancelado"

class EstadosValidosDetalles(str, Enum):
    PENDIENTE = "Pendiente"
    EN_PREPARACION = "En preparacion"
    LISTO = "Listo"
    CANCELADO = "Cancelado"

class PedidoBase(SQLModel):
    estado : EstadosValidosPedidos = EstadosValidosPedidos.PENDIENTE
    mesa_id : int | None
    mesero_id : int | None
    fecha_creacion : datetime = Field(default_factory=lambda: datetime.now(UTC))

class DetallePedidoBase(SQLModel):
    pedido_id: int | None
    plato_id: int | None
    precio_unitario: Decimal | None
    cantidad: int | None = 1
    notas: str | None
    estado: EstadosValidosDetalles = EstadosValidosDetalles.PENDIENTE

class Pedido(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True, index=True)
    estado: str = Field(default=EstadosValidosPedidos.PENDIENTE, nullable=False)

    mesa_id: int | None = Field(default=None, foreign_key="mesa.id")
    mesero_id: int | None = Field(default=None, foreign_key="usuario.id")
    restaurante_id: int | None = Field(default=None, foreign_key="restaurante.id")

    fecha_creacion: datetime = Field(default_factory=lambda: datetime.now(UTC), nullable=False)

    mesero: Optional["Usuario"] = Relationship(back_populates="pedidos")
    detalles: list["DetallePedido"] = Relationship(back_populates="pedido")
    factura: Optional["Factura"] = Relationship(back_populates="pedido")
    mesa: Optional["Mesa"] = Relationship(back_populates="pedidos")
    restaurante: Optional["Restaurante"] = Relationship(back_populates="pedidos")

class DetallePedido(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True, index=True)
    pedido_id: int | None = Field(default=None, foreign_key="pedido.id")
    plato_id: int | None = Field(default=None, foreign_key="plato.id")
    cantidad: int = Field(default=1)
    precio_unitario: Decimal | None = Field(default=None)
    notas: str | None = Field(default=None,max_length=100)
    estado: str = Field(default=EstadosValidosDetalles.PENDIENTE, nullable=False)

    pedido: Optional["Pedido"] = Relationship(back_populates="detalles")
    plato: Optional["Plato"] = Relationship(back_populates="detalles_pedido")


class DetallePedidoCreate(SQLModel):
    plato_id: int
    cantidad: int = 1
    notas: str | None = None

class PedidoCreate(SQLModel):
    mesa_id: int
    detalles: list[DetallePedidoCreate]

class DetallePedidoRead(DetallePedidoBase):
    id: int
    plato: PlatoRead | None = None

class PedidoRead(PedidoBase):
    id: int
    detalles : list[DetallePedidoRead] = []
    restaurante_id: int

class PedidoPagination(SQLModel):
    items: list[PedidoRead] = []
    total: int
    limit: int
    offset: int
    pagina: int
    total_paginas: int
    tiene_siguiente: bool
    tiene_anterior: bool

from app.models.usuario import Usuario
from app.models.plato import Plato, PlatoRead
from app.models.factura import Factura
from app.models.mesa import Mesa
from app.models.restaurante import Restaurante
Pedido.model_rebuild()
