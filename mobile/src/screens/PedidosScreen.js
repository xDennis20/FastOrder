import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';

const COMANDAS_INICIALES = [
  {
    id: '101',
    mesa: 'Mesa 4',
    tiempo: '12 min',
    estado: 'EN PREPARACIÓN',
    urgente: false,
    items: [
      { cantidad: 2, nombre: 'Hamburguesa Doble Queso', nota: 'Sin cebolla' },
      { cantidad: 1, nombre: 'Papas Rústicas', nota: 'Salsa tártara' },
    ],
  },
  {
    id: '102',
    mesa: 'Mesa 2',
    tiempo: '18 min',
    estado: 'DEMORADO',
    urgente: true,
    items: [
      { cantidad: 1, nombre: 'Pizza Artesanal Familiar', nota: 'Masa delgada' },
      { cantidad: 2, nombre: 'Bebida 500ml', nota: 'Frías' },
    ],
  },
  {
    id: '103',
    mesa: 'Barra 01',
    tiempo: '4 min',
    estado: 'NUEVO',
    urgente: false,
    items: [
      { cantidad: 1, nombre: 'Costillas BBQ', nota: 'Término bien cocido' },
    ],
  },
];

export default function PedidosScreen({ navigation }) {
  const [pedidos, setPedidos] = useState(COMANDAS_INICIALES);

  const cambiarEstado = (id) => {
    setPedidos((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              estado: item.estado === 'LISTO' ? 'EN PREPARACIÓN' : 'LISTO',
            }
          : item
      )
    );
  };

  const renderItem = ({ item }) => {
    const esListo = item.estado === 'LISTO';
    const borderColor = esListo ? '#22c55e' : item.urgente ? '#ef4444' : '#ea580c';

    return (
      <View style={[styles.ticketCard, { borderColor }]}>
        {/* Cabecera de la Comanda */}
        <View style={styles.ticketHeader}>
          <View>
            <Text style={styles.ticketNumber}>ORDEN #{item.id}</Text>
            <Text style={styles.ticketMesa}>{item.mesa}</Text>
          </View>
          <View style={styles.timeBadge}>
            <Text style={styles.timeText}>⏱ {item.tiempo}</Text>
          </View>
        </View>

        {/* Separador */}
        <View style={styles.divider} />

        {/* Lista de Platos */}
        <View style={styles.itemsContainer}>
          {item.items.map((plato, index) => (
            <View key={index} style={styles.platoRow}>
              <Text style={styles.platoCantidad}>{plato.cantidad}x</Text>
              <View style={styles.platoDetalle}>
                <Text style={styles.platoNombre}>{plato.nombre}</Text>
                {plato.nota ? <Text style={styles.platoNota}>• {plato.nota}</Text> : null}
              </View>
            </View>
          ))}
        </View>

        {/* Acción del Ticket */}
        <TouchableOpacity
          style={[styles.statusButton, esListo && styles.buttonListo]}
          onPress={() => cambiarEstado(item.id)}
          activeOpacity={0.8}
        >
          <Text style={styles.statusButtonText}>
            {esListo ? '✓ PLATO DESPACHADO' : 'MARCAR COMO LISTO'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerInfo}>
        <Text style={styles.title}>Línea de Comandas Activas</Text>
        <Text style={styles.subtitle}>Toca una comanda para alternar su estado</Text>
      </View>

      <FlatList
        data={pedidos}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />
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
  listContent: {
    padding: 20,
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
});