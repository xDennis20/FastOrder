from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from sqlmodel import select, Session, update
from app.models.mesa import MesaCreate, MesaRead, Mesa, MesaVincular
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

@router.patch("/{mesa_id}/vincular",response_model=MesaRead, response_description="Mesa actualizado correctamente")
def vincular_mesas(mesa_id: int,
               mesa_principal: MesaVincular,
               db: Session = Depends(get_session),
               current_user: dict = Depends(get_current_user)):
    mesa_principal_id = mesa_principal.mesa_principal_id
    restaurante_id = current_user.get("restaurante_id")
    consulta_mesa_modificar = select(Mesa).where(Mesa.restaurante_id == restaurante_id, Mesa.id == mesa_id)
    mesa_modificar = db.exec(consulta_mesa_modificar).first()

    if mesa_modificar is None:
        raise HTTPException(status_code=404, detail="Mesa no encontrada")

    if mesa_principal_id is not None:
        if mesa_id == mesa_principal_id:
            raise HTTPException(status_code=400, detail="Una Mesa no puede vincularse asi misma")
        consulta_mesa_principal = select(Mesa).where(Mesa.restaurante_id == restaurante_id,
                                                     Mesa.id == mesa_principal_id)
        mesa_principal_obj = db.exec(consulta_mesa_principal).first()
        if mesa_principal_obj is None:
            raise HTTPException(status_code=404, detail="Mesa a vincular no encontrada")

    try:
        mesa_modificar.mesa_principal_id = mesa_principal_id
        db.add(mesa_modificar)
        db.commit()
        db.refresh(mesa_modificar)

        return mesa_modificar
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno al modificar el objeto en la base de datos")

@router.get("/", response_model=list[MesaRead])
def obtener_mesas(current_user: dict = Depends(get_current_user), db: Session = Depends(get_session)):
    consulta = select(Mesa).where(Mesa.restaurante_id == current_user.get("restaurante_id"))
    mesas_items = db.exec(consulta).all()
    return mesas_items
