from typing import TYPE_CHECKING, Optional, Literal
from enum import Enum
from sqlalchemy import Index, text
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from app.models.pedido import Pedido
    from app.models.restaurante import Restaurante

class EstadosValidos(str,Enum):
    DISPONIBLE = "disponible"
    OCUPADA = "ocupada"
    RESERVADA = "reservada"
    MANTENIMIENTO = "fuera_de_servicio"

class Mesa(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True, index=True)
    numero_mesa: str = Field(nullable=False)
    estado: EstadosValidos = Field(default=EstadosValidos.DISPONIBLE, max_length=50)
    activo: bool = Field(default=True, nullable=False)

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
        Index(
            "uq_mesa_restaurante_numero_activa",
            "restaurante_id",
            "numero_mesa",
            unique=True,
            postgresql_where=(text("activo IS TRUE")),
        ),
    )

class MesaBase(SQLModel):
    numero_mesa: str = Field(max_length=3)
    estado: EstadosValidos = EstadosValidos.DISPONIBLE
    activo: bool = Field(default=True)
    mesa_principal_id: int | None = Field(default=None)

class MesaVincular(SQLModel):
    mesa_principal_id: int | None = Field(default=None)

class MesaEstadoUpdate(SQLModel):
    estado: EstadosValidos

class MesaCreate(SQLModel):
    numero_mesa: str = Field(max_length=3)
    estado: Literal[EstadosValidos.DISPONIBLE, EstadosValidos.MANTENIMIENTO] = EstadosValidos.DISPONIBLE

class MesaRead(MesaBase):
    id: int
    restaurante_id: int


from app.models.pedido import Pedido
from app.models.restaurante import Restaurante
Mesa.model_rebuild()