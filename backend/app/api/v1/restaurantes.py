from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select
from sqlalchemy.exc import SQLAlchemyError
from app.api.deps import get_session, VerificarRol
from app.api.v1.categorias import CACHE_CATEGORIAS
from app.models.usuario import RolesValidos
from app.api.v1.auth.schemas import TokenData
from app.models.restaurante import Restaurante, RestauranteCreate, RestauranteRead, RestauranteUpdate

router = APIRouter(prefix="/restaurantes", tags=["restaurantes"])

@router.post(
    "",
    dependencies=[Depends(VerificarRol([RolesValidos.SUPERADMIN]))],
    response_model=RestauranteRead,
    response_description="Restaurante Creado Correctamente",
    status_code=status.HTTP_201_CREATED
)
def crear_restaurante(restaurante_in: RestauranteCreate, db: Session = Depends(get_session)):
    try:
        restaurante_nuevo = Restaurante.model_validate(restaurante_in)
        db.add(restaurante_nuevo)
        db.commit()
        db.refresh(restaurante_nuevo)
        return restaurante_nuevo
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno al guardar en la base de datos")

@router.get(
    "",
    response_model=list[RestauranteRead],
    dependencies=[Depends(VerificarRol([RolesValidos.SUPERADMIN]))],
    status_code=status.HTTP_200_OK,
    summary="Listar todos los restaurantes (SuperAdmin)"
)
def obtener_restaurantes(
    db: Session = Depends(get_session),
    offset: int = Query(default=0, ge=0, description="Número de registros a omitir"),
    limit: int = Query(default=20, ge=1, le=100, description="Cantidad máxima de registros por página"),
    activo: bool | None = Query(default=None, description="Filtrar por estado activo/inactivo (opcional)")
):
    query = select(Restaurante)

    if activo is not None:
        query = query.where(Restaurante.activo == activo)

    query = query.order_by(Restaurante.fecha_registro.desc()).offset(offset).limit(limit)

    restaurantes = db.exec(query).all()
    return restaurantes

@router.get("/mi-restaurante",response_model=RestauranteRead)
def obtener_restaurante(current_user: TokenData = Depends(VerificarRol([RolesValidos.DUENO, RolesValidos.SUPERADMIN])),
                        db: Session = Depends(get_session)):
    consulta_restaurante = (select(Restaurante)
                            .where(Restaurante.id == current_user.restaurante_id))

    restaurante_obj = db.exec(consulta_restaurante).first()

    if restaurante_obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Restaurante no existente")

    if not restaurante_obj.activo:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Restaurante no activo")

    return restaurante_obj

@router.patch("/mi-restaurante", response_model=RestauranteRead)
def modificar_restaurante(restaurante_in: RestauranteUpdate,
                          current_user: TokenData = Depends(VerificarRol([RolesValidos.DUENO])),
                          db: Session = Depends(get_session)):
    consulta_restaurante = (select(Restaurante)
                            .where(Restaurante.id == current_user.restaurante_id))

    restaurante_obj = db.exec(consulta_restaurante).first()

    if restaurante_obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Restaurante no existente")

    datos_actualizar = restaurante_in.model_dump(exclude_unset=True)

    if "ruc" in datos_actualizar:
        if datos_actualizar.get("ruc") is not None:
            consulta_restaurante_ruc = (select(Restaurante)
                                        .where(Restaurante.id != current_user.restaurante_id,
                                               Restaurante.ruc == datos_actualizar.get("ruc")))
            if db.exec(consulta_restaurante_ruc).first() is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Existe otro restaurante con el mismo RUC"
                )

    restaurante_obj.sqlmodel_update(datos_actualizar)

    try:
        db.add(restaurante_obj)
        db.commit()
        db.refresh(restaurante_obj)

        return restaurante_obj

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Error interno al guardar en la base de datos")

@router.delete(
    "/{restaurante_id}",
    dependencies=[Depends(VerificarRol([RolesValidos.SUPERADMIN]))]
)
def eliminar_restaurante(restaurante_id: int,
                         db: Session = Depends(get_session)):
    consulta_restaurante = (select(Restaurante)
                            .where(Restaurante.id == restaurante_id))

    restaurante_obj = db.exec(consulta_restaurante).first()

    if restaurante_obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Restaurante no encontrado")

    if not restaurante_obj.activo:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Restaurante ya inactivo")

    restaurante_obj.activo = False

    try:
        db.add(restaurante_obj)
        db.commit()
        CACHE_CATEGORIAS.pop((restaurante_id, True), None)
        CACHE_CATEGORIAS.pop((restaurante_id, False), None)

        return {"message": "Restaurante eliminado correctamente"}

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Error interno al guardar en la base de datos")
