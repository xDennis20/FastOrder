from fastapi import (APIRouter, Depends, status,
                     HTTPException, BackgroundTasks, Query)
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from sqlmodel import select, Session, or_
from app.models.mesa import MesaCreate, MesaRead, Mesa, MesaVincular, EstadosValidos, MesaEstadoUpdate
from app.api.v1.auth.schemas import TokenData
from app.api.deps import get_session, VerificarRol
from app.models.pedido import Pedido, EstadosValidosPedidos
from app.models.usuario import RolesValidos
from app.models.websocket import EventoMesaWS, TipoEventoMesas, CanalWS
from app.service.websocket_manager import manager

router = APIRouter(prefix="/mesas", tags=["mesas"])

@router.post("/", status_code=status.HTTP_201_CREATED, response_model=MesaRead)
def crear_mesa(mesa_in: MesaCreate,
               background_task: BackgroundTasks,
               current_user: TokenData = Depends(VerificarRol([RolesValidos.DUENO])),
               db: Session = Depends(get_session)):
    consulta_mesa_existente = select(Mesa).where(Mesa.restaurante_id == current_user.restaurante_id,
                                                 Mesa.numero_mesa == mesa_in.numero_mesa,
                                                 Mesa.activo == True)
    if db.exec(consulta_mesa_existente).first() is not None:
        raise HTTPException(status_code=400,
                            detail="Ya existe una mesa con ese numero")

    try:
        mesa_nueva = Mesa(numero_mesa=mesa_in.numero_mesa,
                          estado=mesa_in.estado,
                          activo=True,
                          restaurante_id=current_user.restaurante_id)

        db.add(mesa_nueva)
        db.commit()
        db.refresh(mesa_nueva)

        mesa_dto = MesaRead.model_validate(mesa_nueva)

        evento = EventoMesaWS(
            evento=TipoEventoMesas.MESA_CREADA,
            data=mesa_dto
        )

        background_task.add_task(
            manager.broadcast,
            evento.model_dump(mode="json"),
            current_user.restaurante_id,
            CanalWS.MESAS,
        )

        return mesa_nueva
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="El número de mesa ya está registrado para este restaurante")
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno al guardar la base de datos")

@router.patch("/{mesa_id}/vincular",response_model=MesaRead, response_description="Mesa actualizado correctamente", status_code=status.HTTP_200_OK)
def vincular_mesas(mesa_id: int,
               mesa_principal: MesaVincular,
               background_tasks: BackgroundTasks,
               db: Session = Depends(get_session),
               current_user: TokenData = Depends(VerificarRol([RolesValidos.DUENO, RolesValidos.MESERO]))):
    mesa_principal_id = mesa_principal.mesa_principal_id
    restaurante_id = current_user.restaurante_id
    consulta_mesa_modificar = select(Mesa).where(Mesa.restaurante_id == restaurante_id, Mesa.id == mesa_id)
    mesa_modificar = db.exec(consulta_mesa_modificar).first()

    if mesa_modificar is None:
        raise HTTPException(status_code=404,
                            detail="Mesa no encontrada")

    if mesa_principal_id is not None:
        if mesa_modificar.estado != EstadosValidos.DISPONIBLE:
            raise HTTPException(status_code=400,
                                detail="No se puede vincular una mesa que no esta libre")

        if mesa_modificar.mesa_principal_id is not None:
            raise HTTPException(status_code=400,
                                detail="Esta mesa ya esta vinculada a otra mesa")

        if mesa_id == mesa_principal_id:
            raise HTTPException(status_code=400, detail="Una Mesa no puede vincularse asi misma")
        consulta_mesa_principal = select(Mesa).where(Mesa.restaurante_id == restaurante_id,
                                                     Mesa.id == mesa_principal_id)
        mesa_principal_obj = db.exec(consulta_mesa_principal).first()
        if mesa_principal_obj is None:
            raise HTTPException(status_code=404,
                                detail="Mesa a vincular no encontrada")

        if mesa_principal_obj.estado == EstadosValidos.MANTENIMIENTO:
            raise HTTPException(status_code=400,
                                detail="No se puede vincular hacia una mesa en estado de mantenimiento")

        consulta_pedidos = (select(Pedido)
                            .where(Pedido.restaurante_id == restaurante_id,
                                   Pedido.mesa_id == mesa_id,
                                   Pedido.estado.not_in([EstadosValidosPedidos.CANCELADO, EstadosValidosPedidos.PAGADO])))
        pedidos_mesa_modificar = db.exec(consulta_pedidos).first()

        if pedidos_mesa_modificar is not None:
            raise HTTPException(status_code=400,
                                detail="Esta mesa tiene pedidos activos. No se puede vincular a una mesa mientras tenga pedidos activos")

        consulta_mesas_dependientes = (select(Mesa)
                                       .where(Mesa.restaurante_id == restaurante_id,
                                                         Mesa.mesa_principal_id == mesa_id))
        mesa_dependientes = db.exec(consulta_mesas_dependientes).first()

        if mesa_dependientes is not None:
            raise HTTPException(status_code=400,
                                detail="Esta mesa ya tiene mesas secundarias vinculadas. Desvincula las mesas asociadas antes de moverla.")
        if mesa_principal_obj.mesa_principal_id is not None:
            raise HTTPException(status_code=400, detail="No se puede vincular a una mesa que ya es secundaria. Debes vincularla a la mesa principal raíz")

        mesa_modificar.estado = mesa_principal_obj.estado

    else:
        if mesa_modificar.mesa_principal_id is None:
            raise HTTPException(
                status_code=400,
                detail="Esta mesa no esta vinculada a ninguna mesa."
            )
        consulta_pedidos = (select(Pedido)
                            .where(Pedido.restaurante_id == restaurante_id,
                                   or_(
                                       Pedido.mesa_id == mesa_id,
                                       Pedido.mesa_id == mesa_modificar.mesa_principal_id
                                    ),
                                   Pedido.estado.not_in([EstadosValidosPedidos.CANCELADO, EstadosValidosPedidos.PAGADO])))
        pedidos_mesa_modificar = db.exec(consulta_pedidos).first()
        if pedidos_mesa_modificar is not None:
            raise HTTPException(status_code=400,
                                detail="No se puede desvincular una mesa que tiene pedidos activos")

        mesa_modificar.estado = EstadosValidos.DISPONIBLE
        tipo_evento = TipoEventoMesas.MESAS_DESVINCULADAS

    try:
        mesa_modificar.mesa_principal_id = mesa_principal_id
        db.add(mesa_modificar)
        db.commit()
        db.refresh(mesa_modificar)

        mesa_dto = MesaRead.model_validate(mesa_modificar)

        evento = EventoMesaWS(
            evento=tipo_evento,
            data=mesa_dto
        )

        background_tasks.add_task(
            manager.broadcast,
            evento.model_dump(mode="json"),
            current_user.restaurante_id,
            CanalWS.MESAS,
        )

        return mesa_modificar
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno al modificar el objeto en la base de datos")

