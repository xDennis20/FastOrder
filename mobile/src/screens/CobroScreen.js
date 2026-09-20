import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Linking,
  ScrollView,
} from 'react-native';
import { useCameraPermissions, CameraView } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

export default function CobroScreen({ route, navigation }) {
  const mesaNumero = route?.params?.mesaNumero || '4';
  const total = route?.params?.total || 18.50;

  // 1. Hook nativo para permisos de cámara
  const [permission, requestPermission] = useCameraPermissions();

  // Estados locales
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [fotoUri, setFotoUri] = useState(null);
  const [cameraRef, setCameraRef] = useState(null);
  const [mostrarRationale, setMostrarRationale] = useState(false);

  // 2. Gestión de los 4 estados del permiso de cámara
  const iniciarCaptura = async () => {
    // Estado 1: No determinado (explicación previa / Rationale)
    if (!permission || permission.status === 'undetermined') {
      setMostrarRationale(true);
      return;
    }

    // Estado 4: Denegado permanente
    if (!permission.granted && !permission.canAskAgain) {
      Alert.alert(
        'Acceso a Cámara Bloqueado',
        'El permiso fue denegado de forma permanente en el sistema. Puedes activarlo en Ajustes o seleccionar la captura desde tu galería.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Abrir Ajustes', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }

    // Estado 3: Denegado temporal
    if (!permission.granted) {
      const respuesta = await requestPermission();
      if (respuesta.granted) {
        setCamaraActiva(true);
      }
      return;
    }

    // Estado 2: Concedido
    setCamaraActiva(true);
  };

  const confirmarRationale = async () => {
    setMostrarRationale(false);
    const respuesta = await requestPermission();
    if (respuesta.granted) {
      setCamaraActiva(true);
    }
  };

  // 3. Captura con lente físico
  const tomarFoto = async () => {
    if (cameraRef) {
      try {
        const photo = await cameraRef.takePictureAsync({ quality: 0.7 });
        setFotoUri(photo.uri);
        setCamaraActiva(false);
      } catch (error) {
        Alert.alert('Error', 'No se pudo capturar la fotografía.');
      }
    }
  };

  // 4. Degradación: Selector de Galería (WhatsApp / Capturas previas)
  const seleccionarDeGaleria = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setFotoUri(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo abrir la galería del dispositivo.');
    }
  };

  // 5. Envío / Integración
  const procesarCobro = () => {
    if (!fotoUri) {
      Alert.alert(
        'Comprobante requerido',
        'Es obligatorio adjuntar el comprobante de pago para liberar la comanda.'
      );
      return;
    }

    Alert.alert(
      'Cobro Registrado',
      `Mesa #${mesaNumero} cobrada exitosamente.\nComprobante fotográfico vinculado a la comanda.`,
      [{ text: 'Aceptar', onPress: () => navigation.goBack() }]
    );
  };

  // Visor de Cámara en pantalla completa
  if (camaraActiva) {
    return (
      <View style={styles.camaraContenedor}>
        {/* Cámara con facing explícito y flex directo */}
        <CameraView
          style={styles.camara}
          facing="back"
          mode="picture"
          ref={(ref) => setCameraRef(ref)}
        />

        {/* Botonera superpuesta encima de la cámara */}
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.titulo}>Cobro y Cierre de Mesa</Text>

      <View style={styles.tarjetaResumen}>
        <Text style={styles.textoMesa}>Mesa #{mesaNumero}</Text>
        <Text style={styles.textoTotal}>Total a pagar: ${total.toFixed(2)}</Text>
      </View>

      <Text style={styles.subtitulo}>Comprobante de Transferencia</Text>

      {/* RATIONALE: Modal/Alerta contextual */}
      {mostrarRationale && (
        <View style={styles.tarjetaRationale}>
          <Text style={styles.tituloRationale}>¿Por qué requerimos la cámara?</Text>
          <Text style={styles.cuerpoRationale}>
            Necesitamos capturar el ticket o comprobante digital de la banca móvil del cliente para validar el pago en caja y liberar la mesa.
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

      {/* VISTA PREVIA O SELECTORES */}
      {fotoUri ? (
        <View style={styles.seccionFoto}>
          <Image
            source={{ uri: fotoUri }}
            style={styles.fotoPreview}
            resizeMode="contain"
          />
          <TouchableOpacity
            style={styles.botonReintentarFoto}
            onPress={() => setFotoUri(null)}
          >
            <Text style={styles.textoEliminar}>Eliminar y elegir otra imagen</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.contenedorAcciones}>
          {/* Opción Principal: Cámara */}
          <TouchableOpacity style={styles.botonCamara} onPress={iniciarCaptura}>
            <Text style={styles.textoBotonPrincipal}>📷 Fotografiar Comprobante</Text>
          </TouchableOpacity>

          {/* Opción Degradación / Respaldo: Galería */}
          <TouchableOpacity
            style={styles.botonGaleria}
            onPress={seleccionarDeGaleria}
          >
            <Text style={styles.textoBotonGaleria}>
              🖼️ Subir desde Galería
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* DEGRADACIÓN: Botón a Ajustes si el usuario bloqueó la cámara */}
      {permission && !permission.granted && !permission.canAskAgain && (
        <View style={styles.tarjetaBloqueo}>
          <Text style={styles.textoBloqueoTitulo}>Cámara bloqueada en ajustes</Text>
          <Text style={styles.textoBloqueoCuerpo}>
            El sistema no permite abrir la cámara directamente. Puedes desbloquearla en ajustes o usar el botón de galería de arriba.
          </Text>
          <TouchableOpacity
            style={styles.botonAjustes}
            onPress={() => Linking.openSettings()}
          >
            <Text style={styles.textoBotonAjustes}>⚙️ Abrir Ajustes de la App</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={[styles.botonFinalizar, !fotoUri && styles.botonDeshabilitado]}
        onPress={procesarCobro}
        disabled={!fotoUri}
      >
        <Text style={styles.textoBotonFinalizar}>Finalizar y Liberar Mesa</Text>
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
  titulo: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  tarjetaResumen: {
    backgroundColor: '#1e1e1e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  textoMesa: {
    fontSize: 16,
    color: '#aaa',
    fontWeight: '600',
  },
  textoTotal: {
    fontSize: 24,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginTop: 4,
  },
  subtitulo: {
    fontSize: 15,
    color: '#ddd',
    fontWeight: '600',
    marginBottom: 12,
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
    backgroundColor: '#27ae60',
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
    backgroundColor: '#2c3e50',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#415b76',
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
    height: 440,
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
    color: '#e74c3c',
    fontSize: 13,
    fontWeight: '600',
  },
  tarjetaBloqueo: {
    backgroundColor: '#2c1e1e',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e74c3c',
    marginBottom: 16,
  },
  textoBloqueoTitulo: {
    color: '#e74c3c',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
  },
  textoBloqueoCuerpo: {
    color: '#ecf0f1',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
  },
  botonAjustes: {
    backgroundColor: '#c0392b',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  textoBotonAjustes: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  botonFinalizar: {
    backgroundColor: '#2980b9',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  botonDeshabilitado: {
    backgroundColor: '#34495e',
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
    backgroundColor: 'rgba(0,0,0,0.4)',
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