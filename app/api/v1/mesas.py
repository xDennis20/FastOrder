from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from sqlmodel import select, Session
from app.models.mesa import MesaCreate, MesaRead, Mesa
from app.api.deps import get_current_user, get_session

router = APIRouter(prefix="/mesas", tags=["mesas"])

@router.post("/", status_code=status.HTTP_201_CREATED, response_model=MesaRead)
def crear_mesa(mesa_in: MesaCreate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_session)):
    try:
        if mesa_in.mesa_principal_id is not None:
            consulta = select(Mesa).where(Mesa.id == mesa_in.mesa_principal_id, Mesa.restaurante_id == current_user.get("restaurante_id"))
            mesa_existente = db.exec(consulta).first()
            if not mesa_existente:
                raise HTTPException(status_code=404, detail="Mesa principal no existente")

        mesa_nueva = Mesa(numero_mesa=mesa_in.numero_mesa,
                          estado=mesa_in.estado,
                          mesa_principal_id=mesa_in.mesa_principal_id,
                          restaurante_id=current_user.get("restaurante_id"))

        db.add(mesa_nueva)
        db.commit()
        db.refresh(mesa_nueva)

        return mesa_nueva
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="El número de mesa ya está registrado para este restaurante")
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno al guardar la base de datos")

@router.get("/", response_model=list[MesaRead])
def obtener_mesas(current_user: dict = Depends(get_current_user), db: Session = Depends(get_session)):
    consulta = select(Mesa).where(Mesa.restaurante_id == current_user.get("restaurante_id"))
    mesas_items = db.exec(consulta).all()
    return mesas_items
