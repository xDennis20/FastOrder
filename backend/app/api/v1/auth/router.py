from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from fastapi.security import OAuth2PasswordRequestForm
import bcrypt
from app.api.v1.auth.schemas import Token
from app.core.database import get_session
from app.models.usuario import Usuario
from app.api.deps import crear_token_acceso

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_session)):
    constr = select(Usuario).where(Usuario.correo == form_data.username)
    usuario_obj: Usuario = db.exec(constr).first()

    password_correcta = False
    if usuario_obj:
        password_correcta = bcrypt.checkpw(
            form_data.password.encode("utf-8")[:72],
            usuario_obj.hashed_password.encode("utf-8")
        )

    if not usuario_obj or not password_correcta:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_payload = {
        "sub": usuario_obj.correo,
        "username": f"{usuario_obj.nombres} {usuario_obj.apellidos}",
        "restaurante_id": usuario_obj.restaurante_id
    }

    access_token = crear_token_acceso(data=token_payload)

    return {"access_token": access_token, "token_type": "bearer"}