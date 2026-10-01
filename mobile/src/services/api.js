import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

// Validador de formato JWT real (empieza con "ey" y tiene 3 segmentos)
const esJWTValido = (str) => {
  if (typeof str !== 'string') return false;
  const limpio = str.replace(/^Bearer\s+/i, '').trim();
  const partes = limpio.split('.');
  return partes.length === 3 && limpio.startsWith('ey');
};

// Resolver automáticamente el token sin importar en qué pantalla o clave se guardó
const resolverToken = async (tokenParam) => {
  // 1. Si se pasó como argumento y es válido
  if (esJWTValido(tokenParam)) {
    return tokenParam.replace(/^Bearer\s+/i, '').trim();
  }

  // 2. Si no, buscar automáticamente en AsyncStorage
  try {
    const keys = await AsyncStorage.getAllKeys();
    for (const key of keys) {
      const val = await AsyncStorage.getItem(key);
      if (!val) continue;

      // Si el valor guardado es un JSON (ej: {"access_token": "..."})
      try {
        const parsed = JSON.parse(val);
        const candidato = parsed?.access_token || parsed?.token || parsed?.userToken;
        if (esJWTValido(candidato)) {
          return candidato.replace(/^Bearer\s+/i, '').trim();
        }
      } catch {
        // No es JSON
      }

      // Si el valor guardado es directamente el token en texto plano
      if (esJWTValido(val)) {
        return val.replace(/^Bearer\s+/i, '').trim();
      }
    }
  } catch (err) {
    console.error('Error buscando token:', err);
  }

  return null;
};

// Generador de Headers seguro
const crearHeaders = async (token, isMultipart = false) => {
  const headers = {};
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }

  const authToken = await resolverToken(token);
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  return headers;
};

// ==========================================
// 1. AUTENTICACIÓN
// ==========================================
export const loginRequest = async (email, password) => {
  const formData = new URLSearchParams();
  formData.append('username', email);
  formData.append('password', password);

  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    const errorMsg =
      typeof data.detail === 'string' ? data.detail : 'Credenciales inválidas';
    throw new Error(errorMsg);
  }

  return data;
};

