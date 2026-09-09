from datetime import date
from decimal import Decimal
from sqlmodel import SQLModel, Field


from app.models.pedido import PedidoBase, DetallePedidoRead
from app.models.factura import FacturaRead

class PedidoHistorialRead(PedidoBase):
    id: int
    detalles: list[DetallePedidoRead] = []

class FacturaHistorialRead(FacturaRead):
    pedido: PedidoHistorialRead | None = None

class HistorialVentasRead(SQLModel):
    total_registros: int
    total_recaudado: Decimal
    pagina_actual: int
    total_paginas: int
    tamano_pagina: int
    tiene_siguiente: bool
    tiene_anterior: bool
    items: list[FacturaHistorialRead]

class CierreCaja(SQLModel):
    fecha: date
    total_efectivo: Decimal
    total_transferencia: Decimal
    total_recaudado: Decimal
    total_pedidos: int
    promedio_tickets: Decimal