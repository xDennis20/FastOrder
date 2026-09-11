import os
import cloudinary
import jwt
from sqlmodel import select, Session
from datetime import timedelta, datetime, UTC
from app.core.database import get_session
from app.models.usuario import RolesValidos
from app.api.v1.auth.schemas import TokenData
from pydantic import ValidationError
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
from fastapi import (Depends, HTTPException, status,
                     WebSocket, Query, WebSocketDisconnect)
from fastapi.security import OAuth2PasswordBearer

from app.models.restaurante import Restaurante
from app.models.usuario import Usuario

SECRET_KEY = os.getenv("SECRET_KEY", "020620D")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

cloudinary.config(
    cloud_name= os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_Key= os.getenv("CLOUDINARY_API_KEY"),
    api_secret= os.getenv("CLOUDINARY_API_SECRET")
)

oauth_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def crear_token_acceso(data: dict, expira_delta: timedelta | None = None) -> TokenData:
    to_encode = data.copy()
    expire = datetime.now(tz=UTC) + (expira_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    token = jwt.encode(payload=to_encode, key=SECRET_KEY, algorithm=ALGORITHM)
    return token

def decode_token(token: str) -> dict:
    payload = jwt.decode(jwt=token, key=SECRET_KEY, algorithms=[ALGORITHM])
    return payload

def get_current_user(token: str = Depends(oauth_scheme),
                     db: Session = Depends(get_session)):
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No autorizado",
        headers={"WWW-Authenticate": "Bearer"}
    )

    try:
        payload = decode_token(token)
        sub: str | None = payload.get("sub")
        username: str | None = payload.get("username")
        restaurante_id: int | None = payload.get("restaurante_id")
        rol: str | None = payload.get("rol")

        token_data = TokenData(email=sub,
                  username=username,
                  restaurante_id=restaurante_id,
                  rol=rol
                  )

    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado",
            headers={"WWW-Authenticate": "Bearer"})
    except ValidationError:
        raise credentials_exc
    except InvalidTokenError:
        raise credentials_exc

    usuario_obj = db.exec(select(Usuario)
                          .where(Usuario.correo == token_data.email)).first()

    if usuario_obj is None or not usuario_obj.activo:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Usuario no existente o inhabilitado")

    if token_data.rol == RolesValidos.SUPERADMIN:
        return token_data

    restaurante_obj = db.exec(select(Restaurante)
                                   .where(Restaurante.id == token_data.restaurante_id)).first()

    if restaurante_obj is None or not restaurante_obj.activo:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Restaurante no existente o inhabilitado")

    return token_data


class VerificarRol:
    def __init__(self, roles_permitidos: list[RolesValidos]):
        self.roles = roles_permitidos

    def __call__(self, current_user: TokenData = Depends(get_current_user)):
        if current_user.rol not in self.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permisos insuficientes"
            )
        return current_user

class VerificarRolWS:
    def __init__(self, roles_permitidos: list[RolesValidos]):
        self.roles_permitidos = roles_permitidos

    async def __call__(
        self,
        websocket: WebSocket,
        token: str | None = Query(default=None)
    ) -> TokenData:
        if not token:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            raise WebSocketDisconnect()

        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_data = TokenData(**payload)
        except (InvalidTokenError, ValidationError):
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            raise WebSocketDisconnect()

        # Validación de rol
        if user_data.rol not in self.roles_permitidos:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            raise WebSocketDisconnect()

        return user_data