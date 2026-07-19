from typing import TYPE_CHECKING, Optional
from sqlmodel import Field, SQLModel, Relationship

if TYPE_CHECKING:
    from app.models.pedido import Pedido
    from app.models.restaurante import Restaurante

class Mesa(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True, index=True)
    numero_mesa: str = Field(nullable=False, unique=True)
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

from app.models.pedido import Pedido
from app.models.restaurante import Restaurante
Mesa.model_rebuild()