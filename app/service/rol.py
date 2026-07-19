from app.models.rol import Rol
from app.core.database import get_session
from fastapi import Depends, HTTPException
from sqlmodel import Session, select


def verificar_rol(id_rol: int, db: Session = Depends(get_session)) -> Rol:
    rol_obj = db.exec(select(Rol).where(Rol.id == id_rol)).first()
    if not rol_obj:
        raise HTTPException(status_code=404, detail="Restaurante no encontrado")
    return rol_obj