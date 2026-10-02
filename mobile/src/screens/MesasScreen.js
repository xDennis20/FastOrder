import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import {
  obtenerMesasRequest,
  vincularMesaRequest,
  cambiarEstadoMesaRequest,
} from '../services/api';

export default function MesasScreen({ navigation }) {
  const { token } = useContext(AuthContext);

  const [mesas, setMesas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [wsConectado, setWsConectado] = useState(false);

  // Mesa seleccionada para el menú modal de acciones
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Modal para vincular
  const [modalVincularVisible, setModalVincularVisible] = useState(false);

  const wsRef = useRef(null);

  // 1. Cargar mesas iniciales
  const cargarMesas = async () => {
    try {
      const data = await obtenerMesasRequest(token);
      setMesas(data.filter((m) => m.activo));
    } catch (error) {
      console.warn('Error al cargar mesas:', error.message);
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  };

  useEffect(() => {
    if (token) cargarMesas();
  }, [token]);

  // 2. CONEXIÓN WEBSOCKET DE MESAS EN VIVO 🟢
  useEffect(() => {
    if (!token) return;

    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
    const wsUrl = apiUrl.replace(/^http/, 'ws') + `/ws/mesas?token=${token}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ WebSocket de Mesas conectado');
      setWsConectado(true);
    };

    ws.onmessage = (event) => {
      try {
        const mensaje = JSON.parse(event.data);
        console.log('⚡ Evento de mesa recibido:', mensaje.evento);

        const mesaActualizada = mensaje.data;
        if (!mesaActualizada) return;

        // Actualizar la mesa que cambió de color o estado en vivo
        setMesas((prev) =>
          prev.map((m) => (m.id === mesaActualizada.id ? mesaActualizada : m))
        );
      } catch (err) {
        console.warn('Error procesando socket de mesas:', err);
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
    cargarMesas();
  };

  // Abrir opciones de la mesa tocada
  const abrirAccionesMesa = (mesa) => {
    setMesaSeleccionada(mesa);
    setModalVisible(true);
  };

  // Acción: Desvincular mesa
  const desvincularMesa = async () => {
    try {
      await vincularMesaRequest(mesaSeleccionada.id, null, token);
      setModalVisible(false);
      Alert.alert('Éxito', `Mesa #${mesaSeleccionada.numero_mesa} desvinculada.`);
      cargarMesas();
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  // Acción: Vincular a otra mesa principal
  const ejecutarVinculacion = async (mesaPrincipalId) => {
    try {
      await vincularMesaRequest(mesaSeleccionada.id, mesaPrincipalId, token);
      setModalVincularVisible(false);
      setModalVisible(false);
      Alert.alert('Éxito', 'Mesas vinculadas correctamente.');
      cargarMesas();
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  // Renderizado de cada mesa tipo Tarjeta KDS
  const renderMesa = ({ item }) => {
    const estado = String(item.estado || '').toUpperCase();
    const esOcupada = estado === 'OCUPADA';
    const esMantenimiento = estado === 'FUERA_DE_SERVICIO' || estado === 'MANTENIMIENTO';
    const esReservada = estado === 'RESERVADA';
    const esSecundaria = item.mesa_principal_id !== null;

    let colorBorde = '#22c55e'; // Verde (disponible)
    let textoEstado = 'DISPONIBLE';

    if (esOcupada) {
      colorBorde = '#ef4444'; // Rojo (ocupada)
      textoEstado = 'OCUPADA';
    } else if (esMantenimiento) {
      colorBorde = '#78716c'; // Gris (fuera de servicio)
      textoEstado = 'EN MANT.';
    } else if (esReservada) {
      colorBorde = '#f59e0b'; // Amarillo (reservada)
      textoEstado = 'RESERVADA';
    }

    return (
      <TouchableOpacity
        style={[styles.tarjetaMesa, { borderColor: colorBorde }]}
        onPress={() => abrirAccionesMesa(item)}
        activeOpacity={0.7}
      >
        <View style={styles.mesaHeader}>
          <Text style={styles.numeroMesa}>M#{item.numero_mesa}</Text>
          <View style={[styles.badgeEstado, { backgroundColor: colorBorde }]}>
            <Text style={styles.badgeTexto}>{textoEstado}</Text>
          </View>
        </View>

        {esSecundaria && (
          <Text style={styles.secundariaTexto}>🔗 Unida a M#{item.mesa_principal_id}</Text>
        )}

        <Text style={styles.toqueDetalle}>Toca para gestionar →</Text>
      </TouchableOpacity>
    );
  };

  if (cargando) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#ea580c" />
        <Text style={styles.loadingText}>Cargando plano de mesas...</Text>
      </View>
    );
  }

  // Estado de la mesa seleccionada para el modal
  const estadoMesaSel = String(mesaSeleccionada?.estado || '').toUpperCase();
  const mesaEsOcupada = estadoMesaSel === 'OCUPADA';
  const mesaEsMantenimiento = estadoMesaSel === 'FUERA_DE_SERVICIO' || estadoMesaSel === 'MANTENIMIENTO';

  return (
    <View style={styles.container}>
      {/* Cabecera con estado en vivo */}
      <View style={styles.headerInfo}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Plano de Salón</Text>
          <View style={styles.wsIndicator}>
            <View style={[styles.dot, wsConectado ? styles.dotGreen : styles.dotGray]} />
            <Text style={styles.wsText}>{wsConectado ? 'EN VIVO' : 'OFFLINE'}</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>Gestiona comandas y estados de salón en tiempo real</Text>
      </View>

      {/* Grid de Mesas */}
      <FlatList
        data={mesas}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderMesa}
        numColumns={2}
        contentContainerStyle={styles.gridContent}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={alRefrescar}
            tintColor="#ea580c"
            colors={['#ea580c']}
          />
        }
      />

      {/* MODAL DE ACCIONES DE LA MESA SELECCIONADA */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitulo}>
              Mesa #{mesaSeleccionada?.numero_mesa} ({estadoMesaSel})
            </Text>

            {/* Si está en mantenimiento, avisar */}
            {mesaEsMantenimiento && (
              <View style={styles.avisoMantenimiento}>
                <Text style={styles.avisoMantenimientoTexto}>
                  🛠️ Esta mesa está fuera de servicio.
                </Text>
              </View>
            )}

            {/* Si está libre: Tomar Pedido enviando la mesa seleccionada */}
            {!mesaEsOcupada && !mesaEsMantenimiento && (
              <TouchableOpacity
                style={styles.modalBtnPrimario}
                onPress={() => {
                  setModalVisible(false);
                  navigation.navigate('TomarPedido', {
                    mesaId: mesaSeleccionada.id,
                    numeroMesa: mesaSeleccionada.numero_mesa,
                  });
                }}
              >
                <Text style={styles.modalBtnTexto}>📝 Tomar Pedido / Abrir Cuenta</Text>
              </TouchableOpacity>
            )}

            {/* Si está ocupada: Ir a cobrar enviando la mesa seleccionada */}
            {mesaEsOcupada && (
              <TouchableOpacity
                style={styles.modalBtnCobrar}
                onPress={() => {
                  setModalVisible(false);
                  navigation.navigate('Cobro', {
                    mesaId: mesaSeleccionada.id,
                  });
                }}
              >
                <Text style={styles.modalBtnTexto}>💰 Cobrar Comanda y Liberar</Text>
              </TouchableOpacity>
            )}

            {/* Vincular a otra mesa (Solo si no es secundaria y no está en mantenimiento) */}
            {mesaSeleccionada?.mesa_principal_id === null && !mesaEsMantenimiento && (
              <TouchableOpacity
                style={styles.modalBtnSecundario}
                onPress={() => setModalVincularVisible(true)}
              >
                <Text style={styles.modalBtnSecundarioTexto}>🔗 Vincular con otra Mesa</Text>
              </TouchableOpacity>
            )}

            {/* Desvincular si ya era secundaria */}
            {mesaSeleccionada?.mesa_principal_id !== null && (
              <TouchableOpacity style={styles.modalBtnDesvincular} onPress={desvincularMesa}>
                <Text style={styles.modalBtnTexto}>⛓️ Desvincular Mesa</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.modalBtnCerrar}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalBtnCerrarTexto}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL PARA ELEGIR A QUÉ MESA VINCULAR */}
      <Modal visible={modalVincularVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitulo}>Unir Mesa #{mesaSeleccionada?.numero_mesa} a:</Text>
            <ScrollView style={{ maxHeight: 250 }}>
              {mesas
                .filter((m) => m.id !== mesaSeleccionada?.id && m.mesa_principal_id === null)
                .map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={styles.opcionVincular}
                    onPress={() => ejecutarVinculacion(m.id)}
                  >
                    <Text style={styles.opcionVincularTexto}>Mesa #{m.numero_mesa}</Text>
                    <Text style={{ color: '#a8a29e', fontSize: 12 }}>
                      ({String(m.estado).toUpperCase()})
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalBtnCerrar}
              onPress={() => setModalVincularVisible(false)}
            >
              <Text style={styles.modalBtnCerrarTexto}>Cancelar</Text>
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
  centerContainer: {
    flex: 1,
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#a8a29e',
    marginTop: 12,
  },
  headerInfo: {
    paddingHorizontal: 16,
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
    marginTop: 2,
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
  gridContent: {
    padding: 10,
    paddingBottom: 40,
  },
  tarjetaMesa: {
    flex: 1,
    backgroundColor: '#1c1917',
    margin: 6,
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    minHeight: 110,
    justifyContent: 'space-between',
  },
  mesaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  numeroMesa: {
    color: '#fafaf9',
    fontSize: 22,
    fontWeight: '900',
  },
  badgeEstado: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeTexto: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  secundariaTexto: {
    color: '#eab308',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  toqueDetalle: {
    color: '#78716c',
    fontSize: 10,
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
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
    marginBottom: 18,
    textAlign: 'center',
  },
  avisoMantenimiento: {
    backgroundColor: 'rgba(120, 113, 108, 0.2)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  avisoMantenimientoTexto: {
    color: '#a8a29e',
    fontWeight: '700',
    fontSize: 13,
  },
  modalBtnPrimario: {
    backgroundColor: '#ea580c',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalBtnCobrar: {
    backgroundColor: '#15803d',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalBtnSecundario: {
    backgroundColor: '#292524',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalBtnDesvincular: {
    backgroundColor: '#b91c1c',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalBtnTexto: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  modalBtnSecundarioTexto: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
  },
  modalBtnCerrar: {
    padding: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  modalBtnCerrarTexto: {
    color: '#a8a29e',
    fontSize: 14,
    fontWeight: '600',
  },
  opcionVincular: {
    padding: 14,
    backgroundColor: '#292524',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  opcionVincularTexto: {
    color: '#fff',
    fontWeight: '700',
  },
});