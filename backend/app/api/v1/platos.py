from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from sqlalchemy.exc import SQLAlchemyError
from app.models.plato import PlatoCreate, Plato, PlatoRead, PlatoUpdate
from app.api.v1.auth.schemas import TokenData
from app.api.v1.categorias import CACHE_CATEGORIAS
from app.service.categoria import verificar_categoria
from app.models.usuario import RolesValidos
from app.api.deps import get_session
from app.api.deps import VerificarRol

router = APIRouter(prefix="/platos", tags=["platos"])

@router.post("/", response_model=PlatoRead, response_description="Plato Creado Correctamente", status_code=status.HTTP_201_CREATED)
def crear_plato(
        plato_in: PlatoCreate,
        db: Session = Depends(get_session),
        current_user: TokenData = Depends(VerificarRol([RolesValidos.DUENO]))
):
    consulta_plato_rep = (select(Plato)
                          .where(Plato.nombre == plato_in.nombre,
                                 Plato.tamano == plato_in.tamano,
                                 Plato.restaurante_id == current_user.restaurante_id))

    if db.exec(consulta_plato_rep).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="Ya existe este plato con ese nombre y tamaño en este restaurante")

    categoria_obj = verificar_categoria(plato_in.categoria_id, current_user.restaurante_id, db)

    if not categoria_obj.activo:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Categoria inhabilitada")

    try:
        nuevo_plato = Plato.model_validate(plato_in, update={"restaurante_id": current_user.restaurante_id})
        nuevo_plato.categoria_id = categoria_obj.id
        db.add(nuevo_plato)
        db.commit()
        CACHE_CATEGORIAS.pop((current_user.restaurante_id, True), None)
        CACHE_CATEGORIAS.pop((current_user.restaurante_id, False), None)
        db.refresh(nuevo_plato)
        return nuevo_plato

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno al guardar en la base de datos")

@router.get("", response_model=list[PlatoRead])
def obtener_platos(categoria_id: int | None = None,
                   limit: int = 100,
                   current_user: TokenData = Depends(VerificarRol([RolesValidos.DUENO, RolesValidos.MESERO, RolesValidos.CAJA])),
                   db: Session = Depends(get_session)):
    consulta_platos = (select(Plato)
                       .where(Plato.restaurante_id == current_user.restaurante_id))

    if categoria_id is not None:
        consulta_platos = consulta_platos.where(Plato.categoria_id == categoria_id)

    if current_user.rol != RolesValidos.DUENO:
        consulta_platos = consulta_platos.where(Plato.activo == True)


    platos_obj = db.exec(consulta_platos.order_by(Plato.nombre.asc()).limit(limit)).all()

    return platos_obj

@router.get("/{plato_id}", response_model=PlatoRead)
def obtener_plato(plato_id: int,
                  current_user: TokenData = Depends(VerificarRol([RolesValidos.DUENO, RolesValidos.MESERO, RolesValidos.CAJA])),
                  db: Session = Depends(get_session)):
    consulta_plato = (select(Plato)
                      .where(Plato.id == plato_id,
                             Plato.restaurante_id == current_user.restaurante_id))

    if current_user.rol != RolesValidos.DUENO:
        consulta_plato = consulta_plato.where(Plato.activo == True)

    plato_obj = db.exec(consulta_plato).first()

    if plato_obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Este plato no existe")

    return plato_obj

@router.patch("/{plato_id}", response_model=PlatoRead)
def modificar_plato(plato_id: int,
                    plato_in: PlatoUpdate,
                    current_user: TokenData = Depends(VerificarRol([RolesValidos.DUENO])),
                    db: Session = Depends(get_session)):
    consulta_plato = (select(Plato)
                          .where(Plato.id == plato_id,
                                 Plato.restaurante_id == current_user.restaurante_id))

    plato_obj = db.exec(consulta_plato).first()

    if plato_obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail= "Plato no encontrado")

    datos_actualizar = plato_in.model_dump(exclude_unset=True)

    if "nombre" in datos_actualizar or "tamano" in datos_actualizar:
        nombre_nuevo = datos_actualizar.get("nombre", plato_obj.nombre)
        tamano_nuevo = datos_actualizar.get("tamano", plato_obj.tamano)
        consulta_plato_exc = (select(Plato)
                              .where(Plato.id != plato_id,
                                     Plato.nombre == nombre_nuevo,
                                     Plato.tamano == tamano_nuevo,
                                     Plato.restaurante_id == current_user.restaurante_id))

        if db.exec(consulta_plato_exc).first() is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                detail="Plato ya existente con ese nombre o tamaño")

    if "categoria_id" in datos_actualizar:
        categoria_obj = verificar_categoria(datos_actualizar.get("categoria_id"), current_user.restaurante_id, db)

        if not categoria_obj.activo:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Categoria inhabilitada")

    plato_obj.sqlmodel_update(datos_actualizar)

    try:
        db.add(plato_obj)
        db.commit()
        CACHE_CATEGORIAS.pop((current_user.restaurante_id, True), None)
        CACHE_CATEGORIAS.pop((current_user.restaurante_id, False), None)
        db.refresh(plato_obj)

        return plato_obj

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno al guardar en la base de datos")

@router.delete("/{plato_id}", status_code=status.HTTP_200_OK)
def eliminar_plato(plato_id: int,
                   current_user: TokenData = Depends(VerificarRol([RolesValidos.DUENO])),
                   db: Session = Depends(get_session)):
    consulta_plato = (select(Plato)
                      .where(Plato.id == plato_id,
                             Plato.restaurante_id == current_user.restaurante_id))

    plato_obj = db.exec(consulta_plato).first()

    if plato_obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Plato no encontrado")

    if not plato_obj.activo:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Plato ya desactivado")

    plato_obj.activo = False

    try:
        db.add(plato_obj)
        db.commit()
        CACHE_CATEGORIAS.pop((current_user.restaurante_id, True), None)
        CACHE_CATEGORIAS.pop((current_user.restaurante_id, False), None)

        return {"message": "Plato eliminado correctamente"}

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno al guardar en la base de datos")
