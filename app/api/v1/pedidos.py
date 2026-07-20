import time
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlmodel import Session
from sqlalchemy.exc import SQLAlchemyError
from app.core.database import get_session
from app.api.deps import get_current_user
from app.models.pedido import Pedido, DetallePedido, PedidoCreate

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