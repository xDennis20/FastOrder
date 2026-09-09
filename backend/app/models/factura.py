from enum import Enum
from datetime import datetime, UTC
from typing import TYPE_CHECKING, Optional
from decimal import Decimal
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from app.models.pedido import Pedido
    from app.models.restaurante import Restaurante

class TiposPagosValidos(str,Enum):
    EFECTIVO = "Efectivo"
    TRANSFERENCIA = "Transferencia"

class Factura(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True, index=True)
    pedido_id: int = Field(foreign_key="pedido.id", unique=True, nullable=False, index=True)
    tipo_pago: TiposPagosValidos = Field(default=TiposPagosValidos.EFECTIVO, nullable=False)
    fecha_creacion: datetime = Field(default_factory=lambda: datetime.now(UTC), nullable=False, index=True)
    comprobante_img_url: str | None = Field(default=None, nullable=True)
    total: Decimal = Field(default=Decimal("0.00"), max_digits=8, decimal_places=2)
    restaurante_id: int = Field(foreign_key="restaurante.id", index=True)

    pedido: Optional["Pedido"] = Relationship(back_populates="factura")
    restaurante: Optional["Restaurante"] = Relationship(back_populates="facturas")

class FacturaCreate(SQLModel):
    tipo_pago: TiposPagosValidos
    comprobante_img_url: str | None = None

class FacturaRead(SQLModel):
    id: int
    pedido_id: int
    tipo_pago: TiposPagosValidos
    comprobante_img_url: str | None
    fecha_creacion: datetime
    total: Decimal
    restaurante_id: int

from app.models.pedido import Pedido
from app.models.restaurante import Restaurante
Factura.model_rebuild()