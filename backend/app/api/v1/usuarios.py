from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select
import bcrypt
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from app.api.deps import get_session, VerificarRol
from app.api.v1.auth.schemas import TokenData
from app.models.usuario import (UsuarioRead, UsuarioCreate, Usuario,
                                RolesValidos, UsuarioUpdate)

router = APIRouter(prefix="/usuarios", tags=["usuarios"])

@router.post("/", response_model=UsuarioRead, status_code=status.HTTP_201_CREATED)
def registrar_usuario(usuario_in: UsuarioCreate,
                      db: Session = Depends(get_session),
                      current_user: TokenData = Depends(VerificarRol([RolesValidos.DUENO]))):
    statement_correo = select(Usuario).where(Usuario.correo == usuario_in.correo)
    usuario_existente_correo = db.exec(statement_correo).first()
    if usuario_existente_correo:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El correo ya se encuentra registrado."
        )

    statement_telefono = select(Usuario).where(Usuario.telefono == usuario_in.telefono)
    usuario_existente_telefono = db.exec(statement_telefono).first()
    if usuario_existente_telefono:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El teléfono ya se encuentra registrado."
        )

    password_bytes = usuario_in.password.encode("utf-8")[:72]
    password_encriptada = bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")

    try:
        datos_usuario = usuario_in.model_dump(exclude={"password"})
        nuevo_usuario = Usuario(**datos_usuario, hashed_password=password_encriptada)
        nuevo_usuario.restaurante_id = current_user.restaurante_id
        nuevo_usuario.rol = usuario_in.rol
        db.add(nuevo_usuario)
        db.commit()
        db.refresh(nuevo_usuario)
        return nuevo_usuario
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno al guardar en la base de datos")

@router.get("", response_model=list[UsuarioRead])
def obtener_usuarios(activo: bool | None = Query(default=None, description="Filtrar por estado activo/inactivo"),
                     db: Session = Depends(get_session),
                     current_user: TokenData = Depends(VerificarRol([RolesValidos.DUENO]))):
    consulta_usuarios = (select(Usuario)
                         .where(Usuario.restaurante_id == current_user.restaurante_id))
    if activo is not None:
        consulta_usuarios = consulta_usuarios.where(Usuario.estado == activo)

    consulta_usuarios = consulta_usuarios.order_by(Usuario.nombres.asc())
    obj_usuarios = db.exec(consulta_usuarios).all()

    return obj_usuarios

@router.get("/{usuario_id}", response_model=UsuarioRead)
def obtener_usuario(usuario_id: int,
                    db: Session = Depends(get_session),
                    current_user: TokenData = Depends(VerificarRol([RolesValidos.DUENO]))):
    consulta_usuario = (select(Usuario)
                        .where(Usuario.id == usuario_id,
                               Usuario.restaurante_id == current_user.restaurante_id))
    obj_usuario = db.exec(consulta_usuario).first()
    if obj_usuario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Usuario no encontrado")
    return obj_usuario

@router.patch("/{usuario_id}", response_model=UsuarioRead)
def modificar_usuario(usuario_id: int,
                      usuario_in: UsuarioUpdate,
                      current_user: TokenData = Depends(VerificarRol([RolesValidos.DUENO])),
                      db: Session = Depends(get_session)):
    consulta_usuario = (select(Usuario)
                        .where(Usuario.id == usuario_id,
                               Usuario.restaurante_id == current_user.restaurante_id))
    obj_usuario = db.exec(consulta_usuario).first()
    if obj_usuario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Usuario no encontrado")

    datos_actualizar = usuario_in.model_dump(exclude_unset=True)

    if "password" in datos_actualizar:
        password_raw: str = datos_actualizar.pop("password")
        password_bytes = password_raw.encode("utf-8")[:72]
        obj_usuario.hashed_password = bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")

    if "correo" in datos_actualizar:
        consulta_exc = (select(Usuario)
                        .where(Usuario.id != usuario_id,
                               Usuario.correo == datos_actualizar.get("correo")))
        usuario_exc = db.exec(consulta_exc).first()
        if usuario_exc is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                detail="Correo ya existente")

    if "telefono" in datos_actualizar:
        consulta_exc = (select(Usuario)
                        .where(Usuario.id != usuario_id,
                               Usuario.telefono == datos_actualizar.get("telefono")))
        usuario_exc = db.exec(consulta_exc).first()
        if usuario_exc is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                detail="Telefono ya existente")

    obj_usuario.sqlmodel_update(datos_actualizar)

    try:
        db.add(obj_usuario)
        db.commit()
        db.refresh(obj_usuario)

        return obj_usuario

    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Datos repetidos")

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno al guardar en la base de datos")