@router.patch("/{mesa_id}/estado", response_model=MesaRead, response_description="Cambio de estado de la mesa exitoso", status_code=status.HTTP_200_OK)
def mesa_cambiar_estado(mesa_id: int,
                        background_task: BackgroundTasks,
                        estado_in: MesaEstadoUpdate,
                        current_user: TokenData = Depends(VerificarRol([RolesValidos.DUENO, RolesValidos.MESERO])),
                        db: Session = Depends(get_session)):
    consulta_mesa = select(Mesa).where(Mesa.restaurante_id == current_user.restaurante_id, Mesa.id == mesa_id)
    mesa_obj = db.exec(consulta_mesa).first()

    if mesa_obj is None:
        raise HTTPException(
            status_code=404,
            detail="Mesa no encontrada"
        )
    if mesa_obj.mesa_principal_id is not None:
        raise HTTPException(
            status_code=400,
            detail="Mesas secundarias no pueden cambiar su estado. Dependen del estado de la mesa principal"
        )

    consulta_mesas_secundarias = (select(Mesa)
                                  .where(Mesa.restaurante_id == current_user.restaurante_id,
                                         Mesa.mesa_principal_id == mesa_id
                                         ))
    mesas_secundarias = db.exec(consulta_mesas_secundarias).all()

    if mesas_secundarias:
        if estado_in.estado == EstadosValidos.MANTENIMIENTO:
            raise HTTPException(
                status_code=400,
                detail="Esta mesa tiene mesas secundarias. Por favor desvincule las mesas"
            )

    if estado_in.estado != EstadosValidos.OCUPADA:
        mesas_ids = [mesa_id]
        mesas_ids.extend([id_mesa.id for id_mesa in mesas_secundarias])

        consulta_pedidos_activos = (select(Pedido)
                                    .where(Pedido.restaurante_id == current_user.restaurante_id,
                                                        Pedido.mesa_id.in_(mesas_ids),
                                                        Pedido.estado.not_in([EstadosValidosPedidos.CANCELADO, EstadosValidosPedidos.PAGADO])))
        pedido_activo = db.exec(consulta_pedidos_activos).first()

        if pedido_activo is not None:
            raise HTTPException(status_code=400,
                                detail="No se puede cambiar el estado de la mesa, por que tiene pedidos activos")

    try:
        mesa_obj.estado = estado_in.estado

        for mesa in mesas_secundarias:
            mesa.estado = estado_in.estado
            db.add(mesa)

        db.add(mesa_obj)
        db.commit()
        db.refresh(mesa_obj)

        mesa_dto = MesaRead.model_validate(mesa_obj)
        evento = EventoMesaWS(
            evento=TipoEventoMesas.MESA_ACTUALIZADA,
            data=mesa_dto
        )

        background_task.add_task(
            manager.broadcast,
            evento.model_dump(mode="json"),
            current_user.restaurante_id,
            CanalWS.MESAS,
        )

        for mesas in mesas_secundarias:
            mesa_dto = MesaRead.model_validate(mesas)
            evento = EventoMesaWS(
                evento=TipoEventoMesas.MESA_ACTUALIZADA,
                data=mesa_dto
            )
            background_task.add_task(
                manager.broadcast,
                evento.model_dump(mode="json"),
                current_user.restaurante_id,
                CanalWS.MESAS,
            )

        return mesa_obj
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno al modificar el objeto en la base de datos")