export const obtenerPerfilRequest = async (token) => {
  const headers = await crearHeaders(token);
  const response = await fetch(`${API_URL}/auth/me`, { method: 'GET', headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Error al obtener perfil');
  return data;
};

// ==========================================
// 2. PLATOS (CATÁLOGO)
// ==========================================
export const obtenerPlatosRequest = async (incluirInactivos = false, token) => {
  let paramInactivos = false;
  let authToken = token;
  if (typeof incluirInactivos === 'boolean') {
    paramInactivos = incluirInactivos;
  } else if (typeof incluirInactivos === 'string' && incluirInactivos.includes('.')) {
    authToken = incluirInactivos;
  }

  const headers = await crearHeaders(authToken);
  const response = await fetch(`${API_URL}/platos?incluir_inactivos=${paramInactivos}`, {
    method: 'GET',
    headers,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Error al obtener platos');
  return Array.isArray(data) ? data : data.items || [];
};

export const crearPlatoRequest = async (platoData, token) => {
  const headers = await crearHeaders(token);
  const response = await fetch(`${API_URL}/platos/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(platoData),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Error al crear plato');
  return data;
};

export const modificarPlatoRequest = async (platoId, datosPlato, token) => {
  const headers = await crearHeaders(token);
  const response = await fetch(`${API_URL}/platos/${platoId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(datosPlato),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Error al modificar plato');
  return data;
};

export const cambiarEstadoPlatoRequest = async (id, estadoOActivo, token) => {
  const headers = await crearHeaders(token);

  if (typeof estadoOActivo === 'string') {
    const response = await fetch(`${API_URL}/pedidos/detalles/${id}/estado`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ estado: estadoOActivo }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Error al cambiar detalle');
    return data;
  }

  const payload =
    typeof estadoOActivo === 'boolean'
      ? { activo: estadoOActivo, disponible: estadoOActivo }
      : estadoOActivo;

  return modificarPlatoRequest(id, payload, token);
};

export const cambiarEstadoDetallePedidoRequest = cambiarEstadoPlatoRequest;

// ==========================================
// 3. SALÓN Y MESAS
// ==========================================
export const obtenerMesasRequest = async (incluirInactivos = false, token) => {
  let paramInactivos = false;
  let authToken = token;
  if (typeof incluirInactivos === 'boolean') {
    paramInactivos = incluirInactivos;
  } else if (typeof incluirInactivos === 'string' && incluirInactivos.includes('.')) {
    authToken = incluirInactivos;
  }

  const headers = await crearHeaders(authToken);
  const response = await fetch(`${API_URL}/mesas/?incluir_inactivos=${paramInactivos}`, {
    method: 'GET',
    headers,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Error al obtener mesas');
  return Array.isArray(data) ? data : data.items || [];
};

export const crearMesaRequest = async (mesaData, token) => {
  const headers = await crearHeaders(token);
  const payload =
    typeof mesaData === 'object'
      ? mesaData
      : { numero_mesa: String(mesaData), estado: 'disponible' };

  const response = await fetch(`${API_URL}/mesas/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Error al crear mesa');
  return data;
};

export const cambiarEstadoMesaRequest = async (mesaId, nuevoEstado, token) => {
  const headers = await crearHeaders(token);

  // Mapeo exacto según tus EstadosValidos
  let estadoFinal = nuevoEstado;
  const normalizado = String(nuevoEstado).toUpperCase();
  if (normalizado === 'MANTENIMIENTO' || normalizado === 'FUERA_DE_SERVICIO') {
    estadoFinal = 'FUERA_DE_SERVICIO';
  } else if (normalizado === 'DISPONIBLE') {
    estadoFinal = 'DISPONIBLE';
  } else if (normalizado === 'OCUPADA') {
    estadoFinal = 'OCUPADA';
  } else if (normalizado === 'RESERVADA') {
    estadoFinal = 'RESERVADA';
  }

  const response = await fetch(`${API_URL}/mesas/${mesaId}/estado`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ estado: estadoFinal }),
  });

  const data = await response.json();
  if (!response.ok) {
    let errorMsg = 'Error al cambiar estado de la mesa';
    if (Array.isArray(data.detail)) {
      errorMsg = data.detail
        .map((err) => `${err.loc[err.loc.length - 1]}: ${err.msg}`)
        .join('\n');
    } else if (typeof data.detail === 'string') {
      errorMsg = data.detail;
    }
    throw new Error(errorMsg);
  }
  return data;
};

export const reactivarMesaRequest = async (mesaId, token) => {
  const headers = await crearHeaders(token);
  const response = await fetch(`${API_URL}/mesas/${mesaId}/activar`, {
    method: 'PATCH',
    headers,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Error al reactivar mesa');
  return data;
};

export const eliminarMesaRequest = async (mesaId, token) => {
  const headers = await crearHeaders(token);
  const response = await fetch(`${API_URL}/mesas/${mesaId}`, {
    method: 'DELETE',
    headers,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Error al eliminar mesa');
  return data;
};

// ==========================================
// 4. CATEGORÍAS
// ==========================================
export const obtenerCategoriasRequest = async (token) => {
  const headers = await crearHeaders(token);
  const response = await fetch(`${API_URL}/categorias`, { method: 'GET', headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Error al obtener categorías');
  return Array.isArray(data) ? data : data.items || [];
};

export const crearCategoriaRequest = async (categoriaData, token) => {
  const headers = await crearHeaders(token);
  const bodyPayload =
    typeof categoriaData === 'string' ? { nombre: categoriaData } : categoriaData;

  const response = await fetch(`${API_URL}/categorias/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(bodyPayload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Error al crear categoría');
  return data;
};

export const modificarCategoriaRequest = async (catId, datosCat, token) => {
  const headers = await crearHeaders(token);
  const response = await fetch(`${API_URL}/categorias/${catId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(datosCat),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Error al modificar categoría');
  return data;
};

export const cambiarEstadoCategoriaRequest = async (catId, activo, token) => {
  return modificarCategoriaRequest(catId, { activo }, token);
};

// ==========================================
// 5. PEDIDOS Y FACTURACIÓN
// ==========================================
export const obtenerPedidosRequest = async (token) => {
  const headers = await crearHeaders(token);
  const response = await fetch(`${API_URL}/pedidos?limit=20`, { method: 'GET', headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Error al obtener pedidos');
  return data.items || data || [];
};

export const crearPedidoRequest = async (pedidoData, token) => {
  const headers = await crearHeaders(token);
  const response = await fetch(`${API_URL}/pedidos/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(pedidoData),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Error al enviar pedido');
  return data;
};

export const cambiarEstadoPedidoRequest = async (pedidoId, nuevoEstado, token) => {
  const headers = await crearHeaders(token);
  const response = await fetch(`${API_URL}/pedidos/${pedidoId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ estado: nuevoEstado }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Error al actualizar pedido');
  return data;
};

export const facturarPedidoRequest = async (pedidoId, tipoPago, token, comprobanteUrl = null) => {
  const headers = await crearHeaders(token);
  const response = await fetch(`${API_URL}/pedidos/${pedidoId}/facturar`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      tipo_pago: tipoPago,
      comprobante_img_url: comprobanteUrl,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Error al facturar pedido');
  return data;
};

export const cobrarPedidoRequest = facturarPedidoRequest;

// ==========================================
// 6. SUBIDA A CLOUDINARY
// ==========================================
export const subirFotoComprobanteRequest = async (fotoUri, token) => {
  const headers = await crearHeaders(token, true);
  const responseFoto = await fetch(fotoUri);
  const rawBlob = await responseFoto.blob();
  const imageBlob = new Blob([rawBlob], { type: 'image/jpeg' });

  const formData = new FormData();
  formData.append('file', imageBlob, 'comprobante.jpg');

  const response = await fetch(`${API_URL}/upload/file?tipo=comprobantes`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Error al subir comprobante');
  return data.img_url;
};

export const subirFotoPlatoRequest = async (fotoUri, token) => {
  const headers = await crearHeaders(token, true);
  const responseFoto = await fetch(fotoUri);
  const rawBlob = await responseFoto.blob();
  const imageBlob = new Blob([rawBlob], { type: 'image/jpeg' });

  const formData = new FormData();
  formData.append('file', imageBlob, 'plato.jpg');

  const response = await fetch(`${API_URL}/upload/file?tipo=platos`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Error al subir imagen del plato');
  return data.img_url;
};

// ==========================================
// 7. ADMINISTRACIÓN Y ESTADÍSTICAS (DUEÑO)
// ==========================================
export const obtenerCierreCajaRequest = async (fechaOauthToken = null, token = null) => {
  let paramFecha = null;
  let authToken = null;

  // Si el primer argumento es una fecha tipo "2026-09-27"
  if (typeof fechaOauthToken === 'string' && (fechaOauthToken.includes('-') || fechaOauthToken.includes('/'))) {
    paramFecha = fechaOauthToken;
    authToken = token;
  } else if (typeof fechaOauthToken === 'string' && (fechaOauthToken.startsWith('ey') || fechaOauthToken.includes('.'))) {
    // Si pasaron directamente el token
    authToken = fechaOauthToken;
  } else {
    authToken = token;
  }

  const headers = await crearHeaders(authToken);
  let url = `${API_URL}/admin/estadisticas/resumen-cierre`;
  if (paramFecha) {
    url += `?fecha=${paramFecha}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Error al obtener estadísticas');
  return data;
};

// Alias que utilizan tus otras pantallas
export const obtenerMetricasRequest = obtenerCierreCajaRequest;

// Historial de ventas paginado con comandas y fotos
export const obtenerHistorialVentasRequest = async (
  pagina = 1,
  tamanoPagina = 10,
  fechaInicio = null,
  fechaFin = null,
  token = null
) => {
  const headers = await crearHeaders(token);
  const params = new URLSearchParams();
  if (pagina) params.append('pagina', String(pagina));
  if (tamanoPagina) params.append('tamano_pagina', String(tamanoPagina));
  if (fechaInicio) params.append('fecha_inicio', fechaInicio);
  if (fechaFin) params.append('fecha_fin', fechaFin);

  const qs = params.toString();
  const url = `${API_URL}/admin/estadisticas/historial-ventas${qs ? `?${qs}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Error al obtener historial de ventas');
  return data;
};

export const obtenerUsuariosRequest = async (incluirInactivos = false, token) => {
  let paramInactivos = false;
  let authToken = token;
  if (typeof incluirInactivos === 'boolean') {
    paramInactivos = incluirInactivos;
  } else if (typeof incluirInactivos === 'string' && incluirInactivos.includes('.')) {
    authToken = incluirInactivos;
  }

  const headers = await crearHeaders(authToken);
  const response = await fetch(`${API_URL}/usuarios?incluir_inactivos=${paramInactivos}`, {
    method: 'GET',
    headers,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Error al obtener usuarios');
  return Array.isArray(data) ? data : data.items || [];
};

export const crearUsuarioRequest = async (userData, token) => {
  const headers = await crearHeaders(token);
  const response = await fetch(`${API_URL}/usuarios/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(userData),
  });
  const data = await response.json();
  if (!response.ok) {
    let errorMsg = 'Error al crear usuario';
    if (Array.isArray(data.detail)) {
      errorMsg = data.detail
        .map((err) => `${err.loc[err.loc.length - 1]}: ${err.msg}`)
        .join('\n');
    } else if (typeof data.detail === 'string') {
      errorMsg = data.detail;
    }
    throw new Error(errorMsg);
  }
  return data;
};
export const registrarUsuarioRequest = crearUsuarioRequest;

export const modificarUsuarioRequest = async (userId, datosUser, token) => {
  const headers = await crearHeaders(token);
  const response = await fetch(`${API_URL}/usuarios/${userId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(datosUser),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Error al modificar usuario');
  return data;
};

export const cambiarEstadoUsuarioRequest = async (userId, activo, rol = null, token = null) => {
  const payload = { activo };
  if (rol) {
    payload.rol = rol;
  }
  return modificarUsuarioRequest(userId, payload, token);
};