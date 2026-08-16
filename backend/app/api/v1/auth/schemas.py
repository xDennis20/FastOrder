from sqlmodel import SQLModel

class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(SQLModel):
    sub: str | None
    username: str | None
    restaurante_id: int | None

