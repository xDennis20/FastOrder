from __future__ import annotations
from typing import TYPE_CHECKING
from decimal import Decimal
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from app.models.pedido import Pedido

class Factura(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True, index=True)
    pedido_id: int | None = Field(default=None, foreign_key="pedido.id")
    tipo_pago: str = Field(default="Efectivo", nullable=False)
    comprobante_img_url: str | None = Field(default=None, nullable=True)
    total: Decimal = Field(default=0, max_digits=8, decimal_places=2)

    pedido: Pedido | None = Relationship(back_populates="factura")