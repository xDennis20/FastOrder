from httpx import Response
from app.models.categoria import Categoria
from app.models.plato import TamanoPlato, Plato

def payload_plato(nombre: str = "Salchipapa",
                     precio: float = 2.00,
                     tamano: TamanoPlato = TamanoPlato.NORMAL,
                     activo: bool = True,
                     descripcion: str = "string",
                     img_url: str = "string",
                     categoria_id: int = 1
                     ) -> dict:
    return {
        "nombre": nombre,
        "precio": precio,
        "tamano": tamano,
        "activo": activo,
        "descripcion": descripcion,
        "img_url": img_url,
        "categoria_id": categoria_id
    }

def test_crear_plato_exitoso(client_dueno, categoria_test):
    # Arrange:
    plato_dict = payload_plato(categoria_id=categoria_test.id)

    # Act:
    response: Response = client_dueno.post(url="/platos/",
                                           json=plato_dict)

    # Assert:
    assert response.status_code == 201

    data = response.json()

    assert data["nombre"] == plato_dict["nombre"]
    assert data["categoria_id"] == categoria_test.id
    assert "id" in data

def test_crear_plato_fallido_rol(client_mesero):
    # Arrange
    plato_dict = payload_plato()

    # Act:
    response: Response = client_mesero.post(url="/platos/",
                                            json=plato_dict)

    # Assert:
    assert response.status_code == 403
    assert response.json()["detail"] == "Permisos insuficientes"

def test_crear_plato_categoria_inexistente(client_dueno, restaurante_test):
    # Arrange
    plato_dict = payload_plato(categoria_id=999)

    # Act:
    response: Response = client_dueno.post(url="/platos/",
                                           json=plato_dict)

    # Assert:
    assert response.status_code == 404
    assert response.json()["detail"] == "Categoria no encontrada"

def test_crear_plato_duplicado(client_dueno, plato_test):
    # Arrange:
    plato_dict = payload_plato(nombre=plato_test.nombre,
                               tamano=plato_test.tamano,
                               categoria_id=plato_test.categoria_id)

    # Act:
    response: Response = client_dueno.post(url="/platos/",
                                           json=plato_dict)

    # Assert:
    assert response.status_code == 409
    assert response.json()["detail"] == "Ya existe este plato con ese nombre y tamaño en este restaurante"

def test_crear_plato_categoria_inactiva(client_dueno, restaurante_test, session_test):
    # Arrange:
    obj_categoria = Categoria(nombre="random",
                              activo=False,
                              restaurante_id=restaurante_test.id)

    session_test.add(obj_categoria)
    session_test.commit()
    session_test.refresh(obj_categoria)

    plato_dict = payload_plato(categoria_id=obj_categoria.id)

    # Act:
    response: Response = client_dueno.post(url="/platos/",
                                           json=plato_dict)

    # Assert:
    assert response.status_code == 400
    assert response.json()["detail"] == "Categoria inhabilitada"

def test_modificar_plato_exitoso(client_dueno, plato_test):
    # Arrange:
    datos_modificar = {"nombre": "Salchipapa doble",
                       "tamano": TamanoPlato.GRANDE}

    # Act:
    response: Response = client_dueno.patch(url=f"/platos/{plato_test.id}",
                                            json=datos_modificar)

    # Assert:
    assert response.status_code == 200

    data = response.json()

    assert data["nombre"] == datos_modificar["nombre"]
    assert data["tamano"] == datos_modificar["tamano"]
    assert data["id"] == plato_test.id
    assert data["categoria_id"] == plato_test.categoria_id
    assert data["descripcion"] == plato_test.descripcion

def test_modificar_plato_fallido_rol(client_mesero):
    # Arrange:
    datos_modificar = {"nombre": "Salchipapa doble",
                       "tamano": TamanoPlato.GRANDE}

    # Act:
    response: Response = client_mesero.patch(url="/platos/1",
                                             json=datos_modificar)
    # Assert:
    assert response.status_code == 403
    assert response.json()["detail"] == "Permisos insuficientes"

def test_modificar_plato_inexistente(client_dueno):
    # Arrange:
    datos_modificar = {"nombre": "Salchipapa doble",
                       "tamano": TamanoPlato.GRANDE}

    # Act:
    response: Response = client_dueno.patch(url="/platos/1",
                                            json=datos_modificar)

    # Assert:
    assert response.status_code == 404
    assert response.json()["detail"] == "Plato no encontrado"

def test_modificar_plato_datos_repetidos(client_dueno, plato_test, session_test):
    # Arrange:
    obj_plato = Plato(
        nombre="Salchipapa doble",
        precio=3.00,
        tamano=TamanoPlato.GRANDE,
        activo=True,
        descripcion="string",
        img_url="string",
        categoria_id=plato_test.categoria_id,
        restaurante_id=plato_test.restaurante_id
    )

    session_test.add(obj_plato)
    session_test.commit()
    session_test.refresh(obj_plato)

    datos_modificar = {"nombre": plato_test.nombre,
                       "tamano": plato_test.tamano,
                       "categoria_id": plato_test.categoria_id}

    # Act:
    response: Response = client_dueno.patch(url=f"/platos/{obj_plato.id}",
                                            json=datos_modificar)

    # Assert:
    assert response.status_code == 409
    assert response.json()["detail"] == "Plato ya existente con ese nombre o tamaño"

def test_modificar_plato_categoria_inexistente(client_dueno, plato_test):
    # Arrange:
    datos_modificar = {"nombre": "Salchipapa doble",
                       "tamano": TamanoPlato.GRANDE,
                       "categoria_id": 999}

    # Act:
    response: Response = client_dueno.patch(url=f"/platos/{plato_test.id}",
                                            json=datos_modificar)

    # Assert:
    assert response.status_code == 404
    assert response.json()["detail"] == "Categoria no encontrada"

def test_modificar_plato_categoria_inactiva(client_dueno, plato_test, session_test):
    # Arrange:
    obj_categoria = Categoria(nombre="random",
                              activo=False,
                              restaurante_id=plato_test.restaurante_id)

    session_test.add(obj_categoria)
    session_test.commit()
    session_test.refresh(obj_categoria)

    datos_modificar = {"nombre": "Salchipapa doble",
                       "tamano": TamanoPlato.GRANDE,
                       "categoria_id": obj_categoria.id}

    # Act:
    response: Response = client_dueno.patch(url=f"/platos/{plato_test.id}",
                                            json=datos_modificar)

    # Assert:
    assert response.status_code == 400
    assert response.json()["detail"] == "Categoria inhabilitada"

