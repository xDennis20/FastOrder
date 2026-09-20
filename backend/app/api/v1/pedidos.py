import datetime
import math
from fastapi import (APIRouter, Depends, HTTPException, status,
                     BackgroundTasks, Query)
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select, func
from sqlalchemy.exc import SQLAlchemyError
from app.api.deps import VerificarRol
from app.core.database import get_session
from app.models.mesa import Mesa, EstadosValidos, MesaRead
from app.api.v1.auth.schemas import TokenData
from app.models.websocket import (EventoPedidoWS, TipoEventoCocina, CanalWS,
                                  EventoMesaWS, TipoEventoMesas)
from app.models.pedido import (Pedido, DetallePedido, PedidoCreate, PedidoPagination,
                               EstadosValidosPedidos, PedidoRead, EstadosValidosDetalles,
                               DetalleEstadoUpdate, PedidoUpdate, DetallePedidoCreate)
from app.models.plato import Plato
from app.models.usuario import Usuario, RolesValidos
from app.models.factura import (FacturaCreate, Factura, FacturaRead)
from app.service.websocket_manager import manager

router = APIRouter(prefix="/pedidos", tags=["pedidos"])

@router.post("/", status_code=status.HTTP_201_CREATED)
def crear_pedido(
        pedido_in: PedidoCreate,
        background_tasks: BackgroundTasks,
        db: Session = Depends(get_session),
        current_user: TokenData = Depends(VerificarRol([RolesValidos.MESERO, RolesValidos.DUENO]))
):
    if not pedido_in.detalles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El pedido debe contener al menos un plato."
        )
    if pedido_in.mesa_id:
        consulta_mesa = (select(Mesa)
                         .where(Mesa.restaurante_id == current_user.restaurante_id,
                                Mesa.id == pedido_in.mesa_id,
                                Mesa.activo == True,
                                Mesa.estado != EstadosValidos.MANTENIMIENTO))

        mesa_obj = db.exec(consulta_mesa).first()

        if mesa_obj is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Mesa no existente o se encuentra en mantenimiento")

        if mesa_obj.mesa_principal_id is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="No se puede colocar pedidos a una mesa secundaria")


    if current_user.rol == RolesValidos.MESERO:
        mesero_asignado_id = current_user.user_id
    else:
        mesero_asignado_id = (
            pedido_in.mesero_id if pedido_in.mesero_id else current_user.user_id
        )

    platos_dict: dict[int, Plato] = {}
    platos_id = set()

    for item in pedido_in.detalles:
        platos_id.add(item.plato_id)

    consulta_plato = (select(Plato)
                      .where(Plato.restaurante_id == current_user.restaurante_id,
                             Plato.id.in_(platos_id),
                             Plato.activo == True))

    platos_obj = db.exec(consulta_plato).all()
    for plato in platos_obj:
        platos_dict[plato.id] = plato

    if len(platos_id) != len(platos_obj):
        faltantes = platos_id.difference(platos_dict.keys())
        faltantes_str = set()
        for faltante in faltantes:
            faltantes_str.add(str(faltante))
        raise HTTPException(
            status_code=404,
            detail=f"Los platos con ID ({', '.join(faltantes_str)}) no existen"
        )

    try:
        nuevo_pedido = Pedido(
            mesa_id=pedido_in.mesa_id,
            mesero_id=mesero_asignado_id,
            restaurante_id=current_user.restaurante_id,
            estado = EstadosValidosPedidos.PENDIENTE
        )

        db.add(nuevo_pedido)
        db.flush()

        for item in pedido_in.detalles:
            plato = platos_dict[item.plato_id]
            detalle_db = DetallePedido(
                    pedido_id=nuevo_pedido.id,
                    plato_id=plato.id,
                    cantidad=item.cantidad,
                    notas=item.notas,
                    estado=EstadosValidosDetalles.PENDIENTE,
                    precio_unitario= plato.precio
                )
            db.add(detalle_db)

        if pedido_in.mesa_id:
            cambio_estado_mesa = False
            mesas_obj = []

            if mesa_obj.estado in [EstadosValidos.DISPONIBLE, EstadosValidos.RESERVADA]:
                mesa_obj.estado = EstadosValidos.OCUPADA
                cambio_estado_mesa = True
                consulta_mesas_secundarias = (select(Mesa)
                                              .where(Mesa.restaurante_id == current_user.restaurante_id,
                                                     Mesa.activo == True,
                                                     Mesa.mesa_principal_id == pedido_in.mesa_id))
                mesas_obj = db.exec(consulta_mesas_secundarias).all()
                if mesas_obj:
                    for mesa in mesas_obj:
                        mesa.estado = EstadosValidos.OCUPADA
                        db.add(mesa)
                db.add(mesa_obj)

        db.commit()
        db.refresh(nuevo_pedido)

        pedido_dto = PedidoRead.model_validate(nuevo_pedido)

        evento = EventoPedidoWS(
            evento=TipoEventoCocina.PEDIDO_CREADO,
            data=pedido_dto
        )

        background_tasks.add_task(
            manager.broadcast,
            evento.model_dump(mode="json"),
            current_user.restaurante_id,
            CanalWS.COCINA,
        )

        if pedido_in.mesa_id:
            if cambio_estado_mesa:
                mesa_dto = MesaRead.model_validate(mesa_obj)
                evento = EventoMesaWS(
                    evento=TipoEventoMesas.MESA_ACTUALIZADA,
                    data=mesa_dto
                )
                background_tasks.add_task(
                    manager.broadcast,
                    evento.model_dump(mode="json"),
                    current_user.restaurante_id,
                    CanalWS.MESAS,
                )

                if mesas_obj:
                    for mesa in mesas_obj:
                        mesa_dto = MesaRead.model_validate(mesa)
                        evento = EventoMesaWS(
                            evento=TipoEventoMesas.MESA_ACTUALIZADA,
                            data=mesa_dto
                        )
                        background_tasks.add_task(
                            manager.broadcast,
                            evento.model_dump(mode="json"),
                            current_user.restaurante_id,
                            CanalWS.MESAS,
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

@router.post("/{pedido_id}/detalles", response_model=PedidoRead, status_code=status.HTTP_201_CREATED)
def agregar_platos(pedido_id: int,
                   background_tasks: BackgroundTasks,
                   detalles_in: list[DetallePedidoCreate],
                   current_user: TokenData = Depends(VerificarRol([RolesValidos.MESERO, RolesValidos.DUENO])),
                   db: Session = Depends(get_session)):
    consulta_pedido = (select(Pedido)
                       .where(Pedido.id == pedido_id,
                              Pedido.restaurante_id == current_user.restaurante_id))
    obj_pedido = db.exec(consulta_pedido).first()

    if obj_pedido is None:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    if obj_pedido.estado in [EstadosValidosPedidos.CANCELADO, EstadosValidosPedidos.PAGADO]:
        raise HTTPException(status_code=400, detail="Accion no permitida, Pedido cerrado")

    if not detalles_in:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe incluir al menos un plato para agregar al pedido.",
        )

    try:
        for plato in detalles_in:
            consulta_plato = (select(Plato)
                              .where(Plato.id == plato.plato_id,
                                     Plato.restaurante_id == current_user.restaurante_id))
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

        db.add(obj_pedido)
        db.commit()
        db.refresh(obj_pedido)

        pedido_dto = PedidoRead.model_validate(obj_pedido)

        evento = EventoPedidoWS(
            evento=TipoEventoCocina.PEDIDO_ACTUALIZADO,
            data=pedido_dto
        )

        background_tasks.add_task(
            manager.broadcast,
            evento.model_dump(mode="json"),
            current_user.restaurante_id,
            CanalWS.COCINA,
        )

        return pedido_dto
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno al guardar los cambios en la base de datos")


