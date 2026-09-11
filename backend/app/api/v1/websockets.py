import jwt
from fastapi import (APIRouter, WebSocket, Depends,
                     WebSocketDisconnect, Query, status)
from jwt.exceptions import InvalidTokenError
from pydantic import ValidationError
from app.models.usuario import RolesValidos
from app.api.deps import VerificarRolWS
from app.api.v1.auth.schemas import TokenData
from app.service.websocket_manager import manager

router = APIRouter()


@router.websocket("/ws/cocina")
async def websockets_echo(websocket: WebSocket,
                          current_user: TokenData = Depends(VerificarRolWS([RolesValidos.SUPERADMIN, RolesValidos.COCINERO, RolesValidos.MESERO, RolesValidos.DUENO]))):
    await manager.connect(websocket, current_user.restaurante_id)

    try:
        while True:
            data = await websocket.receive_json()
            await manager.broadcast(data, current_user.restaurante_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket, current_user.restaurante_id)
