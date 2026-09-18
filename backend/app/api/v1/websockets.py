from fastapi import (APIRouter, WebSocket, Depends,
                     WebSocketDisconnect)
from app.models.usuario import RolesValidos
from app.api.deps import VerificarRolWS
from app.api.v1.auth.schemas import TokenData
from app.service.websocket_manager import manager
from app.models.websocket import CanalWS

router = APIRouter()


@router.websocket("/ws/cocina")
async def websockets_cocina(websocket: WebSocket,
                          current_user: TokenData = Depends(VerificarRolWS([RolesValidos.SUPERADMIN,
                                                                            RolesValidos.COCINERO,
                                                                            RolesValidos.MESERO,
                                                                            RolesValidos.DUENO]))
                            ):
    await manager.connect(websocket, current_user.restaurante_id, CanalWS.COCINA)

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, current_user.restaurante_id, CanalWS.COCINA)

@router.websocket("/ws/mesas")
async def websocket_mesas(websocket: WebSocket,
                          current_user: TokenData = Depends(VerificarRolWS([RolesValidos.SUPERADMIN,
                                                                            RolesValidos.DUENO,
                                                                            RolesValidos.MESERO,
                                                                            RolesValidos.CAJA]))
                          ):
    await manager.connect(websocket, current_user.restaurante_id, CanalWS.MESAS)

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, current_user.restaurante_id, CanalWS.MESAS)
