import time
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select
from app.api.deps import get_session
from app.service.restaurante import verificar_restaurante
from app.models.categoria import Categoria, CategoriaCreate, CategoriaRead, CategoriaWithPlatos

router = APIRouter(prefix="/categorias", tags=["categorias"])

CACHE_CATEGORIAS = None
CACHE_EXPIRATION_TIME = 0
CACHE_DURATION_SECONDS = 60

@router.post("/", response_model=CategoriaRead)
def crear_categoria(categoria_in: CategoriaCreate, db: Session = Depends(get_session)):
    restaurante_obj = verificar_restaurante(categoria_in.restaurante_id, db)
    try:
        categoria_nueva = Categoria.model_validate(categoria_in)
        categoria_nueva.restaurante_id = restaurante_obj.id
        db.add(categoria_nueva)
        db.commit()
        db.refresh(categoria_nueva)
        return categoria_nueva
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno al guardar en la base de datos")

@router.get("", response_model=list[CategoriaWithPlatos])
def obtener_categorias(db: Session = Depends(get_session)):
    global CACHE_CATEGORIAS, CACHE_EXPIRATION_TIME

    if CACHE_CATEGORIAS is not None and time.time() < CACHE_EXPIRATION_TIME:
        return CACHE_CATEGORIAS

    statement = select(Categoria).options(selectinload(Categoria.platos))
    categoria_items = db.exec(statement).all()

    CACHE_CATEGORIAS = categoria_items
    CACHE_EXPIRATION_TIME = time.time() + CACHE_DURATION_SECONDS

    return categoria_items