from sqlmodel import SQLModel
from app.models.usuario import RolesValidos

class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(SQLModel):
    user_id: int
    email: str
    username: str
    restaurante_id: int
    rol: RolesValidos
