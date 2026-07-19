from typing import TYPE_CHECKING, Optional
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from app.models.rol import Rol
    from app.models.pedido import Pedido
    from app.models.restaurante import Restaurante

class Usuario(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True, index=True)
    nombres: str = Field(nullable=False)
    apellidos: str = Field(nullable=False)
    telefono: str = Field(nullable=False, unique=True, max_length=10, index=True)
    correo: str = Field(nullable=False, unique=True, max_length=200, index=True)
    hashed_password: str = Field(nullable=False)

    rol_id: int | None = Field(default=None, foreign_key="rol.id")
    restaurante_id: int | None = Field(default=None, foreign_key="restaurante.id")

    rol: Optional[Rol] = Relationship(back_populates="usuarios")
    pedidos: list["Pedido"] = Relationship(back_populates="mesero")
    restaurante: Optional[Restaurante] = Relationship(back_populates="usuarios")

from app.models.rol import Rol
from app.models.pedido import Pedido
from app.models.restaurante import Restaurante
Usuario.model_rebuild()