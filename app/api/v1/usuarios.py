from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
import bcrypt
from sqlalchemy.exc import SQLAlchemyError
from app.api.deps import get_session
from app.models.usuario import UsuarioRead, UsuarioCreate, Usuario
from app.service.restaurante import verificar_restaurante
from app.service.rol import verificar_rol

router = APIRouter(prefix="/usuarios", tags=["usuarios"])

@router.post("/", response_model=UsuarioRead, status_code=status.HTTP_201_CREATED)
def registrar_usuario(usuario_in: UsuarioCreate, db: Session = Depends(get_session)):
    restaurante_obj = verificar_restaurante(usuario_in.restaurante_id, db)
    rol_obj = verificar_rol(usuario_in.rol_id, db)

    statement_correo = select(Usuario).where(Usuario.correo == usuario_in.correo)
    usuario_existente_correo = db.exec(statement_correo).first()
    if usuario_existente_correo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El correo ya se encuentra registrado."
        )

    statement_telefono = select(Usuario).where(Usuario.telefono == usuario_in.telefono)
    usuario_existente_telefono = db.exec(statement_telefono).first()
    if usuario_existente_telefono:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El teléfono ya se encuentra registrado."
        )

    password_bytes = usuario_in.password.encode("utf-8")[:72]
    password_encriptada = bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")

    try:
        datos_usuario = usuario_in.model_dump(exclude={"password"})
        nuevo_usuario = Usuario(**datos_usuario, hashed_password=password_encriptada)
        nuevo_usuario.restaurante_id = restaurante_obj.id
        nuevo_usuario.rol_id = rol_obj.id
        db.add(nuevo_usuario)
        db.commit()
        db.refresh(nuevo_usuario)
        return nuevo_usuario
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno al guardar en la base de datos")
