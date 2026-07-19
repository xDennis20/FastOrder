from app.models.restaurante import Restaurante
from app.core.database import get_session
from fastapi import Depends, HTTPException
from sqlmodel import Session, select


def verificar_restaurante(id_restaurante: int, db: Session = Depends(get_session)) -> Restaurante:
    categoria_obj = db.execute(select(Restaurante).where(Restaurante.id == id_restaurante)).scalar_one_or_none()
    if not categoria_obj:
        raise HTTPException(status_code=404, detail="Restaurante no encontrado")
    return categoria_obj