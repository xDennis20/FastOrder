import os
import cloudinary
import jwt
from datetime import timedelta, datetime, UTC
from app.core.database import get_session
from app.models.usuario import RolesValidos
from app.api.v1.auth.schemas import TokenData
from pydantic import ValidationError
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

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

def get_current_user(token: str = Depends(oauth_scheme)):
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

        return token_data
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado",
            headers={"WWW-Authenticate": "Bearer"})
    except ValidationError:
        raise credentials_exc
    except InvalidTokenError:
        raise credentials_exc

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