import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Switch,
  RefreshControl,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  obtenerPlatosRequest,
  crearPlatoRequest,
  modificarPlatoRequest,
  cambiarEstadoPlatoRequest,
  obtenerMesasRequest,
  crearMesaRequest,
  cambiarEstadoMesaRequest,
  eliminarMesaRequest,
  reactivarMesaRequest,
  obtenerCategoriasRequest,
  crearCategoriaRequest,
  modificarCategoriaRequest,
  cambiarEstadoCategoriaRequest,
  obtenerUsuariosRequest,
  crearUsuarioRequest,
  modificarUsuarioRequest,
  cambiarEstadoUsuarioRequest,
  obtenerCierreCajaRequest,
  obtenerHistorialVentasRequest,
  subirFotoPlatoRequest,
} from '../services/api';
import { AuthContext } from '../context/AuthContext';

export default function AdminScreen({ navigation }) {
  const auth = useContext(AuthContext) || {};
  const user = auth?.user;

  // Pestañas: 'platos' | 'mesas' | 'categorias' | 'personal' | 'metricas'
  const [tabActiva, setTabActiva] = useState('platos');
  const [cargando, setCargando] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [mostrarInactivos, setMostrarInactivos] = useState(true);

  // Estados de datos
  const [platos, setPlatos] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [cierreCaja, setCierreCaja] = useState(null);
  const [historialVentas, setHistorialVentas] = useState(null);
  const [paginaVentas, setPaginaVentas] = useState(1);

  // Modal Foto Comprobante
  const [modalFotoVisible, setModalFotoVisible] = useState(false);
  const [fotoSeleccionada, setFotoSeleccionada] = useState(null);

  // Subida de imagen de plato
  const [subiendoFotoPlato, setSubiendoFotoPlato] = useState(false);

  // Modales formularios
  const [modalMesaVisible, setModalMesaVisible] = useState(false);
  const [modalCrearMesaVisible, setModalCrearMesaVisible] = useState(false);
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [numeroMesaNuevo, setNumeroMesaNuevo] = useState('');

  const [modalPlatoVisible, setModalPlatoVisible] = useState(false);
  const [platoEditando, setPlatoEditando] = useState(null);
  const [formPlato, setFormPlato] = useState({
    nombre: '',
    descripcion: '',
    precio: '',
    categoria_id: null,
    img_url: '',
  });

  const [modalCatVisible, setModalCatVisible] = useState(false);
  const [catEditando, setCatEditando] = useState(null);
  const [formCat, setFormCat] = useState({ nombre: '', descripcion: '' });

  // Formulario Empleados con nombres, apellidos, correo, telefono, password y rol
  const [modalUserVisible, setModalUserVisible] = useState(false);
  const [userEditando, setUserEditando] = useState(null);
  const [formUser, setFormUser] = useState({
    nombres: '',
    apellidos: '',
    correo: '',
    telefono: '',
    password: '',
    rol: 'MESERO',
  });

  // CARGAR DATOS
  const cargarDatos = useCallback(async (pagVentas = 1) => {
    try {
      setCargando(true);
      if (tabActiva === 'platos') {
        const [resPlatos, resCats] = await Promise.all([
          obtenerPlatosRequest(mostrarInactivos),
          obtenerCategoriasRequest().catch(() => []),
        ]);
        setPlatos(resPlatos || []);
        setCategorias(resCats || []);
      } else if (tabActiva === 'mesas') {
        const res = await obtenerMesasRequest(mostrarInactivos);
        setMesas(res || []);
      } else if (tabActiva === 'categorias') {
        const res = await obtenerCategoriasRequest();
        setCategorias(res || []);
      } else if (tabActiva === 'personal') {
        const res = await obtenerUsuariosRequest(mostrarInactivos);
        setUsuarios(res || []);
      } else if (tabActiva === 'metricas') {
        const [resCierre, resHistorial] = await Promise.all([
          obtenerCierreCajaRequest().catch(() => null),
          obtenerHistorialVentasRequest(pagVentas, 10).catch(() => null),
        ]);
        setCierreCaja(resCierre);
        setHistorialVentas(resHistorial);
        setPaginaVentas(pagVentas);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, [tabActiva, mostrarInactivos]);

  useEffect(() => {
    cargarDatos(1);
  }, [cargarDatos]);

  const onRefresh = () => {
    setRefrescando(true);
    cargarDatos(paginaVentas);
  };

  const cambiarPaginaHistorial = (nuevaPag) => {
    cargarDatos(nuevaPag);
  };

  // 1. PLATOS
  const abrirModalCrearPlato = () => {
    setPlatoEditando(null);
    setFormPlato({
      nombre: '',
      descripcion: '',
      precio: '',
      categoria_id: categorias[0]?.id || null,
      img_url: '',
    });
    setModalPlatoVisible(true);
  };

  const abrirModalEditarPlato = (plato) => {
    setPlatoEditando(plato);
    setFormPlato({
      nombre: plato.nombre,
      descripcion: plato.descripcion || '',
      precio: String(plato.precio),
      categoria_id: plato.categoria_id,
      img_url: plato.img_url || '',
    });
    setModalPlatoVisible(true);
  };

  const handleSeleccionarFotoPlato = async () => {
    try {
      const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permiso.granted) {
        Alert.alert('Permiso requerido', 'Se necesita acceso a la galería para seleccionar la foto del plato.');
        return;
      }

      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!resultado.canceled && resultado.assets && resultado.assets.length > 0) {
        const localUri = resultado.assets[0].uri;
        setSubiendoFotoPlato(true);
        const urlCloudinary = await subirFotoPlatoRequest(localUri);
        setFormPlato((prev) => ({ ...prev, img_url: urlCloudinary }));
        Alert.alert('Éxito', 'Foto subida a la nube correctamente');
      }
    } catch (e) {
      console.error('Error al subir foto:', e);
      Alert.alert('Error', e.message || 'No se pudo subir la foto del plato');
    } finally {
      setSubiendoFotoPlato(false);
    }
  };

  const guardarPlato = async () => {
    if (!formPlato.nombre || !formPlato.precio) {
      Alert.alert('Error', 'Nombre y precio son requeridos');
      return;
    }
    try {
      const urlFinal = formPlato.img_url ? String(formPlato.img_url).trim() : null;

      const payload = {
        nombre: formPlato.nombre,
        descripcion: formPlato.descripcion,
        precio: parseFloat(formPlato.precio),
        categoria_id: formPlato.categoria_id,
        img_url: urlFinal,
      };

      if (platoEditando) {
        await modificarPlatoRequest(platoEditando.id, payload);
        Alert.alert('Éxito', 'Plato actualizado');
      } else {
        await crearPlatoRequest(payload);
        Alert.alert('Éxito', 'Plato creado');
      }
      setModalPlatoVisible(false);
      cargarDatos();
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo guardar el plato');
    }
  };

  const toggleEstadoPlato = async (plato) => {
    try {
      await cambiarEstadoPlatoRequest(plato.id, !plato.activo);
      cargarDatos();
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo cambiar estado');
    }
  };

  // 2. MESAS
  const abrirModalCrearMesa = () => {
    setNumeroMesaNuevo('');
    setModalCrearMesaVisible(true);
  };

  const guardarNuevaMesa = async () => {
    if (!numeroMesaNuevo.trim()) {
      Alert.alert('Error', 'Ingrese el número de la mesa');
      return;
    }
    try {
      await crearMesaRequest({
        numero_mesa: numeroMesaNuevo.trim(),
      });
      Alert.alert('Éxito', 'Mesa creada correctamente');
      setModalCrearMesaVisible(false);
      cargarDatos();
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo crear la mesa');
    }
  };

  const abrirModalAccionesMesa = (mesa) => {
    setMesaSeleccionada(mesa);
    setModalMesaVisible(true);
  };

  const handleCambiarEstadoMesa = async (nuevoEstado) => {
    if (!mesaSeleccionada) return;
    try {
      await cambiarEstadoMesaRequest(mesaSeleccionada.id, nuevoEstado);
      Alert.alert('Éxito', `Mesa marcada como ${nuevoEstado}`);
      setModalMesaVisible(false);
      cargarDatos();
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo cambiar estado');
    }
  };

  const handleDesactivarMesa = async () => {
    if (!mesaSeleccionada) return;
    Alert.alert(
      'Desactivar Mesa',
      `¿Seguro que deseas desactivar la mesa #${mesaSeleccionada.numero_mesa ?? mesaSeleccionada.id}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desactivar',
          style: 'destructive',
          onPress: async () => {
            try {
              await eliminarMesaRequest(mesaSeleccionada.id);
              Alert.alert('Éxito', 'Mesa desactivada');
              setModalMesaVisible(false);
              cargarDatos();
            } catch (e) {
              Alert.alert('Error', e.message || 'No se pudo desactivar');
            }
          },
        },
      ]
    );
  };

  const handleReactivarMesa = async (mesa) => {
    try {
      await reactivarMesaRequest(mesa.id);
      Alert.alert('Éxito', `Mesa #${mesa.numero_mesa ?? mesa.id} reactivada con éxito`);
      if (modalMesaVisible) setModalMesaVisible(false);
      cargarDatos();
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo reactivar la mesa');
    }
  };

  // 3. CATEGORÍAS
  const abrirModalCrearCat = () => {
    setCatEditando(null);
    setFormCat({ nombre: '', descripcion: '' });
    setModalCatVisible(true);
  };

  const abrirModalEditarCat = (cat) => {
    setCatEditando(cat);
    setFormCat({ nombre: cat.nombre, descripcion: cat.descripcion || '' });
    setModalCatVisible(true);
  };

  const guardarCategoria = async () => {
    if (!formCat.nombre.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return;
    }
    try {
      if (catEditando) {
        await modificarCategoriaRequest(catEditando.id, formCat);
        Alert.alert('Éxito', 'Categoría modificada');
      } else {
        await crearCategoriaRequest(formCat);
        Alert.alert('Éxito', 'Categoría creada');
      }
      setModalCatVisible(false);
      cargarDatos();
    } catch (e) {
      Alert.alert('Error', e.message || 'Error al guardar categoría');
    }
  };

  const toggleEstadoCat = async (cat) => {
    try {
      await cambiarEstadoCategoriaRequest(cat.id, !cat.activo);
      cargarDatos();
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo cambiar estado');
    }
  };

  // 4. PERSONAL (USUARIOS)
  const abrirModalCrearUser = () => {
    setUserEditando(null);
    setFormUser({
      nombres: '',
      apellidos: '',
      correo: '',
      telefono: '',
      password: '',
      rol: 'MESERO',
    });
    setModalUserVisible(true);
  };

  const abrirModalEditarUser = (u) => {
    setUserEditando(u);
    setFormUser({
      nombres: u.nombres || '',
      apellidos: u.apellidos || '',
      correo: u.correo || '',
      telefono: u.telefono || '',
      password: '',
      rol: u.rol || 'MESERO',
    });
    setModalUserVisible(true);
  };

  const guardarEmpleado = async () => {
    if (!formUser.nombres.trim() || !formUser.apellidos.trim()) {
      Alert.alert('Error', 'Nombres y apellidos son requeridos');
      return;
    }
    if (!formUser.correo.trim()) {
      Alert.alert('Error', 'El correo electrónico es requerido');
      return;
    }
    if (!formUser.telefono.trim()) {
      Alert.alert('Error', 'El teléfono es requerido');
      return;
    }

    if (!userEditando && !formUser.password) {
      Alert.alert('Error', 'La contraseña es obligatoria (mínimo 6 caracteres)');
      return;
    }

    try {
      if (userEditando) {
        const esDueno = userEditando.rol === 'DUENO' || userEditando.rol === 'SUPERADMIN';

        const payload = {
          nombres: formUser.nombres.trim(),
          apellidos: formUser.apellidos.trim(),
          correo: formUser.correo.trim().toLowerCase(),
          telefono: formUser.telefono.trim().slice(0, 10),
          rol: esDueno ? userEditando.rol : formUser.rol,
        };
        if (formUser.password && formUser.password.trim()) {
          payload.password = formUser.password.trim();
        }
        await modificarUsuarioRequest(userEditando.id, payload);
        Alert.alert('Éxito', 'Datos del usuario actualizados');
      } else {
        const payload = {
          nombres: formUser.nombres.trim(),
          apellidos: formUser.apellidos.trim(),
          correo: formUser.correo.trim().toLowerCase(),
          telefono: formUser.telefono.trim().slice(0, 10),
          password: formUser.password.trim(),
          rol: formUser.rol,
        };
        await crearUsuarioRequest(payload);
        Alert.alert('Éxito', 'Empleado creado correctamente');
      }
      setModalUserVisible(false);
      cargarDatos();
    } catch (e) {
      Alert.alert('Error al guardar', e.message || 'No se pudo procesar la solicitud');
    }
  };

  const toggleEstadoUser = async (u) => {
    if (u.rol === 'DUENO' || u.rol === 'SUPERADMIN') {
      Alert.alert('Acción denegada', 'No es posible desactivar una cuenta de Dueño/Administrador');
      return;
    }
    try {
      await cambiarEstadoUsuarioRequest(u.id, !u.activo, u.rol);
      cargarDatos();
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo cambiar estado');
    }
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Panel de Control</Text>
          <Text style={styles.headerSubtitle}>Administración del Restaurante</Text>
        </View>
        <TouchableOpacity style={styles.btnVolver} onPress={() => navigation?.goBack?.()}>
          <Text style={styles.btnVolverText}>✕ Cerrar</Text>
        </TouchableOpacity>
      </View>

      {/* TABS NAVEGACIÓN */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        {[
          { key: 'platos', label: '🍽️ Platos' },
          { key: 'mesas', label: '🪑 Mesas' },
          { key: 'categorias', label: '🏷️ Categorías' },
          { key: 'personal', label: '👥 Personal' },
          { key: 'metricas', label: '📊 Caja' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabButton, tabActiva === tab.key && styles.tabButtonActiva]}
            onPress={() => setTabActiva(tab.key)}
          >
            <Text
              style={[styles.tabButtonText, tabActiva === tab.key && styles.tabButtonTextActiva]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* BARRA INACTIVOS (Oculta en métricas) */}
      {tabActiva !== 'metricas' && (
        <View style={styles.switchInactivosBar}>
          <Text style={styles.switchInactivosText}>
            Mostrar inactivos / deshabilitados
          </Text>
          <Switch
            value={mostrarInactivos}
            onValueChange={setMostrarInactivos}
            thumbColor={mostrarInactivos ? '#8b5cf6' : '#71717a'}
            trackColor={{ false: '#3f3f46', true: '#c084fc' }}
          />
        </View>
      )}

      {/* CONTENIDO PRINCIPAL */}
      {cargando && !refrescando ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#8b5cf6" />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={onRefresh}
              tintColor="#8b5cf6"
            />
          }
        >
          {/* ============================================================= */}
          {/* TAB 1: PLATOS */}
          {/* ============================================================= */}
          {tabActiva === 'platos' && (
            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Platos Registrados ({platos.length})</Text>
                <TouchableOpacity style={styles.btnCrear} onPress={abrirModalCrearPlato}>
                  <Text style={styles.btnCrearText}>+ Nuevo Plato</Text>
                </TouchableOpacity>
              </View>

              {platos.map((plato) => (
                <View
                  key={plato.id}
                  style={[styles.card, !plato.activo && styles.cardInactiva]}
                >
                  <View style={styles.cardHeaderRow}>
                    {plato.img_url ? (
                      <Image
                        source={{ uri: plato.img_url }}
                        style={styles.platoThumb}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.platoThumbPlaceholder}>
                        <Text style={{ fontSize: 22 }}>🍽️</Text>
                      </View>
                    )}

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.cardTitle}>{plato.nombre}</Text>
                      <Text style={styles.cardSubtitle}>
                        ${Number(plato.precio).toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.cardActionsRow}>
                      <TouchableOpacity
                        style={styles.btnEditIcon}
                        onPress={() => abrirModalEditarPlato(plato)}
                      >
                        <Text style={styles.btnEditIconText}>✏️</Text>
                      </TouchableOpacity>
                      <Switch
                        value={plato.activo}
                        onValueChange={() => toggleEstadoPlato(plato)}
                        thumbColor={plato.activo ? '#10b981' : '#ef4444'}
                      />
                    </View>
                  </View>
                  {plato.descripcion ? (
                    <Text style={styles.cardDesc} numberOfLines={2}>
                      {plato.descripcion}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}

          {/* ============================================================= */}
          {/* TAB 2: MESAS */}
          {/* ============================================================= */}
          {tabActiva === 'mesas' && (
            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Mesas del Restaurante ({mesas.length})</Text>
                <TouchableOpacity style={styles.btnCrear} onPress={abrirModalCrearMesa}>
                  <Text style={styles.btnCrearText}>+ Nueva Mesa</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.mesasGrid}>
                {mesas.map((mesa) => {
                  const numMesa = mesa.numero_mesa ?? mesa.numero ?? mesa.id;
                  const inactiva = mesa.activo === false;
                  const enMantenimiento = mesa.estado === 'FUERA_DE_SERVICIO' || String(mesa.estado).toUpperCase() === 'MANTENIMIENTO';
                  const ocupada = mesa.estado === 'OCUPADA' || String(mesa.estado).toUpperCase() === 'OCUPADA';
                  return (
                    <TouchableOpacity
                      key={mesa.id}
                      style={[
                        styles.mesaCard,
                        inactiva && styles.mesaCardInactiva,
                        ocupada && styles.mesaCardOcupada,
                        enMantenimiento && styles.mesaCardMantenimiento,
                      ]}
                      onPress={() => abrirModalAccionesMesa(mesa)}
                    >
                      <Text style={styles.mesaNumero}>Mesa {numMesa}</Text>
                      <Text style={styles.mesaEstado}>
                        {inactiva
                          ? '❌ Inactiva'
                          : enMantenimiento
                          ? '🛠️ Mantenimiento'
                          : ocupada
                          ? '🔴 Ocupada'
                          : '🟢 Libre'}
                      </Text>
                      {mesa.mesa_principal_id && (
                        <Text style={styles.mesaSecundariaBadge}>Unida a #{mesa.mesa_principal_id}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ============================================================= */}
          {/* TAB 3: CATEGORÍAS */}
          {/* ============================================================= */}
          {tabActiva === 'categorias' && (
            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Categorías ({categorias.length})</Text>
                <TouchableOpacity style={styles.btnCrear} onPress={abrirModalCrearCat}>
                  <Text style={styles.btnCrearText}>+ Nueva Categoría</Text>
                </TouchableOpacity>
              </View>

              {categorias.map((cat) => (
                <View
                  key={cat.id}
                  style={[styles.card, !cat.activo && styles.cardInactiva]}
                >
                  <View style={styles.cardHeaderRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{cat.nombre}</Text>
                      {cat.descripcion ? (
                        <Text style={styles.cardDesc}>{cat.descripcion}</Text>
                      ) : null}
                    </View>
                    <View style={styles.cardActionsRow}>
                      <TouchableOpacity
                        style={styles.btnEditIcon}
                        onPress={() => abrirModalEditarCat(cat)}
                      >
                        <Text style={styles.btnEditIconText}>✏️</Text>
                      </TouchableOpacity>
                      <Switch
                        value={cat.activo !== false}
                        onValueChange={() => toggleEstadoCat(cat)}
                        thumbColor={cat.activo !== false ? '#10b981' : '#ef4444'}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ============================================================= */}
          {/* TAB 4: PERSONAL */}
          {/* ============================================================= */}
          {tabActiva === 'personal' && (
            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Empleados ({usuarios.length})</Text>
                <TouchableOpacity style={styles.btnCrear} onPress={abrirModalCrearUser}>
                  <Text style={styles.btnCrearText}>+ Nuevo Empleado</Text>
                </TouchableOpacity>
              </View>

              {usuarios.map((u) => {
                const nombreCompleto = `${u.nombres || ''} ${u.apellidos || ''}`.trim() || u.correo;
                const esYo =
                  user &&
                  ((user.user_id && user.user_id === u.id) ||
                    (user.id && user.id === u.id) ||
                    (user.correo && u.correo && user.correo.toLowerCase() === u.correo.toLowerCase()));

                const esDueno = u.rol === 'DUENO' || u.rol === 'SUPERADMIN';

                return (
                  <View
                    key={u.id}
                    style={[styles.card, !u.activo && styles.cardInactiva]}
                  >
                    <View style={styles.cardHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>
                          {nombreCompleto} {esYo ? '(Tú)' : ''}
                        </Text>
                        <Text style={styles.cardSubtitle}>
                          Rol: {u.rol || 'Sin rol'} {u.telefono ? ` • 📞 ${u.telefono}` : ''}
                        </Text>
                        {u.correo ? (
                          <Text style={styles.cardDesc}>✉️ {u.correo}</Text>
                        ) : null}
                      </View>
                      <View style={styles.cardActionsRow}>
                        <TouchableOpacity
                          style={styles.btnEditIcon}
                          onPress={() => abrirModalEditarUser(u)}
                        >
                          <Text style={styles.btnEditIconText}>✏️</Text>
                        </TouchableOpacity>

                        {!esDueno && !esYo && (
                          <Switch
                            value={u.activo}
                            onValueChange={() => toggleEstadoUser(u)}
                            thumbColor={u.activo ? '#10b981' : '#ef4444'}
                          />
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* ============================================================= */}
          {/* TAB 5: MÉTRICAS Y CIERRE DE CAJA */}
          {/* ============================================================= */}
          {tabActiva === 'metricas' && (
            <View>
              {/* RESUMEN DE CIERRE */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>📊 Resumen de Cierre de Caja</Text>
                <Text style={styles.fechaBadge}>{cierreCaja?.fecha || 'Hoy'}</Text>
              </View>

              <View style={styles.resumenCard}>
                <Text style={styles.resumenLabel}>Total Recaudado Hoy:</Text>
                <Text style={styles.resumenTotal}>
                  ${Number(cierreCaja?.total_recaudado || 0).toFixed(2)}
                </Text>

                <View style={styles.divider} />

                <View style={styles.metricasGrid}>
                  <View style={styles.metricaBox}>
                    <Text style={styles.metricaLabel}>💵 Efectivo</Text>
                    <Text style={styles.metricaValor}>
                      ${Number(cierreCaja?.total_efectivo || 0).toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.metricaBox}>
                    <Text style={styles.metricaLabel}>🏦 Transferencia</Text>
                    <Text style={styles.metricaValor}>
                      ${Number(cierreCaja?.total_transferencia || 0).toFixed(2)}
                    </Text>
                  </View>
                </View>

                <View style={[styles.metricasGrid, { marginTop: 10 }]}>
                  <View style={styles.metricaBox}>
                    <Text style={styles.metricaLabel}>🧾 Total Pedidos</Text>
                    <Text style={styles.metricaValor}>{cierreCaja?.total_pedidos || 0}</Text>
                  </View>

                  <View style={styles.metricaBox}>
                    <Text style={styles.metricaLabel}>🎟️ Ticket Promedio</Text>
                    <Text style={styles.metricaValor}>
                      ${Number(cierreCaja?.promedio_tickets || 0).toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* HISTORIAL DE VENTAS */}
              <View style={[styles.sectionHeader, { marginTop: 24 }]}>
                <Text style={styles.sectionTitle}>
                  🧾 Historial de Ventas ({historialVentas?.total_registros || 0})
                </Text>
              </View>

              {(!historialVentas?.items || historialVentas.items.length === 0) ? (
                <View style={styles.emptyHistorial}>
                  <Text style={styles.emptyText}>No hay ventas registradas aún</Text>
                </View>
              ) : (
                historialVentas.items.map((factura) => {
                  const esEfectivo = String(factura.tipo_pago).toLowerCase() === 'efectivo';
                  const fechaObj = factura.fecha_creacion ? new Date(factura.fecha_creacion) : null;
                  const horaStr = fechaObj
                    ? fechaObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '';
                  const fechaStr = fechaObj
                    ? fechaObj.toLocaleDateString([], { day: '2-digit', month: '2-digit' })
                    : '';

                  const platosResumen = factura.pedido?.detalles
                    ? factura.pedido.detalles
                        .map((d) => `${d.cantidad}x ${d.plato?.nombre || 'Plato'}`)
                        .join(', ')
                    : '';

                  const comprobanteUrl =
                    factura.comprobante_img_url || factura.comprobante_url || factura.comprobante;

                  return (
                    <View key={factura.id} style={styles.facturaCard}>
                      <View style={styles.facturaHeader}>
                        <View>
                          <Text style={styles.facturaId}>Factura #{factura.id}</Text>
                          <Text style={styles.facturaFecha}>{fechaStr} {horaStr}</Text>
                        </View>
                        <Text style={styles.facturaTotal}>
                          ${Number(factura.total || 0).toFixed(2)}
                        </Text>
                      </View>

                      {platosResumen ? (
                        <Text style={styles.facturaDetalles} numberOfLines={2}>
                          {platosResumen}
                        </Text>
                      ) : null}

                      <View style={styles.facturaFooter}>
                        <View style={[styles.badgePago, esEfectivo ? styles.badgeEfectivo : styles.badgeTransferencia]}>
                          <Text style={styles.badgePagoText}>
                            {esEfectivo ? '💵 Efectivo' : '🏦 Transferencia'}
                          </Text>
                        </View>

                        {comprobanteUrl ? (
                          <TouchableOpacity
                            style={styles.btnVerComprobante}
                            onPress={() => {
                              setFotoSeleccionada(comprobanteUrl);
                              setModalFotoVisible(true);
                            }}
                          >
                            <Text style={styles.btnVerComprobanteText}>📷 Ver Comprobante</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  );
                })
              )}

              {/* PAGINACIÓN HISTORIAL */}
              {historialVentas && historialVentas.total_paginas > 1 && (
                <View style={styles.paginacionRow}>
                  <TouchableOpacity
                    style={[styles.btnPaginacion, !historialVentas.tiene_anterior && styles.btnPaginacionDisabled]}
                    disabled={!historialVentas.tiene_anterior}
                    onPress={() => cambiarPaginaHistorial(paginaVentas - 1)}
                  >
                    <Text style={styles.btnPaginacionText}>⬅️ Anterior</Text>
                  </TouchableOpacity>

                  <Text style={styles.paginacionInfo}>
                    {historialVentas.pagina_actual} / {historialVentas.total_paginas}
                  </Text>

                  <TouchableOpacity
                    style={[styles.btnPaginacion, !historialVentas.tiene_siguiente && styles.btnPaginacionDisabled]}
                    disabled={!historialVentas.tiene_siguiente}
                    onPress={() => cambiarPaginaHistorial(paginaVentas + 1)}
                  >
                    <Text style={styles.btnPaginacionText}>Siguiente ➡️</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ============================================================= */}
      {/* MODAL VER COMPROBANTE DE PAGO */}
      {/* ============================================================= */}
      <Modal visible={modalFotoVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { padding: 10, maxHeight: '85%' }]}>
            <Text style={[styles.modalTitle, { marginVertical: 10 }]}>📷 Comprobante de Pago</Text>
            {fotoSeleccionada && (
              <Image
                source={{ uri: fotoSeleccionada }}
                style={{ width: '100%', height: 380, borderRadius: 10 }}
                resizeMode="contain"
              />
            )}
            <TouchableOpacity
              style={[styles.btnCancelar, { marginTop: 15, width: '100%' }]}
              onPress={() => setModalFotoVisible(false)}
            >
              <Text style={styles.btnCancelarText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ============================================================= */}
      {/* MODAL CREAR MESA */}
      {/* ============================================================= */}
      <Modal visible={modalCrearMesaVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🪑 Nueva Mesa</Text>

            <Text style={styles.inputLabel}>Número o Nombre de la Mesa:</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ej: 5 o Terraza 1"
              placeholderTextColor="#71717a"
              value={numeroMesaNuevo}
              onChangeText={setNumeroMesaNuevo}
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.btnCancelar}
                onPress={() => setModalCrearMesaVisible(false)}
              >
                <Text style={styles.btnCancelarText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnGuardar} onPress={guardarNuevaMesa}>
                <Text style={styles.btnGuardarText}>Crear Mesa</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================= */}
      {/* MODAL ACCIONES MESA */}
      {/* ============================================================= */}
      <Modal visible={modalMesaVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Mesa #{mesaSeleccionada?.numero_mesa ?? mesaSeleccionada?.id}
            </Text>

            {mesaSeleccionada?.activo === false ? (
              <View>
                <Text style={[styles.cardDesc, { textAlign: 'center', marginBottom: 15 }]}>
                  Esta mesa se encuentra desactivada.
                </Text>
                <TouchableOpacity
                  style={[styles.btnAccionMesa, { backgroundColor: '#10b981' }]}
                  onPress={() => handleReactivarMesa(mesaSeleccionada)}
                >
                  <Text style={styles.btnAccionMesaText}>🔄 Reactivar Mesa</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text style={styles.inputLabel}>Cambiar Estado Operativo:</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                <TouchableOpacity
                  style={[styles.btnAccionMesa, { backgroundColor: '#059669', flex: 1 }]}
                  onPress={() => handleCambiarEstadoMesa('DISPONIBLE')}
                >
                  <Text style={styles.btnAccionMesaText}>🟢 Disponible</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btnAccionMesa, { backgroundColor: '#d97706', flex: 1 }]}
                  onPress={() => handleCambiarEstadoMesa('FUERA_DE_SERVICIO')}
                >
                  <Text style={styles.btnAccionMesaText}>🛠️ Mant.</Text>
                </TouchableOpacity>
              </View>

                <TouchableOpacity
                  style={[styles.btnAccionMesa, { backgroundColor: '#dc2626', marginBottom: 10 }]}
                  onPress={handleDesactivarMesa}
                >
                  <Text style={styles.btnAccionMesaText}>🗑️ Desactivar Mesa</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[styles.btnCancelar, { marginTop: 10 }]}
              onPress={() => setModalMesaVisible(false)}
            >
              <Text style={styles.btnCancelarText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ============================================================= */}
      {/* MODAL PLATO */}
      {/* ============================================================= */}
      <Modal visible={modalPlatoVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>
                {platoEditando ? 'Editar Plato' : 'Nuevo Plato'}
              </Text>

              <Text style={styles.inputLabel}>Foto del Plato:</Text>
              {formPlato.img_url ? (
                <View style={styles.previewContainer}>
                  <Image
                    source={{ uri: formPlato.img_url }}
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                  <View style={styles.previewButtonsRow}>
                    <TouchableOpacity
                      style={styles.btnCambiarFoto}
                      onPress={handleSeleccionarFotoPlato}
                      disabled={subiendoFotoPlato}
                    >
                      {subiendoFotoPlato ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                      ) : (
                        <Text style={styles.btnCambiarFotoText}>🔄 Cambiar Foto</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.btnQuitarFoto}
                      onPress={() => setFormPlato((prev) => ({ ...prev, img_url: '' }))}
                    >
                      <Text style={styles.btnQuitarFotoText}>🗑️ Quitar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.btnSubirFoto}
                  onPress={handleSeleccionarFotoPlato}
                  disabled={subiendoFotoPlato}
                >
                  {subiendoFotoPlato ? (
                    <ActivityIndicator color="#8b5cf6" />
                  ) : (
                    <>
                      <Text style={styles.btnSubirFotoIcon}>📷</Text>
                      <Text style={styles.btnSubirFotoText}>Subir foto desde galería</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <Text style={[styles.inputLabel, { marginTop: 10 }]}>O enlace directo (URL opcional):</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="https://ejemplo.com/foto.jpg"
                placeholderTextColor="#71717a"
                value={formPlato.img_url}
                onChangeText={(text) => setFormPlato({ ...formPlato, img_url: text })}
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Nombre del Plato:</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ej: Hamburguesa Doble"
                placeholderTextColor="#71717a"
                value={formPlato.nombre}
                onChangeText={(text) => setFormPlato({ ...formPlato, nombre: text })}
              />

              <Text style={styles.inputLabel}>Precio ($):</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ej: 8.50"
                placeholderTextColor="#71717a"
                keyboardType="decimal-pad"
                value={formPlato.precio}
                onChangeText={(text) => setFormPlato({ ...formPlato, precio: text })}
              />

              <Text style={styles.inputLabel}>Categoría:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {categorias.map((cat) => {
                  const activo = formPlato.categoria_id === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.chipCat, activo && styles.chipCatActivo]}
                      onPress={() => setFormPlato({ ...formPlato, categoria_id: cat.id })}
                    >
                      <Text style={[styles.chipCatText, activo && styles.chipCatTextActivo]}>
                        {cat.nombre}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.inputLabel}>Descripción:</Text>
              <TextInput
                style={[styles.modalInput, { height: 60 }]}
                placeholder="Ingredientes o detalles..."
                placeholderTextColor="#71717a"
                multiline
                value={formPlato.descripcion}
                onChangeText={(text) => setFormPlato({ ...formPlato, descripcion: text })}
              />

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={styles.btnCancelar}
                  onPress={() => setModalPlatoVisible(false)}
                >
                  <Text style={styles.btnCancelarText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnGuardar} onPress={guardarPlato}>
                  <Text style={styles.btnGuardarText}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ============================================================= */}
      {/* MODAL CATEGORÍA */}
      {/* ============================================================= */}
      <Modal visible={modalCatVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {catEditando ? 'Editar Categoría' : 'Nueva Categoría'}
            </Text>

            <Text style={styles.inputLabel}>Nombre:</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ej: Bebidas, Postres..."
              placeholderTextColor="#71717a"
              value={formCat.nombre}
              onChangeText={(text) => setFormCat({ ...formCat, nombre: text })}
            />

            <Text style={styles.inputLabel}>Descripción:</Text>
            <TextInput
              style={[styles.modalInput, { height: 60 }]}
              placeholder="Opcional..."
              placeholderTextColor="#71717a"
              multiline
              value={formCat.descripcion}
              onChangeText={(text) => setFormCat({ ...formCat, descripcion: text })}
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.btnCancelar}
                onPress={() => setModalCatVisible(false)}
              >
                <Text style={styles.btnCancelarText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnGuardar} onPress={guardarCategoria}>
                <Text style={styles.btnGuardarText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================= */}
      {/* MODAL PERSONAL (CON NOMBRES, APELLIDOS, CORREO, TELÉFONO) */}
      {/* ============================================================= */}
      <Modal visible={modalUserVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>
                {userEditando ? 'Modificar Empleado' : 'Nuevo Empleado'}
              </Text>

              <Text style={styles.inputLabel}>Nombres:</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ej: Juan Carlos"
                placeholderTextColor="#71717a"
                value={formUser.nombres}
                onChangeText={(text) => setFormUser({ ...formUser, nombres: text })}
              />

              <Text style={styles.inputLabel}>Apellidos:</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ej: Pérez Gómez"
                placeholderTextColor="#71717a"
                value={formUser.apellidos}
                onChangeText={(text) => setFormUser({ ...formUser, apellidos: text })}
              />

              <Text style={styles.inputLabel}>Correo Electrónico:</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="ejemplo@restaurante.com"
                placeholderTextColor="#71717a"
                keyboardType="email-address"
                autoCapitalize="none"
                value={formUser.correo}
                onChangeText={(text) => setFormUser({ ...formUser, correo: text })}
              />

              <Text style={styles.inputLabel}>Teléfono / Celular (máx 10 dígitos):</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0987654321"
                placeholderTextColor="#71717a"
                keyboardType="phone-pad"
                maxLength={10}
                value={formUser.telefono}
                onChangeText={(text) => setFormUser({ ...formUser, telefono: text })}
              />

              <Text style={styles.inputLabel}>
                {userEditando
                  ? 'Contraseña (dejar en blanco para conservar actual):'
                  : 'Contraseña (mínimo 6 caracteres):'}
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="••••••••"
                placeholderTextColor="#71717a"
                secureTextEntry
                value={formUser.password}
                onChangeText={(text) => setFormUser({ ...formUser, password: text })}
              />

              <Text style={styles.inputLabel}>Rol asignado:</Text>
              {userEditando && (userEditando.rol === 'DUENO' || userEditando.rol === 'SUPERADMIN') ? (
                <View style={styles.rolProtegidoBox}>
                  <Text style={styles.rolProtegidoText}>👑 DUEÑO (Rol principal - No modificable)</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                  {['MESERO', 'COCINERO', 'CAJA'].map((r) => {
                    const activo = formUser.rol === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        style={[styles.chipCat, activo && styles.chipCatActivo]}
                        onPress={() => setFormUser({ ...formUser, rol: r })}
                      >
                        <Text style={[styles.chipCatText, activo && styles.chipCatTextActivo]}>
                          {r}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={styles.btnCancelar}
                  onPress={() => setModalUserVisible(false)}
                >
                  <Text style={styles.btnCancelarText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnGuardar} onPress={guardarEmpleado}>
                  <Text style={styles.btnGuardarText}>
                    {userEditando ? 'Guardar Cambios' : 'Crear'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
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
  header: {
    paddingTop: 55,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#1c1917',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#8b5cf6',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#a1a1aa',
    marginTop: 2,
  },
  btnVolver: {
    backgroundColor: '#27272a',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  btnVolverText: {
    color: '#e4e4e7',
    fontWeight: 'bold',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#18181b',
    maxHeight: 65,
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#27272a',
    marginRight: 8,
    justifyContent: 'center',
  },
  tabButtonActiva: {
    backgroundColor: '#8b5cf6',
  },
  tabButtonText: {
    color: '#a1a1aa',
    fontSize: 14,
    fontWeight: '600',
  },
  tabButtonTextActiva: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  switchInactivosBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1c1917',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  switchInactivosText: {
    color: '#a1a1aa',
    fontSize: 13,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  btnCrear: {
    backgroundColor: '#8b5cf6',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  btnCrearText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  card: {
    backgroundColor: '#1c1917',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  cardInactiva: {
    opacity: 0.5,
    borderColor: '#7f1d1d',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  platoThumb: {
    width: 54,
    height: 54,
    borderRadius: 10,
    backgroundColor: '#27272a',
  },
  platoThumbPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 10,
    backgroundColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
    marginTop: 2,
  },
  cardDesc: {
    fontSize: 13,
    color: '#a1a1aa',
    marginTop: 6,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnEditIcon: {
    backgroundColor: '#27272a',
    padding: 8,
    borderRadius: 8,
  },
  btnEditIconText: {
    fontSize: 14,
  },
  previewContainer: {
    marginBottom: 12,
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  previewButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  btnCambiarFoto: {
    backgroundColor: '#8b5cf6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  btnCambiarFotoText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  btnQuitarFoto: {
    backgroundColor: '#dc2626',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  btnQuitarFotoText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  btnSubirFoto: {
    borderWidth: 1,
    borderColor: '#8b5cf6',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    marginBottom: 10,
  },
  btnSubirFotoIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  btnSubirFotoText: {
    color: '#c084fc',
    fontWeight: 'bold',
    fontSize: 13,
  },
  mesasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  mesaCard: {
    width: '47%',
    backgroundColor: '#1c1917',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#10b981',
    alignItems: 'center',
  },
  mesaCardOcupada: {
    borderColor: '#ef4444',
  },
  mesaCardMantenimiento: {
    borderColor: '#f59e0b',
  },
  mesaCardInactiva: {
    borderColor: '#52525b',
    opacity: 0.5,
  },
  mesaNumero: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  mesaEstado: {
    fontSize: 12,
    color: '#a1a1aa',
    fontWeight: '600',
  },
  mesaSecundariaBadge: {
    fontSize: 10,
    color: '#f59e0b',
    marginTop: 4,
    fontWeight: 'bold',
  },
  btnAccionMesa: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnAccionMesaText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  fechaBadge: {
    backgroundColor: '#27272a',
    color: '#a1a1aa',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  resumenCard: {
    backgroundColor: '#1c1917',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  resumenLabel: {
    fontSize: 14,
    color: '#a1a1aa',
    fontWeight: '500',
  },
  resumenTotal: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#10b981',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#27272a',
    marginVertical: 14,
  },
  metricasGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  metricaBox: {
    flex: 1,
    backgroundColor: '#27272a',
    borderRadius: 10,
    padding: 12,
  },
  metricaLabel: {
    fontSize: 12,
    color: '#a1a1aa',
    marginBottom: 4,
  },
  metricaValor: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  emptyHistorial: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: '#1c1917',
    borderRadius: 12,
  },
  emptyText: {
    color: '#71717a',
    fontSize: 14,
  },
  facturaCard: {
    backgroundColor: '#1c1917',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  facturaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  facturaId: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  facturaFecha: {
    fontSize: 12,
    color: '#71717a',
    marginTop: 2,
  },
  facturaTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10b981',
  },
  facturaDetalles: {
    fontSize: 12,
    color: '#a1a1aa',
    marginVertical: 8,
    fontStyle: 'italic',
  },
  facturaFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#27272a',
    paddingTop: 8,
  },
  badgePago: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeEfectivo: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  badgeTransferencia: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  badgePagoText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  btnVerComprobante: {
    backgroundColor: '#27272a',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  btnVerComprobanteText: {
    color: '#c084fc',
    fontSize: 11,
    fontWeight: 'bold',
  },
  paginacionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 15,
    paddingHorizontal: 10,
  },
  btnPaginacion: {
    backgroundColor: '#27272a',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  btnPaginacionDisabled: {
    opacity: 0.3,
  },
  btnPaginacionText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  paginacionInfo: {
    color: '#a1a1aa',
    fontSize: 13,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#3f3f46',
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 13,
    color: '#a1a1aa',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    marginBottom: 14,
  },
  chipCat: {
    backgroundColor: '#27272a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  chipCatActivo: {
    backgroundColor: '#8b5cf6',
  },
  chipCatText: {
    color: '#a1a1aa',
    fontSize: 13,
    fontWeight: '600',
  },
  chipCatTextActivo: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  rolProtegidoBox: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1,
    borderColor: '#8b5cf6',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  rolProtegidoText: {
    color: '#c084fc',
    fontWeight: 'bold',
    fontSize: 13,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  btnCancelar: {
    flex: 1,
    backgroundColor: '#3f3f46',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnCancelarText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  btnGuardar: {
    flex: 1,
    backgroundColor: '#8b5cf6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnGuardarText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});