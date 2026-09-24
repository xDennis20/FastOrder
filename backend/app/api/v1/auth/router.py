from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from fastapi.security import OAuth2PasswordRequestForm
import bcrypt
from app.api.v1.auth.schemas import Token
from app.core.database import get_session
from app.models.usuario import Usuario
from app.api.deps import crear_token_acceso
from app.models.restaurante import Restaurante
from app.models.usuario import RolesValidos

router = APIRouter(prefix="/auth", tags=["auth"])
DUMMY_HASH = "$2b$12$e8Yn5h8/jL8aU8yV1t1pueZk0M0h6f9uO2u2Z4m8xG9m4b3q5a1a2"

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_session)):
    constr = select(Usuario).where(Usuario.correo == form_data.username)
    usuario_obj: Usuario = db.exec(constr).first()

    password_bytes = form_data.password.encode("utf-8")[:72]

    if usuario_obj:
        password_correcta = bcrypt.checkpw(
            password_bytes,
            usuario_obj.hashed_password.encode("utf-8")
        )
    else:
        bcrypt.checkpw(password_bytes, DUMMY_HASH.encode("utf-8"))
        password_correcta = False

    if not usuario_obj or not password_correcta:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not usuario_obj.activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta cuenta esta desactivada. Contacte con el administrador"
        )

    if usuario_obj.rol != RolesValidos.SUPERADMIN:
        restaurante_obj: Restaurante = db.exec(
            select(Restaurante)
            .where(Restaurante.id == usuario_obj.restaurante_id)).first()
        if restaurante_obj is None or not restaurante_obj.activo:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Esta cuenta esta en un restaurante desactivado. Contacte con el administrador"
            )

    token_payload = {
        "user_id": usuario_obj.id,
        "email": usuario_obj.correo,
        "username": f"{usuario_obj.nombres} {usuario_obj.apellidos}",
        "restaurante_id": usuario_obj.restaurante_id,
        "rol": usuario_obj.rol
    }

    access_token = crear_token_acceso(data=token_payload)

    return {"access_token": access_token, "token_type": "bearer"}