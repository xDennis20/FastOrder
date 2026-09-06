import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { AuthContext } from '../context/AuthContext';

export default function PerfilScreen() {
  const { usuario, token, cerrarSesion } = useContext(AuthContext);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>SESIÓN DE USUARIO</Text>

      {/* Tarjeta de Información */}
      <View style={styles.infoCard}>
        <Text style={styles.label}>OPERADOR CONECTADO</Text>
        <Text style={styles.value}>{usuario?.email || 'Desconocido'}</Text>

        <View style={styles.divider} />

        <Text style={styles.label}>TERMINAL / SERVIDOR</Text>
        <Text style={styles.value}>{process.env.EXPO_PUBLIC_API_URL || 'Localhost'}</Text>

        <View style={styles.divider} />

        <Text style={styles.label}>JWT TOKEN (AUTENTICACIÓN ACTIVA)</Text>
        <Text style={styles.tokenBox} numberOfLines={3} ellipsizeMode="middle">
          {token || 'Sin token'}
        </Text>
      </View>

      {/* Botón de Cierre de Sesión */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={cerrarSesion}
        activeOpacity={0.8}
      >
        <Text style={styles.logoutButtonText}>CERRAR SESIÓN / FINALIZAR TURNO</Text>
      </TouchableOpacity>

      <Text style={styles.securityNote}>
        Al cerrar sesión, las credenciales locales se eliminan de AsyncStorage y las pantallas protegidas se desmontan de la memoria.
      </Text>
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
    paddingTop: 24,
  },
  sectionTitle: {
    color: '#78716c',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#1c1917',
    borderWidth: 1,
    borderColor: '#292524',
    borderRadius: 10,
    padding: 20,
    marginBottom: 24,
  },
  label: {
    color: '#a8a29e',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  value: {
    color: '#fafaf9',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#292524',
    marginVertical: 14,
  },
  tokenBox: {
    backgroundColor: '#0c0a09',
    color: '#ea580c',
    fontSize: 12,
    padding: 10,
    borderRadius: 6,
    fontFamily: 'monospace',
    marginTop: 4,
  },
  logoutButton: {
    backgroundColor: '#dc2626', // Rojo de alerta
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  securityNote: {
    color: '#78716c',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
  },
});