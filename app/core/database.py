from sqlmodel import create_engine, Session, SQLModel
from app.core.config import DATABASE_URL
from app.models.restaurante import Restaurante
from app.models.usuario import Usuario
from app.models.pedido import Pedido, DetallePedido
from app.models.mesa import Mesa
from app.models.plato import Plato
from app.models.categoria import Categoria
from app.models.rol import Rol
from app.models.factura import Factura


engine = create_engine(DATABASE_URL, echo=True)

def get_session():
    with Session(engine) as session:
        yield session

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)