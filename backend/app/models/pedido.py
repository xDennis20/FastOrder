from typing import TYPE_CHECKING,  Optional
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime, UTC

if TYPE_CHECKING:
    from backend.app.models.usuario import Usuario
    from backend.app.models.plato import Plato
    from backend.app.models.factura import Factura
    from backend.app.models.mesa import Mesa
    from backend.app.models.restaurante import Restaurante

class Pedido(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True, index=True)
    estado: str = Field(default="Pendiente", nullable=False)

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
    notas: str | None = Field(max_length=100)
    estado: str = Field(default="Pendiente", nullable=False)

    pedido: Optional["Pedido"] = Relationship(back_populates="detalles")
    plato: Optional["Plato"] = Relationship(back_populates="detalles_pedido")

class DetallePedidoCreate(SQLModel):
    plato_id: int
    cantidad: int = 1
    notas: str | None = None

class PedidoCreate(SQLModel):
    mesa_id: int
    detalles: list[DetallePedidoCreate]

from backend.app.models.usuario import Usuario
from backend.app.models.plato import Plato
from backend.app.models.factura import Factura
from backend.app.models.mesa import Mesa
from backend.app.models.restaurante import Restaurante
Pedido.model_rebuild()
