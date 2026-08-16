from app.models.restaurante import Restaurante
from app.core.database import get_session
from fastapi import Depends, HTTPException
from sqlmodel import Session, select


def verificar_restaurante(id_restaurante: int, db: Session = Depends(get_session)) -> Restaurante:
    if id_restaurante is None:
        return None
    restaurante_obj = db.exec(select(Restaurante).where(Restaurante.id == id_restaurante)).first()
    if not restaurante_obj:
        raise HTTPException(status_code=404, detail="Restaurante no encontrado")
    return restaurante_obj