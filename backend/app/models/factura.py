from enum import Enum
from typing import TYPE_CHECKING, Optional, Literal
from decimal import Decimal
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from app.models.pedido import Pedido

class TiposPagosValidos(Enum):
    EFECTIVO = "Efectivo"
    TRANSFERENCIA = "Transferencia"

class FacturaBase(SQLModel):
    pedido_id: int | None
    tipo_pago: Literal[TiposPagosValidos.EFECTIVO, TiposPagosValidos.TRANSFERENCIA] | None = None
    comprobante_img_url: str | None

class Factura(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True, index=True)
    pedido_id: int | None = Field(foreign_key="pedido.id", unique=True, nullable=False, index=True)
    tipo_pago: str = Field(default=TiposPagosValidos.EFECTIVO, nullable=False)
    comprobante_img_url: str | None = Field(default=None, nullable=True)
    total: Decimal = Field(default=0, max_digits=8, decimal_places=2)

    pedido: Optional["Pedido"] = Relationship(back_populates="factura")

class FacturaCreate(SQLModel):
    tipo_pago: Literal[TiposPagosValidos.EFECTIVO, TiposPagosValidos.TRANSFERENCIA]
    comprobante_img_url: str | None = None

class FacturaRead(SQLModel):
    id: int
    pedido_id: int
    tipo_pago: TiposPagosValidos
    comprobante_img_url: str | None
    total: Decimal

from app.models.pedido import Pedido
Factura.model_rebuild()