@router.post("/{pedido_id}/facturar", response_model=FacturaRead, status_code=status.HTTP_201_CREATED)
def cobrar_pedido(pedido_id: int,
                  background_tasks: BackgroundTasks,
                  factura_in: FacturaCreate,
                  current_user: TokenData = Depends(VerificarRol([RolesValidos.CAJA, RolesValidos.DUENO])),
                  db: Session = Depends(get_session)):
    consulta_pedido = (select(Pedido)
                       .where(Pedido.id == pedido_id,
                              Pedido.restaurante_id == current_user.restaurante_id))

    obj_pedido = db.exec(consulta_pedido).first()

    if obj_pedido is None:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    if obj_pedido.estado in [EstadosValidosPedidos.PAGADO, EstadosValidosPedidos.CANCELADO]:
        raise HTTPException(status_code=400, detail="Accion no permitida, Pedido ya cerrado")

    detalles = obj_pedido.detalles

    if not detalles:
        raise HTTPException(status_code=400, detail="No hay platos a cobrar")

    total = 0

    for plato in detalles:
        if plato.estado != EstadosValidosDetalles.CANCELADO:
            total += plato.cantidad * plato.precio_unitario

    if total <= 0:
        raise HTTPException(status_code=400, detail="No hay platos a cobrar")

    try:
        factura_nueva = Factura(pedido_id=pedido_id,
                tipo_pago=factura_in.tipo_pago,
                comprobante_img_url=factura_in.comprobante_img_url,
                total=total)

        obj_pedido.estado = EstadosValidosPedidos.PAGADO

        db.add(factura_nueva)
        db.add(obj_pedido)
        mesas_secundarias = []
        if obj_pedido.mesa_id:
            consulta_mesa_secundarias = (select(Mesa)
                                         .where(Mesa.restaurante_id == current_user.restaurante_id,
                                                Mesa.mesa_principal_id == obj_pedido.mesa_id,
                                                Mesa.activo == True))

            mesas_secundarias = db.exec(consulta_mesa_secundarias).all()
            mesa_principal = obj_pedido.mesa
            mesa_principal.estado = EstadosValidos.DISPONIBLE
            db.add(mesa_principal)
            if mesas_secundarias:
                for mesa in mesas_secundarias:
                    mesa.estado = EstadosValidos.DISPONIBLE
                    mesa.mesa_principal_id = None
                    db.add(mesa)

        db.commit()
        db.refresh(factura_nueva)
        db.refresh(obj_pedido)

        pedido_dto = PedidoRead.model_validate(obj_pedido)
        evento = EventoPedidoWS(
            evento=TipoEventoCocina.PEDIDO_PAGADO,
            data=pedido_dto,
        )

        background_tasks.add_task(
            manager.broadcast,
            evento.model_dump(mode="json"),
            current_user.restaurante_id,
            CanalWS.COCINA,
        )
        if obj_pedido.mesa_id:
            mesa_dto = MesaRead.model_validate(mesa_principal)
            evento = EventoMesaWS(
                evento=TipoEventoMesas.MESA_ACTUALIZADA,
                data= mesa_dto,
            )

            background_tasks.add_task(
                manager.broadcast,
                evento.model_dump(mode="json"),
                current_user.restaurante_id,
                CanalWS.MESAS,
            )

            if mesas_secundarias:
                for mesa in mesas_secundarias:
                    mesa_dto = MesaRead.model_validate(mesa)
                    evento = EventoMesaWS(
                        evento=TipoEventoMesas.MESA_ACTUALIZADA,
                        data=mesa_dto,
                    )

                    background_tasks.add_task(
                        manager.broadcast,
                        evento.model_dump(mode="json"),
                        current_user.restaurante_id,
                        CanalWS.MESAS,
                    )

        return factura_nueva

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno al guardar los cambios en la base de datos")

