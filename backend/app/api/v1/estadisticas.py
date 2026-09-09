import math
from decimal import Decimal
from datetime import date, datetime, time, UTC
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select, func, case

from app.api.v1.auth.schemas import TokenData
from app.api.deps import VerificarRol
from app.models.usuario import RolesValidos
from app.models.estadistica import HistorialVentasRead, CierreCaja
from app.api.deps import get_session
from app.models.factura import Factura
from app.models.pedido import Pedido
from app.models.factura import TiposPagosValidos

router = APIRouter(prefix="/admin/estadisticas", tags=["estadisticas"])

@router.get("/historial-ventas", response_model=HistorialVentasRead)
def historial_ventas(fecha_inicio: date | None = None,
                     fecha_fin: date | None = None,
                     pagina: int | None = Query(default=1, ge=1),
                     tamano_pagina: int | None = Query(default=15, ge=1, le=100),
                     current_user: TokenData = Depends(VerificarRol([RolesValidos.SUPERADMIN, RolesValidos.DUENO])),
                     db: Session = Depends(get_session)):
    condiciones = [Factura.restaurante_id == current_user.restaurante_id]

    if fecha_inicio:
        inicio_dt = datetime.combine(fecha_inicio, time.min, tzinfo=UTC)
        condiciones.append(Factura.fecha_creacion >= inicio_dt)

    if fecha_fin:
        fin_dt = datetime.combine(fecha_fin, time.max, tzinfo=UTC)
        condiciones.append(Factura.fecha_creacion <= fin_dt)

    consulta_totales = select(
        func.count(Factura.id),
        func.coalesce(func.sum(Factura.total), Decimal("0.00"))
    ).where(*condiciones)

    total_registros, total_recaudado = db.exec(consulta_totales).one()

    offset = (pagina - 1) * tamano_pagina

    consulta_items = (
        select(Factura)
        .where(*condiciones)
        .options(
            selectinload(Factura.pedido).selectinload(Pedido.detalles)
        )
        .order_by(Factura.fecha_creacion.desc())
        .offset(offset)
        .limit(tamano_pagina)
    )

    items = db.exec(consulta_items).all()

    total_paginas = math.ceil(total_registros / tamano_pagina) if total_registros > 0 else 1

    return HistorialVentasRead(
        total_registros=total_registros,
        total_recaudado=total_recaudado,
        pagina_actual=pagina,
        total_paginas=total_paginas,
        tamano_pagina=tamano_pagina,
        tiene_siguiente=pagina < total_paginas,
        tiene_anterior=pagina > 1,
        items=items
    )

@router.get("/resumen-cierre", response_model=CierreCaja)
def resumen_cierre(
        fecha: date | None = None,
        current_user: TokenData = Depends(VerificarRol([RolesValidos.DUENO, RolesValidos.SUPERADMIN])),
        db: Session = Depends(get_session)
):
    condiciones = [Factura.restaurante_id == current_user.restaurante_id]
    fecha_cierre = fecha or datetime.now(UTC).date()

    fecha_inicio_dt = datetime.combine(fecha_cierre, time.min, tzinfo=UTC)
    fecha_final_dt = datetime.combine(fecha_cierre, time.max, tzinfo=UTC)
    condiciones.append(Factura.fecha_creacion >= fecha_inicio_dt)
    condiciones.append(Factura.fecha_creacion <= fecha_final_dt)

    consulta_cierre = (
        select(func.count(Factura.id),
               func.coalesce(func.sum(Factura.total), Decimal("0.00")),
               func.coalesce(func.sum(case((Factura.tipo_pago == TiposPagosValidos.EFECTIVO, Factura.total), else_=Decimal("0.00"))), Decimal("0.00")),
               func.coalesce(func.sum(case((Factura.tipo_pago == TiposPagosValidos.TRANSFERENCIA, Factura.total), else_=Decimal("0.00"))), Decimal("0.00"))
               ).where(*condiciones)
    )

    total_pedidos, total_recaudado, total_efectivo, total_transferencia  = db.exec(consulta_cierre).one()

    return CierreCaja(
        fecha=fecha_cierre,
        total_efectivo=total_efectivo,
        total_transferencia=total_transferencia,
        total_recaudado=total_recaudado,
        total_pedidos=total_pedidos,
        promedio_tickets=total_recaudado /  total_pedidos if total_pedidos > 0 else Decimal("0.00")
    )
