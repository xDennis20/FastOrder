from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from sqlalchemy.exc import SQLAlchemyError
from app.api.deps import get_session
from app.models.restaurante import Restaurante, RestauranteCreate, RestauranteRead

router = APIRouter(prefix="/restaurantes", tags=["restaurantes"])

@router.post("", response_model=RestauranteRead, response_description="Restaurante Creado Correctamente", status_code=status.HTTP_201_CREATED)
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