@router.get("", response_model=PedidoPagination)
def obtener_pedidos(estado: list[EstadosValidosPedidos] | None = Query(default=None, description="Estados a filtrar"),
                    mesa_id: int | None = None,
                    mesero_id: int | None = None,
                    fecha: datetime.date | None = None,
                    limit: int = Query(10, ge=1, le=20, description="Cantidad de paginas por pedido"),
                    page: int = Query(1, ge=1, description="Numero de paginas (1>=)"),
                    current_user: TokenData = Depends(VerificarRol([RolesValidos.MESERO, RolesValidos.COCINERO, RolesValidos.DUENO, RolesValidos.CAJA])),
                    db: Session = Depends(get_session)
                    ):
    consulta = select(Pedido).where(Pedido.restaurante_id == current_user.restaurante_id)
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

@router.get("/{pedido_id}", response_model=PedidoRead)
def obtener_pedido(pedido_id: int,
                   current_user: TokenData = Depends(VerificarRol([RolesValidos.MESERO, RolesValidos.COCINERO, RolesValidos.CAJA, RolesValidos.DUENO])),
                   db: Session = Depends(get_session)):
    consulta_pedido = (select(Pedido)
                       .where(Pedido.id == pedido_id,
                              Pedido.restaurante_id == current_user.restaurante_id))
    obj_pedido = db.exec(consulta_pedido).first()

    if obj_pedido is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No existe este Pedido"
        )

    return obj_pedido

