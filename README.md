# FastOrder 🚀
> **Sistema de Gestión de Pedidos en Tiempo Real para Restaurantes**

FastOrder es una solución de software moderna e integral diseñada para optimizar los flujos de trabajo en restaurantes. El sistema conecta de forma síncrona a meseros, cocineros y cajeros, eliminando los tickets de papel y automatizando la lógica de preparación, facturación y análisis de datos en tiempo real.

---

## 💡 Propuesta de Valor (El Problema vs. La Solución)

Los puntos de venta (POS) tradicionales suelen ser rígidos y costosos. FastOrder se diseñó desde la lógica del negocio gastronómico real para resolver tres grandes dolores de cabeza cotidianos:

1. **El Caos de los Adicionales:** Cuando un cliente pide un plato extra a mitad de su comida, suele perderse el control de qué se está cocinando y qué es nuevo. FastOrder maneja estados individuales por plato, permitiendo a la cocina identificar los agregados de último minuto al instante.
2. **Cuentas Separadas sin Complicar la Base de Datos:** Dividir la cuenta en mesas grandes suele colapsar los sistemas. FastOrder implementa una arquitectura que permite múltiples pedidos independientes asociados a una sola mesa física, manteniendo la integridad financiera (relación exacta 1:1 entre Pedido y Factura).
3. **Dependencia y Conectividad:** Diseñado para soportar despliegues híbridos. Puede correr localmente en la red del restaurante sin depender de internet, o escalar a la nube (modelo SaaS) para administrar múltiples sucursales de forma centralizada.

---

## 👥 Funcionalidades por Rol de Trabajo

El sistema adapta su interfaz y lógica según quién lo esté utilizando:

### 🏃‍♂️ 1. App del Mesero (Toma de Pedidos)
* **Gestión Visual de Mesas:** Mapa interactivo que muestra en tiempo real qué mesas están disponibles, ocupadas o en proceso de limpieza.
* **Unión de Mesas Dinámica:** Permite acoplar varias mesas físicas para grupos grandes bajo una única "Mesa Principal", bloqueando el resto en el mapa.
* **Cuentas Separadas Integradas:** Opción de abrir múltiples cuentas independientes en la misma mesa de forma nativa desde el inicio del servicio.
* **Comandas Ágiles:** Envío de platos con especificaciones detalladas para cocina (ej. *"sin cebolla"*, *"té helado sin azúcar"*) en un solo flujo.

### 🧑‍🍳 2. Pantalla de Cocina (KDS - Kitchen Display System)
* **Control de Estados Dinámico:** Flujo de preparación visual basado en colores:
  * 🟡 **Pendiente:** Platos recién solicitados.
  * 🟠 **En preparación:** El cocinero ya los tiene en el fuego.
  * 🟢 **Listo:** Comida en la barra de despacho.
* **Alerta de Adicionales:** Los platos agregados al final aparecen resaltados en amarillo brillante, impidiendo que el chef los pase por alto.
* **Control de Cocina Inteligente:** Optimizado para pantallas no táctiles de TV o monitores colgados en pared. El chef puede despachar platos usando un **teclado numérico inalámbrico (Bump Bar)** o un control remoto común.

### 💰 3. Módulo de Caja (Cobro y Auditoría)
* **Facturación Exacta:** Procesamiento inmediato de subtotales, cálculo diferenciado de impuestos (IVA 0% e IVA 15% según legislación local) y total neto.
* **Liberación Automatizada:** Al registrar el pago de la cuenta, el sistema evalúa si quedan más pedidos activos en esa mesa. Si es el último, libera automáticamente la mesa principal y todas sus mesas vinculadas.
* **Control de Pérdidas (Mermas):** Si un pedido debe ser cancelado, el cajero debe registrar un `motivo_anulacion` obligatorio para justificar la materia prima de cocina y cuadrar caja de forma transparente.

### 👔 4. Dashboard del Administrador (Estadísticas de Negocio)
* **Ventas y Ganancias Netas:** Visualización de ingresos totales filtrados por rangos de fecha.
* **Ranking de Platos Estrellas:** Identificación de los productos más vendidos para optimizar compras de inventario.
* **Métrica del Ticket Promedio:** Análisis del gasto promedio por mesa para medir la efectividad de ventas sugeridas.
* **Horas Pico:** Gráficos que revelan los momentos de mayor afluencia para planificación de turnos de personal.

---

## 🛠️ Detalles Técnicos y Stack Tecnológico

El proyecto está construido bajo una división estricta de responsabilidades, garantizando velocidad y consistencia en los datos:

* **Backend:** **FastAPI (Python)**, aprovechando su velocidad asíncrona, validación automática de datos con Pydantic y generación automática de documentación interactiva (Swagger).
* **Base de Datos:** **PostgreSQL**, corriendo sobre contenedores **Docker** (`postgres:16-alpine`) para un entorno de desarrollo aislado, rápido y consistente en Linux/Fedora.
* **ORM / Modelado:** **SQLModel**, que unifica SQLAlchemy y Pydantic para un manejo de datos seguro y tipado en Python.
* **Frontend Móvil:** **React Native (Expo)**, permitiendo compilar código nativo de alto rendimiento para pantallas táctiles y dispositivos de visualización en cocina (Smart TVs).
* **Comunicación en Tiempo Real:** **WebSockets** para transmisión bidireccional instantánea de comandas (Mesero ➡️ Cocina ➡️ Despacho).

---

## 💾 Modelo de Base de Datos (Estructura Conceptual Clave)

Para resolver las mesas unidas y las cuentas separadas sin romper la normalización de la base de datos, se utiliza una **relación autorreferencial** en la tabla de Mesas y una **arquitectura Cabecera-Detalle** entre Pedidos y Platos:

```text
[Mesa] (id, numero_mesa, estado, mesa_principal_id)
  │
  └── (mesa_principal_id apunta a Mesa.id para uniones físicas)
  
[Pedido] (id, mesa_id, estado_general, total_cuenta, fecha_creacion)
  │
  ├── (Relación 1:1 con Factura/Pago para seguridad contable)
  │
  └───[Detalle_pedido] (id, pedido_id, plato_id, cantidad, estado_cocina, notas)