from enum import Enum
from sqlmodel import SQLModel
from app.models.pedido import PedidoRead
from app.models.mesa import MesaRead


class TipoEventoCocina(str, Enum):
    PEDIDO_CREADO = "PEDIDO_CREADO"
    PEDIDO_ACTUALIZADO = "PEDIDO_ACTUALIZADO"
    PEDIDO_LISTO = "PEDIDO_LISTO"
    PEDIDO_CANCELADO = "PEDIDO_CANCELADO"
    PEDIDO_PAGADO = "PEDIDO_PAGADO"

class TipoEventoMesas(str, Enum):
    MESA_CREADA = "MESA_CREADA"
    MESAS_VINCULADAS = "MESAS_VINCULADAS"
    MESAS_DESVINCULADAS = "MESAS_DESVINCULADAS"
    MESA_ACTUALIZADA = "MESA_ACTUALIZADA"
    MESA_ELIMINADA = "MESA_ELIMINADA"

class CanalWS(str, Enum):
    COCINA = "COCINA"
    MESAS = "MESA"

class EventoPedidoWS(SQLModel):
    evento: TipoEventoCocina
    data: PedidoRead

class EventoMesaWS(SQLModel):
    evento: TipoEventoMesas
    data: MesaRead