@router.patch("/detalles/{detalle_id}/estado", response_model=PedidoRead, status_code=status.HTTP_200_OK)
def cambiar_plato_estado(detalle_id: int,
                         background_tasks: BackgroundTasks,
                         datos: DetalleEstadoUpdate,
                         current_user: TokenData = Depends(VerificarRol([RolesValidos.COCINERO, RolesValidos.DUENO])),
                         db: Session = Depends(get_session)):
    consulta = select(DetallePedido).where(DetallePedido.id == detalle_id)
    obj_detalle = db.exec(consulta).first()
    if obj_detalle is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No existe este Detalle Pedido"
        )
    pedido = obj_detalle.pedido
    if pedido.restaurante_id != current_user.restaurante_id:
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

        pedido_dto = PedidoRead.model_validate(pedido)

        if pedido_dto.estado == EstadosValidosPedidos.LISTO:
            tipo_evento = TipoEventoCocina.PEDIDO_LISTO
        elif pedido_dto.estado == EstadosValidosPedidos.CANCELADO:
            tipo_evento = TipoEventoCocina.PEDIDO_CANCELADO
        else:
            tipo_evento = TipoEventoCocina.PEDIDO_ACTUALIZADO

        evento = EventoPedidoWS(
            evento=tipo_evento,
            data=pedido_dto,
        )

        background_tasks.add_task(
            manager.broadcast,
            evento.model_dump(mode="json"),
            current_user.restaurante_id,
            CanalWS.COCINA,
        )

        return pedido_dto
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno al guardar en la base de datos")

@router.patch("/{pedido_id}", response_model=PedidoRead, status_code=status.HTTP_200_OK)
def cambiar_cabecera_pedido(pedido_id: int,
                            background_tasks: BackgroundTasks,
                            pedido_in: PedidoUpdate,
                            current_user: TokenData = Depends(VerificarRol([RolesValidos.MESERO, RolesValidos.DUENO])),
                            db: Session = Depends(get_session)):
    consulta = select(Pedido).where(Pedido.id == pedido_id, Pedido.restaurante_id == current_user.restaurante_id)
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
        if pedido_in.estado == EstadosValidosPedidos.PAGADO:
            raise HTTPException(
                status_code=400,
                detail="Para cobrar el pedido utilice el módulo de facturación.",
            )

        if pedido_in.estado == EstadosValidosPedidos.CANCELADO:
            for detalle in obj_pedido.detalles:
                detalle.estado = EstadosValidosDetalles.CANCELADO
                db.add(detalle)

        obj_pedido.estado = pedido_in.estado

    if pedido_in.mesero_id is not None:
        consulta_mesero = (select(Usuario)
                           .where(Usuario.id == pedido_in.mesero_id,
                                  Usuario.restaurante_id == current_user.restaurante_id,
                                  Usuario.rol == RolesValidos.MESERO))
        obj_mesero = db.exec(consulta_mesero).first()
        if obj_mesero is None:
            raise HTTPException(status_code=404, detail="Mesero no encontrado")
        obj_pedido.mesero_id = obj_mesero.id

    if pedido_in.mesa_id is not None:
        consulta_mesa = (select(Mesa)
                         .where(Mesa.id == pedido_in.mesa_id,
                                           Mesa.restaurante_id == current_user.restaurante_id))
        obj_mesa = db.exec(consulta_mesa).first()
        if obj_mesa is None:
            raise HTTPException(status_code=404, detail="Mesa no encontrada")
        obj_pedido.mesa_id = obj_mesa.id

    try:
        db.add(obj_pedido)
        db.commit()
        db.refresh(obj_pedido)

        pedido_dto = PedidoRead.model_validate(obj_pedido)

        if pedido_dto.estado == EstadosValidosPedidos.LISTO:
            tipo_evento = TipoEventoCocina.PEDIDO_LISTO
        elif pedido_dto.estado == EstadosValidosPedidos.CANCELADO:
            tipo_evento = TipoEventoCocina.PEDIDO_CANCELADO
        else:
            tipo_evento = TipoEventoCocina.PEDIDO_ACTUALIZADO

        evento = EventoPedidoWS(
            evento=tipo_evento,
            data=pedido_dto,
        )

        background_tasks.add_task(
            manager.broadcast,
            evento.model_dump(mode="json"),
            current_user.restaurante_id,
            CanalWS.COCINA,
        )

        return pedido_dto
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error interno al guardar los cambios en la base de datos")
