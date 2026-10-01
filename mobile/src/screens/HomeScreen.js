import React, { useContext, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { obtenerPedidosRequest } from '../services/api';

export default function HomeScreen({ navigation }) {
  const { usuario, token } = useContext(AuthContext);

  const [metricas, setMetricas] = useState({
    enCola: 0,
    enCoccion: 0,
    listas: 0,
  });
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  // 1. REGLAS DE ROLES (RBAC en la Interfaz)
  const rol = (usuario?.rol || '').toUpperCase();
  const esDueñoOAdmin = rol === 'DUENO' || rol === 'SUPERADMIN';
  const esCocinero = rol === 'COCINERO';
  const esMesero = rol === 'MESERO';
  const esCaja = rol === 'CAJA';

  // Permisos de visibilidad por módulo
  const puedeVerMesas = esDueñoOAdmin || esMesero || esCaja;
  const puedeTomarPedidos = esDueñoOAdmin || esMesero;
  const puedeVerCocina = esDueñoOAdmin || esCocinero || esMesero;
  const puedeCobrar = esDueñoOAdmin || esCaja;

  // Color distintivo para el badge del rol
  let colorBadgeRol = '#ea580c'; // Naranja por defecto
  if (esDueñoOAdmin) colorBadgeRol = '#8b5cf6'; // Morado Admin
  else if (esCaja) colorBadgeRol = '#15803d';   // Verde Cajero
  else if (esCocinero) colorBadgeRol = '#d97706'; // Ámbar Cocina
  else if (esMesero) colorBadgeRol = '#2563eb';  // Azul Mesero

  // 2. Cargar métricas reales de cocina
  const cargarMetricas = async () => {
    if (!token) return;
    try {
      const pedidos = await obtenerPedidosRequest(token);

      let cola = 0;
      let coccion = 0;
      let listos = 0;

      pedidos.forEach((p) => {
        if (p.estado === 'Pendiente') cola++;
        else if (p.estado === 'En preparacion') coccion++;
        else if (p.estado === 'Listo') listos++;
      });

      setMetricas({ enCola: cola, enCoccion: coccion, listas: listos });
    } catch (error) {
      console.warn('Error al calcular métricas:', error.message);
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      cargarMetricas();
    }, [token])
  );

  const alRefrescar = () => {
    setRefrescando(true);
    cargarMetricas();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refrescando}
          onRefresh={alRefrescar}
          tintColor="#ea580c"
          colors={['#ea580c']}
        />
      }
    >
      {/* 1. Tarjeta del Operador Conectado */}
      <View style={styles.userCard}>
        <View style={styles.statusDot} />
        <View style={styles.userInfo}>
          <View style={styles.userRoleRow}>
            <Text style={styles.userLabel}>OPERADOR CONECTADO</Text>
            <View style={[styles.badgeRol, { backgroundColor: colorBadgeRol }]}>
              <Text style={styles.badgeRolTexto}>{rol || 'STAFF'}</Text>
            </View>
          </View>
          <Text style={styles.userName}>{usuario?.nombre || 'Operador de Turno'}</Text>
          <Text style={styles.userEmail}>{usuario?.email || 'terminal@fastorder.io'}</Text>
        </View>
      </View>

      {/* 2. Métricas de Cocina */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>ESTADO EN VIVO DE COCINA</Text>
        {cargando && <ActivityIndicator size="small" color="#ea580c" />}
      </View>

      <View style={styles.metricsRow}>
        <View style={[styles.metricCard, { borderColor: '#ea580c' }]}>
          <Text style={styles.metricNumber}>{metricas.enCola}</Text>
          <Text style={styles.metricLabel}>EN COLA</Text>
        </View>

        <View style={[styles.metricCard, { borderColor: '#eab308' }]}>
          <Text style={styles.metricNumber}>{metricas.enCoccion}</Text>
          <Text style={styles.metricLabel}>EN COCCIÓN</Text>
        </View>

        <View style={[styles.metricCard, { borderColor: '#22c55e' }]}>
          <Text style={styles.metricNumber}>{metricas.listas}</Text>
          <Text style={styles.metricLabel}>LISTAS</Text>
        </View>
      </View>

      {/* 3. Módulos Filtrados según el Rol del Usuario */}
      <Text style={styles.sectionTitle}>
        {esCocinero ? 'ACCESO OPERATIVO DE COCINA' : 'MÓDULOS DE TERMINAL'}
      </Text>

      {/* A. Módulo: Mapa de Mesas (Mesero, Caja, Dueño) */}
      {puedeVerMesas && (
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('Mesas')}
          activeOpacity={0.8}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.actionTitle}>Mapa de Mesas (Salón)</Text>
            <Text style={styles.badgeGreen}>EN VIVO</Text>
          </View>
          <Text style={styles.actionDescription}>
            Visualizar mesas libres y ocupadas, vincular mesas para grupos y gestionar el salón.
          </Text>
          <Text style={styles.actionLink}>ABRIR MAPA DE SALÓN →</Text>
        </TouchableOpacity>
      )}

      {/* B. Módulo: Tomar Pedido / Carta Digital (Mesero, Dueño) */}
      {puedeTomarPedidos && (
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('TomarPedido')}
          activeOpacity={0.8}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.actionTitle}>Tomar Pedido (Carta Digital)</Text>
            <Text style={styles.badgeOrange}>MESERO</Text>
          </View>
          <Text style={styles.actionDescription}>
            Explorar platos con fotos por categoría, seleccionar mesa o para llevar y despachar a cocina.
          </Text>
          <Text style={styles.actionLink}>ABRIR CARTA Y COMANDAS →</Text>
        </TouchableOpacity>
      )}

      {/* C. Módulo: Monitor KDS de Cocina (Cocinero, Mesero, Dueño) */}
      {puedeVerCocina && (
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('Pedidos')}
          activeOpacity={0.8}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.actionTitle}>Monitor de Cocina (KDS)</Text>
            <Text style={styles.badgeOrange}>COCINEROS</Text>
          </View>
          <Text style={styles.actionDescription}>
            Visualizar tickets entrantes, tiempos de espera y cambiar estado individual de cada plato.
          </Text>
          <Text style={styles.actionLink}>ABRIR PANTALLA DE COCINA →</Text>
        </TouchableOpacity>
      )}

      {/* D. Módulo: Caja y Cobro (Cajero, Dueño) */}
      {puedeCobrar && (
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('Cobro')}
          activeOpacity={0.8}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.actionTitle}>Caja y Cierre de Comanda</Text>
            <Text style={styles.badgeGreen}>CAJA</Text>
          </View>
          <Text style={styles.actionDescription}>
            Cobro en efectivo o transferencia bancaria con fotografía a Cloudinary y liberación de mesa.
          </Text>
          <Text style={styles.actionLink}>ABRIR MÓDULO DE COBRO →</Text>
        </TouchableOpacity>
      )}

      {/* E. Módulo: Configuración y Turno (Visible para TODOS) */}
      <TouchableOpacity
        style={styles.actionCard}
        onPress={() => navigation.navigate('Perfil')}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.actionTitle}>Configuración y Turno</Text>
          <Text style={styles.badgeGray}>SESIÓN</Text>
        </View>
        <Text style={styles.actionDescription}>
          Detalles de conexión al servidor, token activo y botón de cierre seguro de turno.
        </Text>
        <Text style={styles.actionLink}>VER DETALLES DE SESIÓN →</Text>
      </TouchableOpacity>
      {/* MÓDULO EXCLUSIVO PARA DUEÑO Y SUPERADMIN */}
      {esDueñoOAdmin && (
        <TouchableOpacity
          style={[styles.actionCard, { borderColor: '#8b5cf6' }]}
          onPress={() => navigation.navigate('Admin')}
          activeOpacity={0.8}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.actionTitle}>Panel de Administración (Dueño)</Text>
            <Text style={[styles.badgeOrange, { backgroundColor: '#8b5cf6' }]}>EJECUTIVO</Text>
          </View>
          <Text style={styles.actionDescription}>
            Cierre de caja en vivo, ingresos de ventas, gestión de personal contratado y alta de platos/mesas.
          </Text>
          <Text style={[styles.actionLink, { color: '#8b5cf6' }]}>ABRIR PANEL ADMINISTRATIVO →</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  userCard: {
    backgroundColor: '#1c1917',
    borderColor: '#292524',
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    marginRight: 14,
  },
  userInfo: {
    flex: 1,
  },
  userRoleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userLabel: {
    color: '#a8a29e',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  badgeRol: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeRolTexto: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  userName: {
    color: '#fafaf9',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 2,
  },
  userEmail: {
    color: '#78716c',
    fontSize: 12,
    marginTop: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#78716c',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  metricCard: {
    backgroundColor: '#1c1917',
    borderWidth: 1.5,
    borderRadius: 10,
    width: '31%',
    paddingVertical: 14,
    alignItems: 'center',
  },
  metricNumber: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '900',
  },
  metricLabel: {
    color: '#a8a29e',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  actionCard: {
    backgroundColor: '#1c1917',
    borderWidth: 1,
    borderColor: '#292524',
    borderRadius: 10,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  badgeOrange: {
    backgroundColor: '#ea580c',
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeGreen: {
    backgroundColor: '#15803d',
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeGray: {
    backgroundColor: '#44403c',
    color: '#d6d3d1',
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  actionDescription: {
    color: '#a8a29e',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  actionLink: {
    color: '#ea580c',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
});