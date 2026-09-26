import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import {
  obtenerCategoriasRequest,
  obtenerMesasRequest,
  crearPedidoRequest,
} from '../services/api';

export default function TomarPedidoScreen({ navigation }) {
  const { token, usuario } = useContext(AuthContext);

  const [categorias, setCategorias] = useState([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null); // null = "Todas"
  const [platosMostrados, setPlatosMostrados] = useState([]);
  const [todosLosPlatos, setTodosLosPlatos] = useState([]);

  const [mesas, setMesas] = useState([]);
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);

  // Carrito de compras: { plato_id: { plato, cantidad } }
  const [carrito, setCarrito] = useState({});
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  // 1. Cargar categorías, platos y mesas del backend
  useEffect(() => {
    async function cargarDatos() {
      try {
        const [catsData, mesasData] = await Promise.all([
          obtenerCategoriasRequest(token),
          obtenerMesasRequest(token),
        ]);

        setCategorias(catsData);
        // Filtrar solo mesas activas y que no estén en mantenimiento
        const mesasValidas = mesasData.filter(
          (m) => m.activo && m.estado !== 'fuera_de_servicio' && m.mesa_principal_id === null
        );
        setMesas(mesasValidas);
        if (mesasValidas.length > 0) setMesaSeleccionada(mesasValidas[0]);

        // Aplanar todos los platos en una sola lista para el filtro "Todas"
        const platosTotales = [];
        catsData.forEach((cat) => {
          if (cat.platos) {
            cat.platos.forEach((p) => {
              platosTotales.push({ ...p, categoriaNombre: cat.nombre });
            });
          }
        });
        setTodosLosPlatos(platosTotales);
        setPlatosMostrados(platosTotales);
      } catch (error) {
        Alert.alert('Error', error.message || 'No se pudieron cargar los datos del menú');
      } finally {
        setCargando(false);
      }
    }

    if (token) cargarDatos();
  }, [token]);

  // 2. Filtrar platos al tocar una categoría
  const filtrarPorCategoria = (catId) => {
    setCategoriaSeleccionada(catId);
    if (catId === null) {
      setPlatosMostrados(todosLosPlatos);
    } else {
      const cat = categorias.find((c) => c.id === catId);
      setPlatosMostrados(cat?.platos || []);
    }
  };

  // 3. Manejo del Carrito (+ y -)
  const agregarPlato = (plato) => {
    setCarrito((prev) => {
      const actual = prev[plato.id]?.cantidad || 0;
      return {
        ...prev,
        [plato.id]: {
          plato,
          cantidad: actual + 1,
        },
      };
    });
  };

  const quitarPlato = (platoId) => {
    setCarrito((prev) => {
      const actual = prev[platoId]?.cantidad || 0;
      if (actual <= 1) {
        const copia = { ...prev };
        delete copia[platoId];
        return copia;
      }
      return {
        ...prev,
        [platoId]: {
          ...prev[platoId],
          cantidad: actual - 1,
        },
      };
    });
  };

  // Calcular total en dinero y platos del carrito
  const totalItems = Object.values(carrito).reduce((acc, item) => acc + item.cantidad, 0);
  const totalDinero = Object.values(carrito).reduce(
    (acc, item) => acc + item.cantidad * Number(item.plato.precio || 0),
    0
  );

  // 4. Enviar pedido a FastAPI
  const enviarPedidoCocina = async () => {
    if (totalItems === 0) {
      Alert.alert('Comanda vacía', 'Debes agregar al menos un plato a la comanda.');
      return;
    }

    setEnviando(true);
    try {
      const payload = {
        mesa_id: mesaSeleccionada ? mesaSeleccionada.id : null,
        mesero_id: usuario?.user_id || 1,
        detalles: Object.values(carrito).map((item) => ({
          plato_id: item.plato.id,
          cantidad: item.cantidad,
          notas: '',
        })),
      };

      await crearPedidoRequest(payload, token);

      Alert.alert(
        '🚀 ¡Comanda Enviada!',
        `El pedido para ${mesaSeleccionada ? `Mesa #${mesaSeleccionada.numero_mesa}` : 'Para Llevar'} fue enviado a cocina.`,
        [
          {
            text: 'Aceptar',
            onPress: () => {
              setCarrito({});
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error al enviar', error.message || 'No se pudo crear el pedido');
    } finally {
      setEnviando(false);
    }
  };

  const renderPlato = ({ item }) => {
    const cantidadEnCarrito = carrito[item.id]?.cantidad || 0;

    return (
      <View style={styles.cardPlato}>
        {/* FOTOGRAFÍA DEL PLATO DESDE LA BD */}
        {item.img_url ? (
          <Image
            source={{ uri: item.img_url }}
            style={styles.imagenPlato}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderImagen}>
            <Text style={styles.placeholderTexto}>🍲</Text>
          </View>
        )}

        {/* INFORMACIÓN DEL PLATO */}
        <View style={styles.infoPlato}>
          <Text style={styles.nombrePlato}>{item.nombre}</Text>
          {item.tamano ? (
            <Text style={styles.tamanoPlato}>{item.tamano}</Text>
          ) : null}
          {item.descripcion ? (
            <Text style={styles.descPlato} numberOfLines={2}>
              {item.descripcion}
            </Text>
          ) : null}
          <Text style={styles.precioPlato}>${Number(item.precio || 0).toFixed(2)}</Text>
        </View>

        {/* CONTROLES + / - */}
        <View style={styles.contadorContainer}>
          {cantidadEnCarrito > 0 ? (
            <>
              <TouchableOpacity style={styles.btnMenos} onPress={() => quitarPlato(item.id)}>
                <Text style={styles.btnTexto}>−</Text>
              </TouchableOpacity>
              <Text style={styles.cantidadTexto}>{cantidadEnCarrito}</Text>
            </>
          ) : null}
          <TouchableOpacity style={styles.btnMas} onPress={() => agregarPlato(item)}>
            <Text style={styles.btnTexto}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (cargando) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#ea580c" />
        <Text style={styles.loadingText}>Cargando menú y mesas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 1. Selector de Mesas */}
      <View style={styles.seccionMesa}>
        <Text style={styles.seccionTitulo}>MESA ASIGNADA:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollMesas}>
          {mesas.map((m) => {
            const activa = mesaSeleccionada?.id === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.chipMesa, activa && styles.chipMesaActiva]}
                onPress={() => setMesaSeleccionada(m)}
              >
                <Text style={[styles.textoChipMesa, activa && styles.textoChipMesaActivo]}>
                  Mesa #{m.numero_mesa}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 2. Barra de Categorías Horizontal (Tabs) */}
      <View style={styles.seccionCategorias}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollCategorias}>
          {/* Opción "Todas" */}
          <TouchableOpacity
            style={[styles.chipCat, categoriaSeleccionada === null && styles.chipCatActiva]}
            onPress={() => filtrarPorCategoria(null)}
          >
            <Text
              style={[styles.textoChipCat, categoriaSeleccionada === null && styles.textoChipCatActivo]}
            >
              🍽️ Todas
            </Text>
          </TouchableOpacity>

          {/* Categorías dinámicas de la BD */}
          {categorias.map((c) => {
            const activa = categoriaSeleccionada === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.chipCat, activa && styles.chipCatActiva]}
                onPress={() => filtrarPorCategoria(c.id)}
              >
                <Text style={[styles.textoChipCat, activa && styles.textoChipCatActivo]}>
                  {c.nombre}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 3. Lista de Platos */}
      <FlatList
        data={platosMostrados}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderPlato}
        contentContainerStyle={styles.listaPlatos}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay platos en esta categoría.</Text>
          </View>
        }
      />

      {/* 4. Barra Flotante de Comanda (Footer) */}
      {totalItems > 0 && (
        <View style={styles.barraInferior}>
          <View>
            <Text style={styles.totalPlatosText}>{totalItems} plato(s) en comanda</Text>
            <Text style={styles.totalDineroText}>Total: ${totalDinero.toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.btnEnviar, enviando && styles.btnDeshabilitado]}
            onPress={enviarPedidoCocina}
            disabled={enviando}
          >
            {enviando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnEnviarTexto}>ENVIAR A COCINA →</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
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
    fontSize: 14,
  },
  seccionMesa: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  seccionTitulo: {
    color: '#78716c',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  scrollMesas: {
    flexDirection: 'row',
  },
  chipMesa: {
    backgroundColor: '#1c1917',
    borderWidth: 1,
    borderColor: '#292524',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  chipMesaActiva: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  textoChipMesa: {
    color: '#a8a29e',
    fontSize: 12,
    fontWeight: '700',
  },
  textoChipMesaActivo: {
    color: '#ffffff',
  },
  seccionCategorias: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1917',
  },
  scrollCategorias: {
    paddingHorizontal: 16,
  },
  chipCat: {
    backgroundColor: '#1c1917',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#292524',
  },
  chipCatActiva: {
    backgroundColor: '#292524',
    borderColor: '#ea580c',
  },
  textoChipCat: {
    color: '#a8a29e',
    fontSize: 13,
    fontWeight: '700',
  },
  imagenPlato: {
    width: 72,
    height: 72,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#27272a',
  },
  placeholderImagen: {
    width: 72,
    height: 72,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderTexto: {
    fontSize: 28,
  },
  tamanoPlato: {
    color: '#ea580c',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  textoChipCatActivo: {
    color: '#ea580c',
  },
  listaPlatos: {
    padding: 16,
    paddingBottom: 100, // Espacio para no tapar la barra inferior
  },
  cardPlato: {
    backgroundColor: '#1c1917',
    borderWidth: 1,
    borderColor: '#292524',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoPlato: {
    flex: 1,
    paddingRight: 12,
  },
  nombrePlato: {
    color: '#fafaf9',
    fontSize: 16,
    fontWeight: '700',
  },
  descPlato: {
    color: '#78716c',
    fontSize: 12,
    marginTop: 3,
  },
  precioPlato: {
    color: '#22c55e',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 6,
  },
  contadorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnMenos: {
    backgroundColor: '#292524',
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnMas: {
    backgroundColor: '#ea580c',
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnTexto: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cantidadTexto: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginHorizontal: 12,
  },
  barraInferior: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#18181b',
    borderTopWidth: 1,
    borderTopColor: '#27272a',
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 8,
  },
  totalPlatosText: {
    color: '#a8a29e',
    fontSize: 12,
    fontWeight: '700',
  },
  totalDineroText: {
    color: '#22c55e',
    fontSize: 20,
    fontWeight: '900',
  },
  btnEnviar: {
    backgroundColor: '#ea580c',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  btnDeshabilitado: {
    opacity: 0.5,
  },
  btnEnviarTexto: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    paddingTop: 50,
    alignItems: 'center',
  },
  emptyText: {
    color: '#78716c',
    fontSize: 14,
  },
});