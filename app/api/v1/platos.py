from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from sqlalchemy.exc import SQLAlchemyError
from app.models.plato import PlatoCreate, Plato, PlatoRead
from app.service.categoria import verificar_categoria
from app.service.restaurante import verificar_restaurante
from app.api.deps import get_session

router = APIRouter(prefix="/platos", tags=["platos"])

@router.post("", response_model=PlatoRead, response_description="Post Creado Correctamente", status_code=status.HTTP_201_CREATED)
def crear_plato(plato_in: PlatoCreate, db: Session = Depends(get_session)):
    categoria_obj = verificar_categoria(plato_in.categoria_id, db)
    restaurante_obj = verificar_restaurante(plato_in.restaurante_id, db)
    try:
        nuevo_plato = Plato.model_validate(plato_in)
        nuevo_plato.categoria_id = categoria_obj.id
        nuevo_plato.restaurante_id = restaurante_obj.id
        db.add(nuevo_plato)
        db.commit()
        db.refresh(nuevo_plato)
        return nuevo_plato
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno al guardar en la base de datos")

