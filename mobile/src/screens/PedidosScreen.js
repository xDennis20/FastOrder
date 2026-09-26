import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Linking,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { obtenerPedidosRequest, cambiarEstadoPlatoRequest } from '../services/api';
import {
  configurarNotificaciones,
  dispararNotificacionPedido,
} from '../services/notificaciones';

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

  const wsRef = useRef(null);

  // 1. Inicializar notificaciones
  useEffect(() => {
    async function inicializar() {
      const concedido = await configurarNotificaciones();
      setPermisoNotificaciones(concedido);
    }
    inicializar();
  }, []);

  // 2. Cargar comandas iniciales por HTTP
  const cargarPedidos = async () => {
    try {
      const data = await obtenerPedidosRequest(token);
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
    if (token) {
      cargarPedidos();
    }
  }, [token]);

  // 3. CONEXIÓN WEBSOCKET EN TIEMPO REAL 🚀
  useEffect(() => {
    if (!token) return;

    // Convertir http:// en ws://
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
    const wsUrl = apiUrl.replace(/^http/, 'ws') + `/ws/cocina?token=${token}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ WebSocket de Cocina conectado');
      setWsConectado(true);
    };

    ws.onmessage = async (event) => {
      try {
        const mensaje = JSON.parse(event.data);
        console.log('⚡ Evento recibido por WebSocket:', mensaje.evento);

        const pedidoRecibido = mensaje.data;
        if (!pedidoRecibido) return;

        const nombreMesa = pedidoRecibido.mesa_id ? `Mesa #${pedidoRecibido.mesa_id}` : 'Para Llevar';

        if (mensaje.evento === 'PEDIDO_CREADO') {
          // Agregar nuevo pedido arriba de la lista
          setPedidos((prev) => [pedidoRecibido, ...prev]);

          // Sonido y alerta nativa de comanda nueva
          await dispararNotificacionPedido({
            titulo: `🔔 ¡Nueva Comanda! - ${nombreMesa}`,
            cuerpo: `Se ha recibido el pedido #${pedidoRecibido.id} con ${pedidoRecibido.detalles?.length || 0} plato(s).`,
            datos: { pedidoId: pedidoRecibido.id },
          });
        } else if (mensaje.evento === 'PEDIDO_ACTUALIZADO' || mensaje.evento === 'PEDIDO_LISTO') {
          // Actualizar pedido existente en la lista
          setPedidos((prev) =>
            prev.map((p) => (p.id === pedidoRecibido.id ? pedidoRecibido : p))
          );
        } else if (mensaje.evento === 'PEDIDO_PAGADO' || mensaje.evento === 'PEDIDO_CANCELADO') {
          // Quitar de cocina si ya fue pagado o cancelado
          setPedidos((prev) => prev.filter((p) => p.id !== pedidoRecibido.id));
        }
      } catch (err) {
        console.warn('Error procesando mensaje de WebSocket:', err);
      }
    };

    ws.onerror = (e) => {
      console.warn('❌ Error en WebSocket:', e.message);
      setWsConectado(false);
    };

    ws.onclose = () => {
      console.log('🔌 WebSocket cerrado');
      setWsConectado(false);
    };

    // Al salir de la pantalla, cerramos la conexión
    return () => {
      if (ws) ws.close();
    };
  }, [token]);

  // Pull-to-refresh
  const alRefrescar = () => {
    setRefrescando(true);
    cargarPedidos();
  };

  // 4. Cambiar estado de plato
  const cambiarEstado = async (pedido) => {
    const esListo = pedido.estado === 'Listo';
    const nuevoEstado = esListo ? 'En preparacion' : 'Listo';

    try {
      if (pedido.detalles && pedido.detalles.length > 0) {
        for (const detalle of pedido.detalles) {
          await cambiarEstadoPlatoRequest(detalle.id, nuevoEstado, token);
        }
      }

      setPedidos((prev) =>
        prev.map((item) =>
          item.id === pedido.id ? { ...item, estado: nuevoEstado } : item
        )
      );

      if (nuevoEstado === 'Listo') {
        const nombreMesa = pedido.mesa_id ? `Mesa #${pedido.mesa_id}` : 'Para Llevar';
        await dispararNotificacionPedido({
          titulo: `🍽️ ¡Plato Despachado! - ${nombreMesa}`,
          cuerpo: `La orden #${pedido.id} está lista en barra para servicio.`,
          datos: { pedidoId: pedido.id, mesa: nombreMesa },
        });
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'No se pudo actualizar la comanda');
    }
  };

  const renderItem = ({ item }) => {
    const esListo = item.estado === 'Listo';
    const borderColor = esListo ? '#22c55e' : '#ea580c';
    const nombreMesa = item.mesa_id ? `Mesa #${item.mesa_id}` : 'Para Llevar';
    const tiempo = calcularTiempo(item.fecha_creacion);

    return (
      <View style={[styles.ticketCard, { borderColor }]}>
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

        <View style={styles.itemsContainer}>
          {item.detalles && item.detalles.length > 0 ? (
            item.detalles.map((detalle, index) => (
              <View key={detalle.id || index} style={styles.platoRow}>
                <Text style={styles.platoCantidad}>{detalle.cantidad}x</Text>
                <View style={styles.platoDetalle}>
                  <Text style={styles.platoNombre}>
                    {detalle.plato?.nombre || `Plato #${detalle.plato_id}`}
                  </Text>
                  {detalle.notas ? (
                    <Text style={styles.platoNota}>• {detalle.notas}</Text>
                  ) : null}
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.platoNota}>Sin detalles especificados</Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.statusButton, esListo && styles.buttonListo]}
          onPress={() => cambiarEstado(item)}
          activeOpacity={0.8}
        >
          <Text style={styles.statusButtonText}>
            {esListo ? '✓ PLATO DESPACHADO (LISTO)' : 'MARCAR COMO LISTO'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerInfo}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Línea de Comandas Activas</Text>
          {/* Indicador de conexión WebSocket */}
          <View style={styles.wsIndicator}>
            <View style={[styles.dot, wsConectado ? styles.dotGreen : styles.dotGray]} />
            <Text style={styles.wsText}>{wsConectado ? 'EN VIVO' : 'OFFLINE'}</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>Actualización automática por WebSockets</Text>
      </View>

      {!permisoNotificaciones && (
        <View style={styles.bannerAviso}>
          <Text style={styles.textoBanner}>
            ⚠️ Notificaciones desactivadas. Las campanas de cocina no sonarán.
          </Text>
        </View>
      )}

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
              <Text style={styles.emptySubtext}>
                Esperando nuevos pedidos en tiempo real...
              </Text>
            </View>
          }
        />
      )}
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
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#78716c',
    fontSize: 12,
    marginTop: 4,
  },
  bannerAviso: {
    backgroundColor: '#3b2914',
    marginHorizontal: 20,
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d97706',
  },
  textoBanner: {
    color: '#fbbf24',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
    flexGrow: 1,
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
    letterSpacing: 0.5,
  },
  ticketMesa: {
    color: '#fafaf9',
    fontSize: 14,
    fontWeight: '600',
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
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  platoCantidad: {
    color: '#ea580c',
    fontSize: 15,
    fontWeight: '800',
    width: 28,
  },
  platoDetalle: {
    flex: 1,
  },
  platoNombre: {
    color: '#fafaf9',
    fontSize: 15,
    fontWeight: '600',
  },
  platoNota: {
    color: '#a8a29e',
    fontSize: 12,
    marginTop: 2,
    fontStyle: 'italic',
  },
  statusButton: {
    backgroundColor: '#ea580c',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonListo: {
    backgroundColor: '#15803d',
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
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
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
    textAlign: 'center',
  },
});