@router.get("/", response_model=list[MesaRead])
def obtener_mesas(incluir_inactivas: bool = Query(default=False),
                  current_user: TokenData = Depends(VerificarRol([RolesValidos.SUPERADMIN,RolesValidos.DUENO, RolesValidos.MESERO, RolesValidos.CAJA])),
                  db: Session = Depends(get_session)):
    if incluir_inactivas and current_user.rol not in [RolesValidos.DUENO, RolesValidos.SUPERADMIN]:
        raise HTTPException(status_code=403,
                            detail="No tiene permisos para esta opcion")
    condiciones = [Mesa.restaurante_id == current_user.restaurante_id]
    if not incluir_inactivas:
        condiciones.append(Mesa.activo == True)
    consulta = (select(Mesa)
                .where(*condiciones)
                .order_by(Mesa.numero_mesa))
    mesas_items = db.exec(consulta).all()
    return mesas_items

@router.get("/{mesa_id}", response_model=MesaRead)
def obtener_mesa(mesa_id: int,
                 current_user: TokenData = Depends(VerificarRol([RolesValidos.SUPERADMIN, RolesValidos.DUENO, RolesValidos.MESERO, RolesValidos.CAJA])),
                 db: Session = Depends(get_session)):
    consulta = (select(Mesa)
                .where(Mesa.restaurante_id == current_user.restaurante_id,
                       Mesa.id == mesa_id))

    if current_user.rol not in [RolesValidos.SUPERADMIN, RolesValidos.DUENO]:
        consulta = consulta.where(Mesa.activo == True)

    mesa_item = db.exec(consulta).first()
    if mesa_item is None:
        raise HTTPException(status_code=404,
                            detail="Mesa no encontrada")
    return mesa_item

@router.delete("/{mesa_id}", status_code=status.HTTP_200_OK)
def eliminar_mesa(mesa_id: int,
                  background_task: BackgroundTasks,
                  current_user: TokenData = Depends(VerificarRol([RolesValidos.DUENO])),
                  db: Session = Depends(get_session)) -> dict:
    consulta = (select(Mesa)
                .where(Mesa.restaurante_id == current_user.restaurante_id,
                       Mesa.activo == True,
                       Mesa.id == mesa_id))
    mesa_obj: Mesa | None = db.exec(consulta).first()

    if mesa_obj is None:
        raise HTTPException(status_code=404,
                            detail="Mesa a eliminar no existe")

    if mesa_obj.mesa_principal_id is not None:
        raise HTTPException(
            status_code=400,
            detail="Una mesa secundaria no puede ser eliminada. Debe estar desvinculada primero"
        )

    consulta_mesas_secundarias = (select(Mesa)
                                  .where(Mesa.restaurante_id == current_user.restaurante_id,
                                         Mesa.activo == True,
                                         Mesa.mesa_principal_id == mesa_id))

    if db.exec(consulta_mesas_secundarias).first() is not None:
        raise HTTPException(
            status_code=400,
            detail="Esta mesa tiene mesas secundarias vinculadas. Desvincula las mesas asociadas antes de eliminarlas"
        )

    if mesa_obj.estado not in [EstadosValidos.DISPONIBLE, EstadosValidos.MANTENIMIENTO]:
        raise HTTPException(
            status_code=400,
            detail="Solo se puede eliminar mesas en estado Disponible y fuera de servicio"
        )

    try:
        numero = mesa_obj.numero_mesa
        mesa_obj.activo = False

        db.add(mesa_obj)
        db.commit()
        db.refresh(mesa_obj)

        mesa_dto = MesaRead.model_validate(mesa_obj)

        evento = EventoMesaWS(
            evento=TipoEventoMesas.MESA_ELIMINADA,
            data=mesa_dto
        )

        background_task.add_task(
            manager.broadcast,
            evento.model_dump(mode="json"),
            current_user.restaurante_id,
            CanalWS.MESAS
        )

        return {"detail": f"Mesa {numero} eliminada correctamente"}

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno en la base de datos")
