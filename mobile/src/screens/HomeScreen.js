import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { AuthContext } from '../context/AuthContext';

export default function HomeScreen({ navigation }) {
  const { usuario } = useContext(AuthContext);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Tarjeta de Sesión Activa */}
      <View style={styles.userCard}>
        <View style={styles.statusDot} />
        <View style={styles.userInfo}>
          <Text style={styles.userLabel}>OPERADOR CONECTADO</Text>
          <Text style={styles.userEmail}>{usuario?.email || 'terminal@fastorder.io'}</Text>
        </View>
      </View>

      {/* Métricas Rápidas KDS */}
      <Text style={styles.sectionTitle}>ESTADO DE COCINA</Text>
      <View style={styles.metricsRow}>
        <View style={[styles.metricCard, { borderColor: '#ea580c' }]}>
          <Text style={styles.metricNumber}>6</Text>
          <Text style={styles.metricLabel}>EN COLA</Text>
        </View>
        <View style={[styles.metricCard, { borderColor: '#eab308' }]}>
          <Text style={styles.metricNumber}>3</Text>
          <Text style={styles.metricLabel}>EN COCCIÓN</Text>
        </View>
        <View style={[styles.metricCard, { borderColor: '#22c55e' }]}>
          <Text style={styles.metricNumber}>8</Text>
          <Text style={styles.metricLabel}>LISTAS</Text>
        </View>
      </View>

      {/* Módulos de Navegación */}
      <Text style={styles.sectionTitle}>MÓDULOS DE TERMINAL</Text>

      <TouchableOpacity
        style={styles.actionCard}
        onPress={() => navigation.navigate('Pedidos')}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.actionTitle}>Monitor de Comandas (KDS)</Text>
          <Text style={styles.badgeOrange}>EN VIVO</Text>
        </View>
        <Text style={styles.actionDescription}>
          Visualizar tickets pendientes, tiempos de preparación y cambiar el estado de platos listos.
        </Text>
        <Text style={styles.actionLink}>ABRIR PANTALLA 2 →</Text>
      </TouchableOpacity>

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
        <Text style={styles.actionLink}>ABRIR PANTALLA 3 →</Text>
      </TouchableOpacity>
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
  userLabel: {
    color: '#a8a29e',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  userEmail: {
    color: '#fafaf9',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionTitle: {
    color: '#78716c',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  metricCard: {
    backgroundColor: '#1c1917',
    borderWidth: 1,
    borderRadius: 8,
    width: '31%',
    paddingVertical: 14,
    alignItems: 'center',
  },
  metricNumber: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
  },
  metricLabel: {
    color: '#a8a29e',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  actionCard: {
    backgroundColor: '#1c1917',
    borderWidth: 1,
    borderColor: '#292524',
    borderRadius: 10,
    padding: 18,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  badgeOrange: {
    backgroundColor: '#ea580c',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeGray: {
    backgroundColor: '#44403c',
    color: '#d6d3d1',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  actionDescription: {
    color: '#a8a29e',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  actionLink: {
    color: '#ea580c',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
});