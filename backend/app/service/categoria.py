from app.models.categoria import Categoria
from app.core.database import get_session
from fastapi import Depends, HTTPException
from sqlmodel import Session, select


def verificar_categoria(id_categoria: int, restaurante_id: int,db: Session = Depends(get_session)) -> Categoria:
    categoria_obj = db.exec(select(Categoria).where(Categoria.id == id_categoria, Categoria.restaurante_id == restaurante_id)).first()
    if not categoria_obj:
        raise HTTPException(status_code=404, detail="Categoria no encontrada")
    return categoria_obj