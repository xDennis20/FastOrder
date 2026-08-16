from typing import TYPE_CHECKING, Optional
from enum import Enum
from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from app.models.pedido import Pedido
    from app.models.restaurante import Restaurante

class Mesa(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True, index=True)
    numero_mesa: str = Field(nullable=False)
    estado: str = Field(default="Disponible", max_length=50)

    mesa_principal_id: int | None = Field(default=None, foreign_key="mesa.id",nullable=True)
    restaurante_id: int | None = Field(default=None, foreign_key="restaurante.id")

    mesa_principal: Optional["Mesa"] = Relationship(
        back_populates="mesas_unidas",
        sa_relationship_kwargs={"remote_side": "Mesa.id"}
    )

    mesas_unidas: list["Mesa"] = Relationship(back_populates="mesa_principal")
    pedidos: list["Pedido"] = Relationship(back_populates="mesa")
    restaurante: Optional["Restaurante"] = Relationship(back_populates="mesas")

    __table_args__ = (
        UniqueConstraint("restaurante_id", "numero_mesa", name="uq_mesas_restaurante"),
    )

class EstadosValidos(str,Enum):
    disponible = "Disponible"
    ocupado = "Ocupada"
    reservada = "Reservada"
    mantenimiento = "Mantenimiento / Fuera de servicio"

class MesaBase(SQLModel):
    numero_mesa: str = Field(max_length=3)
    estado: EstadosValidos = EstadosValidos.disponible
    mesa_principal_id: int | None = Field(default=None)

class MesaVincular(SQLModel):
    mesa_principal_id: int | None = Field(default=None)

class MesaEstadoUpdate(SQLModel):
    estado: EstadosValidos

class MesaCreate(MesaBase):
    pass

class MesaRead(MesaBase):
    id: int
    restaurante_id: int


from app.models.pedido import Pedido
from app.models.restaurante import Restaurante
Mesa.model_rebuild()