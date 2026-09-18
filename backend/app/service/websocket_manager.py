from collections import defaultdict
from fastapi import WebSocket, WebSocketDisconnect

from app.models.websocket import CanalWS

class ConnectionManager:
    def __init__(self):
        self.conexiones_activas: defaultdict[tuple[int, CanalWS], list[WebSocket]] = defaultdict(list)

    async def connect(self, websocket: WebSocket, restaurante_id: int, canal: CanalWS):
        await websocket.accept()
        self.conexiones_activas[(restaurante_id, canal)].append(websocket)

    def disconnect(self, websocket: WebSocket, restaurante_id: int, canal: CanalWS):
        clave = (restaurante_id, canal)

        if clave in self.conexiones_activas and websocket in self.conexiones_activas[clave]:
            self.conexiones_activas[clave].remove(websocket)
            if not self.conexiones_activas[clave]:
                del self.conexiones_activas[clave]

    async def broadcast(self, mensaje: dict, restaurante_id: int, canal: CanalWS):
        for conexion in self.conexiones_activas.get((restaurante_id, canal), []).copy():
            try:
                await conexion.send_json(mensaje)
            except (WebSocketDisconnect, RuntimeError):
                self.disconnect(conexion, restaurante_id, canal)

manager = ConnectionManager()