import pytest
from sqlalchemy import text
from sqlmodel import Session, create_engine, SQLModel
from fastapi.testclient import TestClient
from app.main import app
from app.api.v1.auth.schemas import TokenData
from app.models.restaurante import Restaurante
from app.models.categoria import Categoria
from app.models.plato import Plato, TamanoPlato
from app.models.usuario import RolesValidos
from app.api.deps import get_current_user
from app.api.deps import get_session
from app.core.config import DATABASE_URL_TEST
from app.api.v1.categorias import CACHE_CATEGORIAS

engine_test = create_engine(DATABASE_URL_TEST, echo=False)
SQLModel.metadata.create_all(engine_test)

RESTAURANTE_TEST_ID = 1

def token_usuario(rol: RolesValidos):
    return TokenData(
        user_id=1,
        email=f"{rol.value.lower()}@test.com",
        username=f"{rol.value.lower()}_test",
        restaurante_id=RESTAURANTE_TEST_ID,
        rol=rol
    )

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def session_test():
    with Session(engine_test) as session:
        yield session

@pytest.fixture
def client_dueno(client):
    token = token_usuario(RolesValidos.DUENO)
    app.dependency_overrides[get_current_user] = lambda: token
    yield client
    app.dependency_overrides.pop(get_current_user, None)

@pytest.fixture
def client_mesero(client):
    token = token_usuario(RolesValidos.MESERO)
    app.dependency_overrides[get_current_user] = lambda: token
    yield client
    app.dependency_overrides.pop(get_current_user, None)

@pytest.fixture(autouse=True)
def db_test(session_test):
    app.dependency_overrides[get_session] = lambda: session_test
    yield session_test
    app.dependency_overrides.pop(get_session, None)
    session_test.rollback()
    session_test.exec(text("TRUNCATE TABLE plato, categoria, restaurante RESTART IDENTITY CASCADE;"))
    session_test.commit()

@pytest.fixture(autouse=True)
def limpiar_cache():
    CACHE_CATEGORIAS.clear()

@pytest.fixture
def restaurante_test(session_test):
    obj_restaurante = Restaurante(nombre=f"restaurante_{RESTAURANTE_TEST_ID}_test",
                                  ruc="0034234256"
                                  )

    session_test.add(obj_restaurante)
    session_test.commit()
    session_test.refresh(obj_restaurante)

    yield obj_restaurante

@pytest.fixture
def categoria_test(session_test, restaurante_test):
    obj_categoria = Categoria(
        nombre=f"Entrada_{restaurante_test.id}",
        restaurante_id=restaurante_test.id,
        activo=True
    )

    session_test.add(obj_categoria)
    session_test.commit()
    session_test.refresh(obj_categoria)

    yield obj_categoria

@pytest.fixture
def plato_test(session_test,  restaurante_test, categoria_test):
    obj_plato = Plato(nombre="Salchipapa",
                      precio=2.00,
                      tamano=TamanoPlato.NORMAL,
                      activo=True,
                      descripcion="string",
                      img_url="string",
                      categoria_id=categoria_test.id,
                      restaurante_id=restaurante_test.id)

    session_test.add(obj_plato)
    session_test.commit()
    session_test.refresh(obj_plato)

    yield obj_plato