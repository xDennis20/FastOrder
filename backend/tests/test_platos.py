from httpx import Response
from app.models.categoria import Categoria
from app.models.plato import TamanoPlato, Plato
from app.models.restaurante import Restaurante

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

def test_obtener_plato(client_mesero, plato_test):
    # Act:
    response: Response = client_mesero.get(url=f"/platos/{plato_test.id}")

    # Assert:
    assert response.status_code == 200

    data = response.json()

    assert data["id"] == plato_test.id
    assert data["nombre"] == plato_test.nombre
    assert data["activo"] is True
    assert data["categoria_id"] == plato_test.categoria_id
    assert data["restaurante_id"] == plato_test.restaurante_id

def test_obtener_plato_inactivo_dueno(client_dueno, plato_test_inactivo):
    # Act:
    response: Response = client_dueno.get(url=f"/platos/{plato_test_inactivo.id}")

    # Assert:
    assert response.status_code == 200

    data = response.json()

    assert data["id"] == plato_test_inactivo.id
    assert data["nombre"] == plato_test_inactivo.nombre
    assert data["activo"] is False
    assert data["categoria_id"] == plato_test_inactivo.categoria_id
    assert data["restaurante_id"] == plato_test_inactivo.restaurante_id

def test_obtener_plato_inactivo_mesero(client_mesero, plato_test_inactivo):
    # Act:
    response: Response = client_mesero.get(url=f"/platos/{plato_test_inactivo.id}")

    # Assert:
    assert response.status_code == 404
    assert response.json()["detail"] == "Este plato no existe"

def test_obtener_plato_inexistente(client_dueno):
    # Act:
    response: Response = client_dueno.get(url="/platos/99")

    # Assert:
    assert response.status_code == 404
    assert response.json()["detail"] == "Este plato no existe"

def test_obtener_platos(client_dueno, plato_test, plato_test_inactivo):
    # Act:
    response: Response = client_dueno.get("/platos")

    # Assert:
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == plato_test.id
    assert data[0]["activo"] is True

def test_obtener_platos_inactivos_dueno(client_dueno, plato_test, plato_test_inactivo):
    # Act:
    response: Response = client_dueno.get(url="/platos",
                                          params={"incluir_inactivos": True})

    # Assert:
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    ids_devueltos = {plato["id"] for plato in data}
    assert ids_devueltos == {plato_test.id, plato_test_inactivo.id}

def test_obtener_platos_inactivos_mesero(client_mesero):
    # Act:
    response: Response = client_mesero.get(url="/platos",
                                           params={"incluir_inactivos": True})

    # Assert:
    assert response.status_code == 403
    assert response.json()["detail"] == "No tiene permisos para esta opcion"

def test_obtener_platos_filtro_categoria(client_dueno, plato_test, session_test):
    # Arrange:
    obj_categoria2 = Categoria(nombre="prueba_test_2",
                               activo=True,
                               restaurante_id=plato_test.restaurante_id)

    session_test.add(obj_categoria2)
    session_test.commit()
    session_test.refresh(obj_categoria2)

    obj_plato2 = Plato(nombre="papas fritas",
                       precio=2.00,
                       tamano=TamanoPlato.NORMAL,
                       activo=True,
                       descripcion="string",
                       img_url="string",
                       categoria_id=obj_categoria2.id,
                       restaurante_id=plato_test.restaurante_id)

    session_test.add(obj_plato2)
    session_test.commit()
    session_test.refresh(obj_plato2)

    # Act:
    response: Response = client_dueno.get(url="/platos",
                                          params={"categoria_id": obj_categoria2.id})

    # Assert:
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == obj_plato2.id
    assert data[0]["categoria_id"] == obj_categoria2.id

def test_obtener_platos_otro_restaurante(client_dueno, plato_test, session_test):
    # Arrange:
    obj_restaurante2 = Restaurante(nombre="Restaurante_2")

    session_test.add(obj_restaurante2)
    session_test.commit()
    session_test.refresh(obj_restaurante2)

    obj_categoria2 = Categoria(nombre="prueba_test",
                              activo=True,
                              restaurante_id=obj_restaurante2.id)

    session_test.add(obj_categoria2)
    session_test.commit()
    session_test.refresh(obj_categoria2)

    obj_plato2 = Plato(nombre="papas fritas",
                       precio=2.00,
                       tamano=TamanoPlato.NORMAL,
                       activo=True,
                       descripcion="string",
                       img_url="string",
                       categoria_id=obj_categoria2.id,
                       restaurante_id=obj_restaurante2.id)

    session_test.add(obj_plato2)
    session_test.commit()
    session_test.refresh(obj_plato2)

    # Act:
    response: Response = client_dueno.get(url="/platos")

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 1
    assert data[0]["id"] == plato_test.id
    assert data[0]["restaurante_id"] == plato_test.restaurante_id
    assert data[0]["categoria_id"] == plato_test.categoria_id