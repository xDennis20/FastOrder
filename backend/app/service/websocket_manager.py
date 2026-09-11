from fastapi import WebSocket, WebSocketDisconnect

class ConnectionManager:
    def __init__(self):
        self.conexiones: dict[int, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, restaurante_id: int):
        await websocket.accept()
        if restaurante_id not in self.conexiones:
            self.conexiones[restaurante_id] = []
        self.conexiones[restaurante_id].append(websocket)

    def disconnect(self, websocket: WebSocket, restaurante_id: int):
        if restaurante_id in self.conexiones:
            if websocket in self.conexiones[restaurante_id]:
                self.conexiones[restaurante_id].remove(websocket)
            if not self.conexiones[restaurante_id]:
                del self.conexiones[restaurante_id]

    async def broadcast(self, mensaje: dict, restaurante_id: int):
        for conexion in self.conexiones.get(restaurante_id, []).copy():
            try:
                await conexion.send_json(mensaje)
            except (WebSocketDisconnect, RuntimeError):
                self.disconnect(conexion, restaurante_id)

manager = ConnectionManager()