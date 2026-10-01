import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Linking,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useCameraPermissions, CameraView } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { AuthContext } from '../context/AuthContext';
import {
  obtenerPedidosRequest,
  facturarPedidoRequest,
  subirFotoComprobanteRequest,
} from '../services/api';

export default function CobroScreen({ route, navigation }) {
  const { token } = useContext(AuthContext);

  // Estados de pedidos
  const [pedidosPendientes, setPedidosPendientes] = useState([]);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  const [cargandoPedidos, setCargandoPedidos] = useState(true);
  const [procesandoCobro, setProcesandoCobro] = useState(false);

  // Método de pago: 'Efectivo' o 'Transferencia'
  const [tipoPago, setTipoPago] = useState('Efectivo');

  // Hook nativo de cámara
  const [permission, requestPermission] = useCameraPermissions();
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [fotoUri, setFotoUri] = useState(null);
  const [cameraRef, setCameraRef] = useState(null);
  const [mostrarRationale, setMostrarRationale] = useState(false);

  // 1. Cargar pedidos por cobrar desde FastAPI
  useEffect(() => {
    async function cargarPedidosACobrar() {
      try {
        const data = await obtenerPedidosRequest(token);
        const pendientes = data.filter(
          (p) => p.estado !== 'Pagado' && p.estado !== 'Cancelado'
        );
        setPedidosPendientes(pendientes);

        // Pre-selección inteligente por mesa o por ID
        if (route.params?.pedidoId) {
          const encontrado = pendientes.find((p) => p.id === route.params.pedidoId);
          if (encontrado) setPedidoSeleccionado(encontrado);
        } else if (route.params?.mesaId) {
          const encontradoPorMesa = pendientes.find((p) => p.mesa_id === route.params.mesaId);
          if (encontradoPorMesa) setPedidoSeleccionado(encontradoPorMesa);
          else if (pendientes.length > 0) setPedidoSeleccionado(pendientes[0]);
        } else if (pendientes.length > 0) {
          setPedidoSeleccionado(pendientes[0]);
        }
      } catch (error) {
        console.warn('Error al cargar pedidos por cobrar:', error);
      } finally {
        setCargandoPedidos(false);
      }
    }

    if (token) {
      cargarPedidosACobrar();
    }
  }, [token, route.params]);

  // Gestión de permisos de cámara
  const iniciarCaptura = async () => {
    if (!permission || permission.status === 'undetermined') {
      setMostrarRationale(true);
      return;
    }

    if (!permission.granted && !permission.canAskAgain) {
      Alert.alert(
        'Acceso a Cámara Bloqueado',
        'El permiso fue denegado. Puedes activarlo en Ajustes o seleccionar la captura desde tu galería.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Abrir Ajustes', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }

    if (!permission.granted) {
      const respuesta = await requestPermission();
      if (respuesta.granted) {
        setCamaraActiva(true);
      }
      return;
    }

    setCamaraActiva(true);
  };

  const confirmarRationale = async () => {
    setMostrarRationale(false);
    const respuesta = await requestPermission();
    if (respuesta.granted) {
      setCamaraActiva(true);
    }
  };

  const tomarFoto = async () => {
    if (cameraRef) {
      try {
        const photo = await cameraRef.takePictureAsync({ quality: 0.4 });
        setFotoUri(photo.uri);
        setCamaraActiva(false);
      } catch (error) {
        Alert.alert('Error', 'No se pudo capturar la fotografía.');
      }
    }
  };

  const seleccionarDeGaleria = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.4,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setFotoUri(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo abrir la galería del dispositivo.');
    }
  };

  // 2. ENVIAR COBRO REAL A FASTAPI 🚀
  const procesarCobro = async () => {
    if (!pedidoSeleccionado) {
      Alert.alert('Atención', 'No hay ningún pedido seleccionado para cobrar.');
      return;
    }

    // Si es transferencia, la foto es OBLIGATORIA
    if (tipoPago === 'Transferencia' && !fotoUri) {
      Alert.alert(
        'Comprobante requerido',
        'Para pagos por Transferencia es obligatorio fotografiar o adjuntar el comprobante.'
      );
      return;
    }

    setProcesandoCobro(true);
    try {
      let urlCloudinary = null;

      // Solo subimos a Cloudinary si es Transferencia y hay foto
      if (tipoPago === 'Transferencia' && fotoUri) {
        urlCloudinary = await subirFotoComprobanteRequest(fotoUri, token);
        console.log('✅ URL de Cloudinary recibida:', urlCloudinary);
      }

      // Facturar en FastAPI con "Efectivo" o "Transferencia"
      await facturarPedidoRequest(
        pedidoSeleccionado.id,
        tipoPago,
        token,
        urlCloudinary // null si es efectivo, https://... si es transferencia
      );

      const nombreMesa = pedidoSeleccionado.mesa_id
        ? `Mesa #${pedidoSeleccionado.mesa_id}`
        : 'Para Llevar';

      Alert.alert(
        '🎉 Cobro Exitoso',
        `El pedido #${pedidoSeleccionado.id} (${nombreMesa}) ha sido cobrado en ${tipoPago.toUpperCase()} y la mesa fue liberada.`,
        [{ text: 'Aceptar', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Fallo en el Cobro', error.message || 'No se pudo procesar el cobro');
    } finally {
      setProcesandoCobro(false);
    }
  };

  // Vista de cámara nativa en pantalla completa
  if (camaraActiva) {
    return (
      <View style={styles.camaraContenedor}>
        <CameraView
          style={styles.camara}
          facing="back"
          mode="picture"
          ref={(ref) => setCameraRef(ref)}
        />
        <View style={styles.camaraBotonera}>
          <TouchableOpacity
            style={styles.botonCancelarCamara}
            onPress={() => setCamaraActiva(false)}
          >
            <Text style={styles.textoBotonSecundario}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.botonCapturar} onPress={tomarFoto}>
            <View style={styles.circuloCaptura} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (cargandoPedidos) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#ea580c" />
        <Text style={styles.loadingText}>Buscando cuentas pendientes...</Text>
      </View>
    );
  }

  // Validación para habilitar el botón
  const puedeCobrar =
    pedidoSeleccionado &&
    !procesandoCobro &&
    (tipoPago === 'Efectivo' || (tipoPago === 'Transferencia' && fotoUri));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.titulo}>Caja y Cierre de Comanda</Text>

      {/* 1. Selector de Comandas Pendientes */}
      <Text style={styles.subtitulo}>SELECCIONA LA CUENTA A COBRAR</Text>
      {pedidosPendientes.length === 0 ? (
        <View style={styles.tarjetaVacia}>
          <Text style={styles.textoVacio}>No hay comandas pendientes de pago.</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorScroll}>
          {pedidosPendientes.map((p) => {
            const seleccionada = pedidoSeleccionado?.id === p.id;
            const esParaLlevar = !p.mesa_id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.chipMesa, seleccionada && styles.chipMesaActiva]}
                onPress={() => setPedidoSeleccionado(p)}
              >
                <Text style={[styles.chipTexto, seleccionada && styles.chipTextoActivo]}>
                  {esParaLlevar ? '🛍️ Para Llevar' : `Mesa #${p.mesa_id}`}
                </Text>
                <Text style={styles.chipSubtexto}>
                  #{p.id} • ${Number(p.total || 0).toFixed(2)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* 2. Resumen del Pedido Seleccionado */}
      {pedidoSeleccionado && (
        <View style={styles.tarjetaResumen}>
          <Text style={styles.textoMesa}>
            {pedidoSeleccionado.mesa_id
              ? `Mesa #${pedidoSeleccionado.mesa_id}`
              : 'Orden Para Llevar'}{' '}
            (Orden #{pedidoSeleccionado.id})
          </Text>
          <Text style={styles.textoTotal}>
            Total a cobrar: ${Number(pedidoSeleccionado.total || 0).toFixed(2)}
          </Text>
          <Text style={styles.textoDetallesCount}>
            {pedidoSeleccionado.detalles?.length || 0} plato(s) en la comanda
          </Text>
        </View>
      )}

      {/* 3. Selector de Método de Pago: Efectivo vs Transferencia */}
      <Text style={styles.subtitulo}>MÉTODO DE PAGO</Text>
      <View style={styles.filaMetodosPago}>
        <TouchableOpacity
          style={[styles.btnMetodoPago, tipoPago === 'Efectivo' && styles.btnMetodoActivo]}
          onPress={() => setTipoPago('Efectivo')}
        >
          <Text style={[styles.textoMetodoPago, tipoPago === 'Efectivo' && styles.textoMetodoActivo]}>
            💵 Efectivo
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnMetodoPago, tipoPago === 'Transferencia' && styles.btnMetodoActivo]}
          onPress={() => setTipoPago('Transferencia')}
        >
          <Text style={[styles.textoMetodoPago, tipoPago === 'Transferencia' && styles.textoMetodoActivo]}>
            📱 Transferencia
          </Text>
        </TouchableOpacity>
      </View>

      {/* 4. Si es Efectivo: Mensaje simple sin cámara */}
      {tipoPago === 'Efectivo' && (
        <View style={styles.tarjetaEfectivo}>
          <Text style={styles.textoEfectivoTitulo}>Cobro en Efectivo</Text>
          <Text style={styles.textoEfectivoCuerpo}>
            Recibe el dinero en caja y entrega el cambio si corresponde. No se requiere comprobante fotográfico.
          </Text>
        </View>
      )}

      {/* 5. Si es Transferencia: Sección de Cámara Obligatoria */}
      {tipoPago === 'Transferencia' && (
        <>
          <Text style={styles.subtitulo}>COMPROBANTE BANCARIO (OBLIGATORIO)</Text>

          {mostrarRationale && (
            <View style={styles.tarjetaRationale}>
              <Text style={styles.tituloRationale}>¿Por qué requerimos la cámara?</Text>
              <Text style={styles.cuerpoRationale}>
                Para pagos con transferencia, es obligatorio capturar el ticket bancario para validar la transacción y liberar la comanda.
              </Text>
              <View style={styles.filaBotonesRationale}>
                <TouchableOpacity
                  style={styles.botonRationaleCancelar}
                  onPress={() => setMostrarRationale(false)}
                >
                  <Text style={styles.textoBotonSecundario}>Omitir</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.botonRationaleAceptar}
                  onPress={confirmarRationale}
                >
                  <Text style={styles.textoBotonPrimario}>Continuar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {fotoUri ? (
            <View style={styles.seccionFoto}>
              <Image source={{ uri: fotoUri }} style={styles.fotoPreview} resizeMode="contain" />
              <TouchableOpacity
                style={styles.botonReintentarFoto}
                onPress={() => setFotoUri(null)}
              >
                <Text style={styles.textoEliminar}>Eliminar y tomar otra foto</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.contenedorAcciones}>
              <TouchableOpacity style={styles.botonCamara} onPress={iniciarCaptura}>
                <Text style={styles.textoBotonPrincipal}>📷 Fotografiar Comprobante</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.botonGaleria} onPress={seleccionarDeGaleria}>
                <Text style={styles.textoBotonGaleria}>🖼️ Subir desde Galería</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {/* 6. Botón Finalizar Cobro */}
      <TouchableOpacity
        style={[styles.botonFinalizar, !puedeCobrar && styles.botonDeshabilitado]}
        onPress={procesarCobro}
        disabled={!puedeCobrar}
      >
        {procesandoCobro ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.textoBotonFinalizar}>
            {tipoPago === 'Efectivo'
              ? `Cobrar $${Number(pedidoSeleccionado?.total || 0).toFixed(2)} en Efectivo`
              : 'Facturar Transferencia y Liberar'}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#121212',
    flexGrow: 1,
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
  titulo: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitulo: {
    fontSize: 11,
    color: '#a8a29e',
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 12,
  },
  selectorScroll: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  chipMesa: {
    backgroundColor: '#1c1917',
    borderWidth: 1,
    borderColor: '#333',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 10,
  },
  chipMesaActiva: {
    borderColor: '#ea580c',
    backgroundColor: '#2b1b13',
  },
  chipTexto: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '700',
  },
  chipTextoActivo: {
    color: '#ea580c',
  },
  chipSubtexto: {
    color: '#78716c',
    fontSize: 11,
    marginTop: 2,
  },
  tarjetaVacia: {
    backgroundColor: '#1c1917',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  textoVacio: {
    color: '#78716c',
    fontSize: 13,
  },
  tarjetaResumen: {
    backgroundColor: '#1e1e1e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#333',
  },
  textoMesa: {
    fontSize: 15,
    color: '#aaa',
    fontWeight: '600',
  },
  textoTotal: {
    fontSize: 26,
    color: '#22c55e',
    fontWeight: 'bold',
    marginTop: 4,
  },
  textoDetallesCount: {
    color: '#78716c',
    fontSize: 12,
    marginTop: 4,
  },
  filaMetodosPago: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  btnMetodoPago: {
    flex: 1,
    backgroundColor: '#1c1917',
    borderWidth: 1.5,
    borderColor: '#292524',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnMetodoActivo: {
    borderColor: '#ea580c',
    backgroundColor: '#27170c',
  },
  textoMetodoPago: {
    color: '#a8a29e',
    fontSize: 15,
    fontWeight: '700',
  },
  textoMetodoActivo: {
    color: '#ea580c',
  },
  tarjetaEfectivo: {
    backgroundColor: '#14231b',
    borderWidth: 1,
    borderColor: '#15803d',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  textoEfectivoTitulo: {
    color: '#22c55e',
    fontWeight: 'bold',
    fontSize: 15,
    marginBottom: 4,
  },
  textoEfectivoCuerpo: {
    color: '#86efac',
    fontSize: 13,
    lineHeight: 18,
  },
  tarjetaRationale: {
    backgroundColor: '#1c2833',
    padding: 16,
    borderRadius: 10,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  tituloRationale: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 6,
  },
  cuerpoRationale: {
    color: '#bdc3c7',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  filaBotonesRationale: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  botonRationaleCancelar: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  botonRationaleAceptar: {
    backgroundColor: '#3498db',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  textoBotonPrimario: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  textoBotonSecundario: {
    color: '#aaa',
    fontSize: 13,
  },
  contenedorAcciones: {
    gap: 12,
    marginBottom: 16,
  },
  botonCamara: {
    backgroundColor: '#15803d',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  textoBotonPrincipal: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  botonGaleria: {
    backgroundColor: '#1f2937',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  textoBotonGaleria: {
    color: '#ecf0f1',
    fontWeight: '600',
    fontSize: 14,
  },
  seccionFoto: {
    alignItems: 'center',
    marginBottom: 20,
  },
  fotoPreview: {
    width: '100%',
    height: 360,
    borderRadius: 12,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 10,
  },
  botonReintentarFoto: {
    padding: 8,
  },
  textoEliminar: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },
  botonFinalizar: {
    backgroundColor: '#ea580c',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  botonDeshabilitado: {
    backgroundColor: '#44403c',
    opacity: 0.5,
  },
  textoBotonFinalizar: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  camaraContenedor: {
    flex: 1,
    backgroundColor: '#000',
  },
  camara: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  camaraBotonera: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 40,
    paddingTop: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  botonCancelarCamara: {
    padding: 12,
  },
  botonCapturar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circuloCaptura: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#fff',
  },
});