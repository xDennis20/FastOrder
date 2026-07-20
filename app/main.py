from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.core.database import create_db_and_tables
from app.api.v1.categorias import router as router_categoria
from app.api.v1.platos import router as router_platos
from app.api.v1.restaurantes import router as router_restaurante
from app.api.v1.auth.router import router as router_auth
from app.api.v1.usuarios import router as router_usuario
from app.api.v1.pedidos import router as router_pedido

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Cargando base de datos y creando tablas")
    create_db_and_tables()
    print("Base de datos lista y tablas verificadas.")
    yield
    print("Apagando el servidor: Limpiando recursos...")

def create_app() -> FastAPI:
    app = FastAPI(title="FastOrder",
                  lifespan=lifespan)
    app.include_router(router=router_categoria)
    app.include_router(router=router_platos)
    app.include_router(router=router_restaurante)
    app.include_router(router=router_auth)
    app.include_router(router=router_usuario)
    app.include_router(router=router_pedido)

    return app

app = create_app()

