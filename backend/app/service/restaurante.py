from app.models.restaurante import Restaurante
from fastapi import HTTPException
from sqlmodel import Session, select


def verificar_restaurante(id_restaurante: int | None, db: Session) -> Restaurante | None:
    if id_restaurante is None:
        return None
    restaurante_obj = db.exec(select(Restaurante).where(Restaurante.id == id_restaurante)).first()
    if not restaurante_obj:
        raise HTTPException(status_code=404, detail="Restaurante no encontrado")
    return restaurante_obj