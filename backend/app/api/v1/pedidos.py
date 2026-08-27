import datetime
import math
import time
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Query
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select, func
from sqlalchemy.exc import SQLAlchemyError
from app.core.database import get_session
from app.api.deps import get_current_user
from app.models.mesa import Mesa
from app.models.pedido import (Pedido, DetallePedido, PedidoCreate, PedidoPagination,
                               EstadosValidosPedidos, PedidoRead, EstadosValidosDetalles,
                               DetalleEstadoUpdate, PedidoUpdate, DetallePedidoCreate)
from app.models.plato import Plato
from app.models.usuario import Usuario

router = APIRouter(prefix="/pedidos", tags=["pedidos"])


def simular_notificacion_cocina(pedido_id: int, total_platos: int):
    time.sleep(3)
    print(
        f"\n👨‍🍳 [COCINA NOTIFICADA] ¡Atención! Se envió el Pedido #{pedido_id} "
        f"con {total_platos} platos a la pantalla de preparación.\n"
    )

@router.post("/", status_code=status.HTTP_201_CREATED)
def crear_pedido(
        pedido_in: PedidoCreate,
        background_tasks: BackgroundTasks,
        db: Session = Depends(get_session),
        current_user: dict = Depends(get_current_user)
):
    if not pedido_in.detalles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El pedido debe contener al menos un plato."
        )

    try:
        nuevo_pedido = Pedido(
            mesa_id=pedido_in.mesa_id,
            restaurante_id=current_user["restaurante_id"],
            estado="Pendiente"
        )
        db.add(nuevo_pedido)
        db.commit()
        db.refresh(nuevo_pedido)

        for item in pedido_in.detalles:
            detalle_db = DetallePedido(
                pedido_id=nuevo_pedido.id,
                plato_id=item.plato_id,
                cantidad=item.cantidad,
                notas=item.notas,
                estado="Pendiente"
            )
            db.add(detalle_db)

        db.commit()

        background_tasks.add_task(
            simular_notificacion_cocina,
            pedido_id=nuevo_pedido.id,
            total_platos=len(pedido_in.detalles)
        )

        return {
            "mensaje": "Pedido registrado con éxito. Notificación enviada a cocina.",
            "pedido_id": nuevo_pedido.id,
            "estado": nuevo_pedido.estado
        }

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al registrar el pedido en la base de datos."
        )

@router.get("", response_model=PedidoPagination)
def obtener_pedidos(estado: list[EstadosValidosPedidos] | None = Query(default=None, description="Estados a filtrar"),
                    mesa_id: int | None = None,
                    mesero_id: int | None = None,
                    fecha: datetime.date | None = None,
                    limit: int = Query(10, ge=1, le=20, description="Cantidad de paginas por pedido"),
                    page: int = Query(1, ge=1, description="Numero de paginas (1>=)"),
                    current_user: dict = Depends(get_current_user),
                    db: Session = Depends(get_session)
                    ):
    consulta = select(Pedido).where(Pedido.restaurante_id == current_user["restaurante_id"])
    if estado:
        consulta = consulta.where(Pedido.estado.in_(estado))
    if mesa_id is not None:
        consulta = consulta.where(Pedido.mesa_id == mesa_id)
    if mesero_id is not None:
        consulta = consulta.where(Pedido.mesero_id == mesero_id)
    if fecha is not None:
        inicio_dia = datetime.datetime.combine(fecha, datetime.time.min, tzinfo=datetime.timezone.utc)
        final_dia = datetime.datetime.combine(fecha, datetime.time.max, tzinfo=datetime.timezone.utc)
        consulta = consulta.where(Pedido.fecha_creacion >= inicio_dia, Pedido.fecha_creacion <= final_dia)

    total_pedidos = db.exec(select(func.count("*")).select_from(consulta.subquery())).one()

    consulta = consulta.options(selectinload(Pedido.detalles).joinedload(DetallePedido.plato))

    offset = (page - 1) * limit

    items = db.exec(consulta.order_by(Pedido.fecha_creacion.desc()).limit(limit).offset(offset)).all()
    total_paginas = math.ceil(total_pedidos / limit) if total_pedidos > 0 else 0
    pagina_actual = (total_paginas // limit) + 1
    tiene_anterior = pagina_actual > 1
    tiene_siguiente = pagina_actual < total_paginas

    return PedidoPagination(
        items=items,
        total=total_pedidos,
        limit=limit,
        offset=offset,
        pagina=pagina_actual,
        total_paginas=total_paginas,
        tiene_siguiente=tiene_siguiente,
        tiene_anterior=tiene_anterior
    )

@router.patch("/detalles/{detalle_id}/estado", response_model=PedidoRead, status_code=status.HTTP_200_OK)
def cambiar_plato_estado(detalle_id: int,
                         datos: DetalleEstadoUpdate,
                         current_user: dict = Depends(get_current_user),
                         db: Session = Depends(get_session)):
    consulta = select(DetallePedido).where(DetallePedido.id == detalle_id)
    obj_detalle = db.exec(consulta).first()
    if obj_detalle is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No existe este Detalle Pedido"
        )
    pedido = obj_detalle.pedido
    if pedido.restaurante_id != current_user["restaurante_id"]:
        raise  HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No existe este Detalle Pedido en el restaurante"
        )

    obj_detalle.estado = datos.estado

    list_platos = pedido.detalles

    set_estado = set(plato.estado for plato in list_platos)

    if len(set_estado) == 1 and EstadosValidosDetalles.CANCELADO in set_estado:
        pedido.estado = EstadosValidosPedidos.CANCELADO
    elif EstadosValidosDetalles.PENDIENTE not in set_estado and EstadosValidosDetalles.EN_PREPARACION not in set_estado and EstadosValidosDetalles.LISTO in set_estado:
        pedido.estado = EstadosValidosPedidos.LISTO
    elif EstadosValidosDetalles.EN_PREPARACION in set_estado or EstadosValidosDetalles.LISTO in set_estado:
        pedido.estado = EstadosValidosPedidos.EN_PREPARACION

    try:
        db.add(obj_detalle)
        db.add(pedido)
        db.commit()
        db.refresh(obj_detalle)
        db.refresh(pedido)

        return pedido
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno al guardar en la base de datos")

