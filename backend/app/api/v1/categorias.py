import time
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select
from app.api.deps import get_session, VerificarRol
from app.api.v1.auth.schemas import TokenData
from app.models.usuario import RolesValidos
from app.models.categoria import (Categoria, CategoriaCreate, CategoriaRead,
                                  CategoriaWithPlatos, CategoriaUpdate)

router = APIRouter(prefix="/categorias", tags=["categorias"])

CACHE_CATEGORIAS: dict[tuple[int,bool], dict[str, list[CategoriaWithPlatos] | float]] = {}
CACHE_DURATION_SECONDS = 60

@router.post("/", response_model=CategoriaRead, status_code=status.HTTP_201_CREATED)
def crear_categoria(categoria_in: CategoriaCreate,
                    current_user: TokenData = Depends(VerificarRol([RolesValidos.DUENO])),
                    db: Session = Depends(get_session)):
    consulta_categoria_exc = (select(Categoria)
                              .where(Categoria.nombre == categoria_in.nombre,
                                     Categoria.restaurante_id == current_user.restaurante_id))

    categoria_exc_obj = db.exec(consulta_categoria_exc).first()

    if categoria_exc_obj is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="Categoria ya existente")

    try:
        categoria_nueva = Categoria.model_validate(categoria_in)
        categoria_nueva.restaurante_id = current_user.restaurante_id
        db.add(categoria_nueva)
        db.commit()
        CACHE_CATEGORIAS.pop((current_user.restaurante_id, False), None)
        CACHE_CATEGORIAS.pop((current_user.restaurante_id, True), None)
        db.refresh(categoria_nueva)
        return categoria_nueva
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno al guardar en la base de datos")

@router.get("", response_model=list[CategoriaWithPlatos])
def obtener_categorias(current_user: TokenData = Depends(VerificarRol([RolesValidos.DUENO,RolesValidos.MESERO])),
                       db: Session = Depends(get_session)):
    activo = True if current_user.rol == RolesValidos.MESERO else False
    clave_cache = (current_user.restaurante_id, activo)

    cache = CACHE_CATEGORIAS.get(clave_cache)

    if cache and time.time() < cache.get("expira_en"):
        return cache.get("items")

    statement = (select(Categoria).options(selectinload(Categoria.platos))
                 .where(Categoria.restaurante_id == current_user.restaurante_id)
                 .order_by(Categoria.nombre.asc()))

    if activo:
        statement = statement.where(Categoria.activo == True)

    categoria_items = db.exec(statement).all()

    CACHE_CATEGORIAS[clave_cache] = {"items": categoria_items,
                                                     "expira_en": time.time() + CACHE_DURATION_SECONDS}

    return categoria_items

@router.get("/{categoria_id}", response_model=CategoriaWithPlatos)
def obtener_categoria(categoria_id: int,
                      current_user: TokenData = Depends(VerificarRol([RolesValidos.MESERO, RolesValidos.DUENO, RolesValidos.CAJA])),
                      db: Session = Depends(get_session)):
    consulta_categoria = (select(Categoria).options(selectinload(Categoria.platos))
                          .where(Categoria.id == categoria_id,
                                 Categoria.restaurante_id == current_user.restaurante_id))

    if current_user.rol == RolesValidos.MESERO:
        consulta_categoria = consulta_categoria.where(Categoria.activo == True)

    categoria_obj = db.exec(consulta_categoria).first()

    if categoria_obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Categoria no encontrada")

    return categoria_obj

@router.patch("/{categoria_id}", response_model=CategoriaRead)
def modificar_categoria(categoria_id: int,
                        categoria_in: CategoriaUpdate,
                        current_user: TokenData = Depends(VerificarRol([RolesValidos.DUENO])),
                        db: Session = Depends(get_session)):
    consulta_categoria = (select(Categoria)
                          .where(Categoria.id == categoria_id,
                                 Categoria.restaurante_id == current_user.restaurante_id))

    categoria_obj = db.exec(consulta_categoria).first()

    if categoria_obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoria no encontrada"
        )

    datos_actualizar = categoria_in.model_dump(exclude_unset=True)

    if "nombre" in datos_actualizar:
        consulta_categoria_rep = (select(Categoria)
                                  .where(Categoria.id != categoria_obj.id,
                                         Categoria.nombre == categoria_in.nombre,
                                         Categoria.restaurante_id == current_user.restaurante_id))

        if db.exec(consulta_categoria_rep).first() is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                detail="Categoria ya existente con este nombre")

    categoria_obj.sqlmodel_update(datos_actualizar)

    try:
        db.add(categoria_obj)
        db.commit()
        CACHE_CATEGORIAS.pop((current_user.restaurante_id, True), None)
        CACHE_CATEGORIAS.pop((current_user.restaurante_id, False), None)
        db.refresh(categoria_obj)
        return categoria_obj

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno al guardar en la base de datos")

@router.delete("/{categoria_id}", status_code=status.HTTP_200_OK)
def eliminar_categoria(categoria_id: int,
                       current_user: TokenData = Depends(VerificarRol([RolesValidos.DUENO])),
                       db: Session = Depends(get_session)):
    consulta_categoria = (select(Categoria)
                          .where(Categoria.id == categoria_id,
                                 Categoria.restaurante_id == current_user.restaurante_id))

    categoria_obj = db.exec(consulta_categoria).first()

    if categoria_obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Categoria no encontrada")

    if not categoria_obj.activo :
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Categoria ya desactivada")

    categoria_obj.activo = False

    try:
        db.add(categoria_obj)
        db.commit()

        CACHE_CATEGORIAS.pop((current_user.restaurante_id, True), None)
        CACHE_CATEGORIAS.pop((current_user.restaurante_id, False), None)

        return {"message": "Categoria eliminada correctamente"}

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno al guardar en la base de datos")
