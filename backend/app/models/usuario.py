from enum import Enum
from typing import TYPE_CHECKING, Optional
from pydantic import EmailStr, field_validator
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from app.models.pedido import Pedido
    from app.models.restaurante import Restaurante

def validar_complejidad_password(v: str | None) -> str | None:
    if v is None:
        return v

    if len(v) < 8:
        raise ValueError("La contraseña debe tener al menos 8 caracteres.")
    if not any(c.isupper() for c in v):
        raise ValueError("La contraseña debe incluir al menos una letra mayúscula.")
    if not any(c.islower() for c in v):
        raise ValueError("La contraseña debe incluir al menos una letra minúscula.")
    if not any(c.isdigit() for c in v):
        raise ValueError("La contraseña debe incluir al menos un número.")
    if not any(c in "!@#$%^&*()-_=+[]{}|;:,.<>?/" for c in v):
        raise ValueError("La contraseña debe incluir al menos un carácter especial.")

    return v

class RolesValidos(str, Enum):
    DUENO = "dueno"
    MESERO = "mesero"
    COCINERO = "cocinero"
    CAJA = "caja"

class UsuarioBase(SQLModel):
    nombres: str = Field(nullable=False)
    apellidos: str = Field(nullable=False)
    telefono: str = Field(nullable=False, unique=True, max_length=10, index=True)
    correo: EmailStr
    rol: RolesValidos = Field(default=RolesValidos.MESERO, nullable=False)
    restaurante_id: int | None = Field(default=None, foreign_key="restaurante.id")

class UsuarioCreate(SQLModel):
    nombres: str = Field(nullable=False)
    apellidos: str = Field(nullable=False)
    telefono: str = Field(nullable=False, unique=True, max_length=10, index=True)
    correo: EmailStr
    rol: RolesValidos = Field(default=RolesValidos.MESERO, nullable=False)
    password: str = Field(nullable=False, min_length=6)

    @field_validator("password")
    @classmethod
    def validar_password(cls, v: str) -> str:
        return validar_complejidad_password(v)

class UsuarioRead(UsuarioBase):
    id: int

class UsuarioUpdate(SQLModel):
    nombres: str | None = None
    apellidos: str | None = None
    password: str | None = Field(default=None, min_length=6)
    telefono: str | None = Field(default=None, max_length=10)
    correo: EmailStr | None = Field(default=None, max_length=200)
    rol: RolesValidos | None = None

    @field_validator("password")
    @classmethod
    def validar_password(cls, v: str | None) -> str | None:
        return validar_complejidad_password(v)

class Usuario(UsuarioBase, table=True):
    id: int | None = Field(default=None, primary_key=True, index=True)
    hashed_password: str = Field(nullable=False)

    pedidos: list["Pedido"] = Relationship(back_populates="mesero")
    restaurante: Optional["Restaurante"] = Relationship(back_populates="usuarios")

from app.models.pedido import Pedido
from app.models.restaurante import Restaurante
Usuario.model_rebuild()