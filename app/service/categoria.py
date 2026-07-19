from app.models.categoria import Categoria
from app.core.database import get_session
from fastapi import Depends, HTTPException
from sqlmodel import Session, select


def verificar_categoria(id: int, db: Session = Depends(get_session)) -> Categoria:
    categoria_obj = db.execute(select(Categoria).where(Categoria.id == id)).scalar_one_or_none()
    if not categoria_obj:
        raise HTTPException(status_code=404, detail="Categoria no encontrada")
    return categoria_obj