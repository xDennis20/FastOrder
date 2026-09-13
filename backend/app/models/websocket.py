from enum import Enum
from sqlmodel import SQLModel
from app.models.pedido import PedidoRead


class TipoEventoCocina(str, Enum):
    PEDIDO_CREADO = "PEDIDO_CREADO"
    PEDIDO_ACTUALIZADO = "PEDIDO_ACTUALIZADO"
    PEDIDO_LISTO = "PEDIDO_LISTO"
    PEDIDO_CANCELADO = "PEDIDO_CANCELADO"
    PEDIDO_PAGADO = "PEDIDO_PAGADO"


class EventoPedidoWS(SQLModel):
    evento: TipoEventoCocina
    data: PedidoRead