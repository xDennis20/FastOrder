import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import {
  obtenerPedidosRequest,
  cambiarEstadoPlatoRequest,
  cambiarEstadoPedidoRequest,
} from '../services/api';
import {
  configurarNotificaciones,
  dispararNotificacionPedido,
} from '../services/notificaciones';

// Calcular tiempo transcurrido desde la creación del pedido
function calcularTiempo(fechaIso) {
  if (!fechaIso) return '0 min';
  const creacion = new Date(fechaIso);
  const ahora = new Date();
  const diffMinutos = Math.floor((ahora - creacion) / 60000);
  return diffMinutos <= 0 ? 'Hace un momento' : `${diffMinutos} min`;
}

export default function PedidosScreen({ navigation }) {
  const { token } = useContext(AuthContext);

  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [permisoNotificaciones, setPermisoNotificaciones] = useState(false);
  const [wsConectado, setWsConectado] = useState(false);

  // Modal para cambiar estado de un plato individual
  const [platoSeleccionado, setPlatoSeleccionado] = useState(null);
  const [modalPlatoVisible, setModalPlatoVisible] = useState(false);

  const wsRef = useRef(null);

  // 1. Inicializar notificaciones
  useEffect(() => {
    async function inicializar() {
      const concedido = await configurarNotificaciones();
      setPermisoNotificaciones(concedido);
    }
    inicializar();
  }, []);

  // 2. Cargar comandas activas
  const cargarPedidos = async () => {
    try {
      const data = await obtenerPedidosRequest(token);
      // Ocultamos solo los pedidos que ya fueron cobrados o cancelados
      const activos = data.filter(
        (p) => p.estado !== 'Pagado' && p.estado !== 'Cancelado'
      );
      setPedidos(activos);
    } catch (error) {
      console.warn('Error al cargar comandas:', error.message);
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  };

  useEffect(() => {
    if (token) cargarPedidos();
  }, [token]);

  // 3. CONEXIÓN WEBSOCKET DE COCINA EN VIVO 🟢
  useEffect(() => {
    if (!token) return;

    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
    const wsUrl = apiUrl.replace(/^http/, 'ws') + `/ws/cocina?token=${token}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setWsConectado(true);

    ws.onmessage = async (event) => {
      try {
        const mensaje = JSON.parse(event.data);
        const pedidoRecibido = mensaje.data;
        if (!pedidoRecibido) return;

        const nombreMesa = pedidoRecibido.mesa_id ? `Mesa #${pedidoRecibido.mesa_id}` : 'Para Llevar';

        if (mensaje.evento === 'PEDIDO_CREADO') {
          // Agregar el nuevo pedido arriba de la lista
          setPedidos((prev) => [pedidoRecibido, ...prev]);

          await dispararNotificacionPedido({
            titulo: `🔔 ¡Nueva Comanda! - ${nombreMesa}`,
            cuerpo: `Se recibió orden #${pedidoRecibido.id} con ${pedidoRecibido.detalles?.length || 0} plato(s).`,
            datos: { pedidoId: pedidoRecibido.id },
          });
        } else if (mensaje.evento === 'PEDIDO_ACTUALIZADO' || mensaje.evento === 'PEDIDO_LISTO') {
          setPedidos((prev) =>
            prev.map((p) => (p.id === pedidoRecibido.id ? pedidoRecibido : p))
          );
        } else if (mensaje.evento === 'PEDIDO_PAGADO' || mensaje.evento === 'PEDIDO_CANCELADO') {
          // Quitar de cocina si ya fue pagado o cancelado
          setPedidos((prev) => prev.filter((p) => p.id !== pedidoRecibido.id));
        }
      } catch (err) {
        console.warn('Error en socket cocina:', err);
      }
    };

    ws.onerror = () => setWsConectado(false);
    ws.onclose = () => setWsConectado(false);

    return () => {
      if (ws) ws.close();
    };
  }, [token]);

  const alRefrescar = () => {
    setRefrescando(true);
    cargarPedidos();
  };

  // Abrir modal de un plato individual
  const abrirMenuPlato = (detalle) => {
    setPlatoSeleccionado(detalle);
    setModalPlatoVisible(true);
  };

  // Actualizar estado de un plato individual
  const actualizarEstadoPlato = async (nuevoEstado) => {
    if (!platoSeleccionado) return;

    try {
      await cambiarEstadoPlatoRequest(platoSeleccionado.id, nuevoEstado, token);

      // Actualizar localmente de inmediato
      setPedidos((prev) =>
        prev.map((ped) => ({
          ...ped,
          detalles: ped.detalles.map((d) =>
            d.id === platoSeleccionado.id ? { ...d, estado: nuevoEstado } : d
          ),
        }))
      );

      setModalPlatoVisible(false);
    } catch (error) {
      Alert.alert('Error', error.message || 'No se pudo actualizar el plato');
    }
  };

  // Despachar todos los platos de una orden con confirmación
  const despacharTodaLaOrden = (pedido) => {
    const nombreMesa = pedido.mesa_id ? `Mesa #${pedido.mesa_id}` : 'Para Llevar';

    Alert.alert(
      '¿Despachar toda la orden?',
      `¿Confirmas que TODOS los platos de ${nombreMesa} (Orden #${pedido.id}) están listos para servicio?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: '✓ Sí, Despachar Todo',
          onPress: async () => {
            try {
              if (pedido.detalles) {
                for (const d of pedido.detalles) {
                  if (d.estado !== 'Cancelado') {
                    await cambiarEstadoPlatoRequest(d.id, 'Listo', token);
                  }
                }
              }

              setPedidos((prev) =>
                prev.map((p) =>
                  p.id === pedido.id
                    ? {
                        ...p,
                        estado: 'Listo',
                        detalles: p.detalles.map((d) =>
                          d.estado !== 'Cancelado' ? { ...d, estado: 'Listo' } : d
                        ),
                      }
                    : p
                )
              );

              await dispararNotificacionPedido({
                titulo: `🍽️ ¡Comanda Completa Lista! - ${nombreMesa}`,
                cuerpo: `La orden #${pedido.id} está completa en barra lista para servir.`,
                datos: { pedidoId: pedido.id },
              });
            } catch (error) {
              Alert.alert('Error', error.message || 'No se pudo despachar la orden');
            }
          },
        },
      ]
    );
  };

  // Marcar pedido completo como servido en la mesa del cliente
  const marcarComoServido = async (pedido) => {
    try {
      await cambiarEstadoPedidoRequest(pedido.id, 'Servido', token);

      setPedidos((prev) =>
        prev.map((p) => (p.id === pedido.id ? { ...p, estado: 'Servido' } : p))
      );

      Alert.alert(
        '🍽️ Pedido Servido',
        `La orden #${pedido.id} ha sido entregada en la mesa del cliente.`
      );
    } catch (error) {
      Alert.alert('Error', error.message || 'No se pudo marcar como servido');
    }
  };

  const renderItem = ({ item }) => {
    const todosListos =
      item.detalles &&
      item.detalles.length > 0 &&
      item.detalles.every((d) => d.estado === 'Listo' || d.estado === 'Cancelado');

    const esServido = item.estado === 'Servido';
    let borderColor = '#ea580c'; // Naranja en preparación

    if (esServido) {
      borderColor = '#3b82f6'; // Azul comiendo en mesa
    } else if (todosListos) {
      borderColor = '#22c55e'; // Verde listo en barra
    }

    const nombreMesa = item.mesa_id ? `Mesa #${item.mesa_id}` : 'Para Llevar';
    const tiempo = calcularTiempo(item.fecha_creacion);

    return (
      <View style={[styles.ticketCard, { borderColor }]}>
        {/* Cabecera */}
        <View style={styles.ticketHeader}>
          <View>
            <Text style={styles.ticketNumber}>ORDEN #{item.id}</Text>
            <Text style={styles.ticketMesa}>{nombreMesa}</Text>
          </View>
          <View style={styles.timeBadge}>
            <Text style={styles.timeText}>⏱ {tiempo}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Lista de Platos individuales */}
        <View style={styles.itemsContainer}>
          {item.detalles?.map((detalle, index) => {
            const esPlatoListo = detalle.estado === 'Listo';
            const esPlatoCancelado = detalle.estado === 'Cancelado';
            const esEnCoccion = detalle.estado === 'En preparacion';

            return (
              <TouchableOpacity
                key={detalle.id || index}
                style={[
                  styles.platoRow,
                  esPlatoListo && styles.platoFilaListo,
                  esPlatoCancelado && styles.platoFilaCancelado,
                ]}
                onPress={() => abrirMenuPlato(detalle)}
                activeOpacity={0.7}
              >
                <Text style={styles.platoCantidad}>{detalle.cantidad}x</Text>
                <View style={styles.platoDetalle}>
                  <Text
                    style={[
                      styles.platoNombre,
                      esPlatoListo && styles.textoListo,
                      esPlatoCancelado && styles.textoCancelado,
                    ]}
                  >
                    {detalle.plato?.nombre || `Plato #${detalle.plato_id}`}
                  </Text>
                  {detalle.notas ? (
                    <Text style={styles.platoNota}>• {detalle.notas}</Text>
                  ) : null}
                </View>

                {/* Badge de estado del plato */}
                <View
                  style={[
                    styles.platoEstadoBadge,
                    esPlatoListo && { backgroundColor: '#14532d' },
                    esPlatoCancelado && { backgroundColor: '#7f1d1d' },
                    esEnCoccion && { backgroundColor: '#713f12' },
                  ]}
                >
                  <Text style={styles.platoEstadoTexto}>
                    {esPlatoListo ? '✓ LISTO' : esPlatoCancelado ? '✕ CANC.' : '🍳 COCINAR'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* BOTONES DE ACCIÓN DEL TICKET */}
        {todosListos && !esServido ? (
          // 1. Si todos están listos: Botón azul para que el mesero entregue en mesa
          <TouchableOpacity
            style={[styles.statusButton, { backgroundColor: '#2563eb' }]}
            onPress={() => marcarComoServido(item)}
            activeOpacity={0.8}
          >
            <Text style={styles.statusButtonText}>🍽️ MARCAR COMO SERVIDO EN MESA</Text>
          </TouchableOpacity>
        ) : esServido ? (
          // 2. Si ya está servido: Indicador informativo
          <View style={[styles.statusButton, { backgroundColor: '#1e293b' }]}>
            <Text style={[styles.statusButtonText, { color: '#94a3b8' }]}>
              ✓ SERVIDO AL CLIENTE (EN MESA)
            </Text>
          </View>
        ) : (
          // 3. Si aún hay platos pendientes: Botón naranja para despachar toda la orden
          <TouchableOpacity
            style={styles.statusButton}
            onPress={() => despacharTodaLaOrden(item)}
            activeOpacity={0.8}
          >
            <Text style={styles.statusButtonText}>DESPACHAR TODA LA ORDEN →</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Cabecera */}
      <View style={styles.headerInfo}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Monitor KDS de Cocina</Text>
          <View style={styles.wsIndicator}>
            <View style={[styles.dot, wsConectado ? styles.dotGreen : styles.dotGray]} />
            <Text style={styles.wsText}>{wsConectado ? 'EN VIVO' : 'OFFLINE'}</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>Toca un plato individual o despacha la comanda completa</Text>
      </View>

      {cargando ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#ea580c" />
          <Text style={styles.loadingText}>Conectando con cocina...</Text>
        </View>
      ) : (
        <FlatList
          data={pedidos}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={alRefrescar}
              tintColor="#ea580c"
              colors={['#ea580c']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>🎉 No hay comandas pendientes</Text>
              <Text style={styles.emptySubtext}>Cocina al día. Esperando pedidos...</Text>
            </View>
          }
        />
      )}

      {/* MODAL PARA CAMBIAR ESTADO DE UN PLATO INDIVIDUAL */}
      <Modal visible={modalPlatoVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitulo}>
              {platoSeleccionado?.cantidad}x{' '}
              {platoSeleccionado?.plato?.nombre || 'Plato Seleccionado'}
            </Text>
            <Text style={styles.modalSubtitulo}>Cambiar estado en cocina:</Text>

            <TouchableOpacity
              style={styles.btnModalListo}
              onPress={() => actualizarEstadoPlato('Listo')}
            >
              <Text style={styles.btnModalTexto}>✓ Marcar como LISTO</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnModalCoccion}
              onPress={() => actualizarEstadoPlato('En preparacion')}
            >
              <Text style={styles.btnModalTexto}>🍳 En Preparación / Cocción</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnModalCancelar}
              onPress={() => actualizarEstadoPlato('Cancelado')}
            >
              <Text style={styles.btnModalTexto}>✕ Cancelar este Plato</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnModalCerrar}
              onPress={() => setModalPlatoVisible(false)}
            >
              <Text style={styles.btnCerrarTexto}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  headerInfo: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#fafaf9',
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: '#78716c',
    fontSize: 12,
    marginTop: 4,
  },
  wsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1917',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#292524',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  dotGreen: {
    backgroundColor: '#22c55e',
  },
  dotGray: {
    backgroundColor: '#78716c',
  },
  wsText: {
    color: '#a8a29e',
    fontSize: 10,
    fontWeight: '800',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  ticketCard: {
    backgroundColor: '#1c1917',
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketNumber: {
    color: '#ea580c',
    fontSize: 16,
    fontWeight: '900',
  },
  ticketMesa: {
    color: '#fafaf9',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  timeBadge: {
    backgroundColor: '#292524',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  timeText: {
    color: '#d6d3d1',
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#292524',
    marginVertical: 12,
  },
  itemsContainer: {
    marginBottom: 14,
  },
  platoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 6,
    marginBottom: 4,
    backgroundColor: '#24201d',
  },
  platoFilaListo: {
    backgroundColor: '#14281c',
  },
  platoFilaCancelado: {
    backgroundColor: '#2d1818',
    opacity: 0.6,
  },
  platoCantidad: {
    color: '#ea580c',
    fontSize: 15,
    fontWeight: '800',
    width: 30,
  },
  platoDetalle: {
    flex: 1,
  },
  platoNombre: {
    color: '#fafaf9',
    fontSize: 14,
    fontWeight: '600',
  },
  textoListo: {
    color: '#4ade80',
    fontWeight: '700',
  },
  textoCancelado: {
    color: '#f87171',
    textDecorationLine: 'line-through',
  },
  platoNota: {
    color: '#a8a29e',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  platoEstadoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 6,
  },
  platoEstadoTexto: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  statusButton: {
    backgroundColor: '#ea580c',
    paddingVertical: 13,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 6,
  },
  statusButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#a8a29e',
    marginTop: 12,
  },
  emptyContainer: {
    paddingTop: 80,
    alignItems: 'center',
  },
  emptyText: {
    color: '#fafaf9',
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtext: {
    color: '#78716c',
    fontSize: 13,
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1c1917',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#292524',
  },
  modalTitulo: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSubtitulo: {
    color: '#a8a29e',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 18,
  },
  btnModalListo: {
    backgroundColor: '#15803d',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnModalCoccion: {
    backgroundColor: '#d97706',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnModalCancelar: {
    backgroundColor: '#b91c1c',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnModalTexto: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  btnModalCerrar: {
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  btnCerrarTexto: {
    color: '#a8a29e',
    fontSize: 14,
    fontWeight: '600',
  },
});