@router.patch("/{pedido_id}", response_model=PedidoRead, status_code=status.HTTP_200_OK)
def cambiar_cabecera_pedido(pedido_id: int,
                            pedido_in: PedidoUpdate,
                            current_user: dict = Depends(get_current_user),
                            db: Session = Depends(get_session)):
    consulta = select(Pedido).where(Pedido.id == pedido_id, Pedido.restaurante_id == current_user["restaurante_id"])
    obj_pedido = db.exec(consulta).first()
    if obj_pedido is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No existe este Pedido"
        )

    if obj_pedido.estado in [EstadosValidosPedidos.CANCELADO,
                             EstadosValidosPedidos.PAGADO]:
        raise HTTPException(
            status_code=400,
            detail="No se puede modificar un pedido que ya ha sido finalizado o cancelado"
        )

    if pedido_in.estado:
        if pedido_in.estado == EstadosValidosPedidos.CANCELADO:
            detalles = obj_pedido.detalles
            for detalle in detalles:
                detalle.estado = EstadosValidosDetalles.CANCELADO
                db.add(detalle)
            obj_pedido.estado = pedido_in.estado
        else:
            obj_pedido.estado = pedido_in.estado

    if pedido_in.mesero_id is not None:
        consulta_mesero = (select(Usuario)
                           .where(Usuario.id == pedido_in.mesero_id,
                                  Usuario.restaurante_id == current_user["restaurante_id"],
                                  Usuario.rol_id == 1))
        obj_mesero = db.exec(consulta_mesero).first()
        if obj_mesero is None:
            raise HTTPException(status_code=404, detail="Mesero no encontrado")
        obj_pedido.mesero_id = obj_mesero.id

    if pedido_in.mesa_id is not None:
        consulta_mesa = (select(Mesa)
                         .where(Mesa.id == pedido_in.mesa_id,
                                           Mesa.restaurante_id == current_user["restaurante_id"]))
        obj_mesa = db.exec(consulta_mesa).first()
        if obj_mesa is None:
            raise HTTPException(status_code=404, detail="Mesa no encontrada")
        obj_pedido.mesa_id = obj_mesa.id

    try:
        db.add(obj_pedido)
        db.commit()
        db.refresh(obj_pedido)

        return obj_pedido
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno al guardar los cambios en la base de datos")

@router.post("/{pedido_id}/detalles", response_model=PedidoRead)
def agregar_platos(pedido_id: int,
                   detalles_in: list[DetallePedidoCreate],
                   current_user: dict = Depends(get_current_user),
                   db: Session = Depends(get_session)):
    consulta_pedido = (select(Pedido)
                       .where(Pedido.id == pedido_id,
                              Pedido.restaurante_id == current_user["restaurante_id"]))
    obj_pedido = db.exec(consulta_pedido).first()
    if obj_pedido is None:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    if obj_pedido.estado in [EstadosValidosPedidos.CANCELADO, EstadosValidosPedidos.PAGADO]:
        raise HTTPException(status_code=400, detail="Accion no permitida, Pedido cerrado")

    for plato in detalles_in:
        consulta_plato = (select(Plato)
                          .where(Plato.id == plato.plato_id,
                                 Plato.restaurante_id == current_user["restaurante_id"]))
        obj_plato = db.exec(consulta_plato).first()
        if obj_plato is None:
            raise HTTPException(status_code=404, detail="Plato no encontrado")

        detalle_obj = DetallePedido(
            pedido_id=pedido_id,
            plato_id=obj_plato.id,
            precio_unitario=obj_plato.precio,
            cantidad=plato.cantidad,
            notas=plato.notas,
            estado=EstadosValidosDetalles.PENDIENTE
        )

        db.add(detalle_obj)

    if obj_pedido.estado == EstadosValidosPedidos.LISTO:
        obj_pedido.estado = EstadosValidosPedidos.EN_PREPARACION

    try:
        db.add(obj_pedido)
        db.commit()
        db.refresh(obj_pedido)

        return obj_pedido
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno al guardar los cambios en la base de datos")
