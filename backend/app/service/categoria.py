from app.models.categoria import Categoria
from fastapi import HTTPException
from sqlmodel import Session, select


def verificar_categoria(id_categoria: int, restaurante_id: int, db: Session) -> Categoria:
    categoria_obj = db.exec(select(Categoria).where(Categoria.id == id_categoria, Categoria.restaurante_id == restaurante_id)).first()
    if not categoria_obj:
        raise HTTPException(status_code=404, detail="Categoria no encontrada")
    return categoria_obj