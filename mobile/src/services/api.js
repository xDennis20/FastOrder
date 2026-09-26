const API_URL = process.env.EXPO_PUBLIC_API_URL;

// 1. Iniciar Sesión (Login)
export const loginRequest = async (email, password) => {
  const formData = new URLSearchParams();
  formData.append('username', email);
  formData.append('password', password);

  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = typeof data.detail === 'string'
      ? data.detail
      : 'Credenciales o datos inválidos';
    throw new Error(errorMsg);
  }

  return data;
};

// 2. Obtener lista de pedidos activos (Cocina / KDS)
export const obtenerPedidosRequest = async (token) => {
  const response = await fetch(`${API_URL}/pedidos?limit=20`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || 'Error al obtener los pedidos');
  }

  return data.items || []; // Retorna la lista de pedidos
};

// 3. Cambiar estado de un plato en cocina (Pendiente -> En preparación -> Listo)
export const cambiarEstadoPlatoRequest = async (detalleId, nuevoEstado, token) => {
  const response = await fetch(`${API_URL}/pedidos/detalles/${detalleId}/estado`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ estado: nuevoEstado }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || 'Error al actualizar el estado del plato');
  }

  return data;
};

// 4. Cobrar y facturar un pedido
export const facturarPedidoRequest = async (pedidoId, tipoPago, token, comprobanteUrl = null) => {
  const response = await fetch(`${API_URL}/pedidos/${pedidoId}/facturar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      tipo_pago: tipoPago, // "Efectivo" o "Transferencia"
      comprobante_img_url: comprobanteUrl,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || 'Error al facturar el pedido');
  }

  return data;
};

// Obtener categorías con sus platos incluidos
export const obtenerCategoriasRequest = async (token) => {
  const response = await fetch(`${API_URL}/categorias`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Error al obtener categorías');
  return data;
};

// Obtener mesas activas para saber a cuál asignar el pedido
export const obtenerMesasRequest = async (token) => {
  const response = await fetch(`${API_URL}/mesas`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Error al obtener mesas');
  return data;
};

// Enviar el pedido a cocina
export const crearPedidoRequest = async (pedidoData, token) => {
  const response = await fetch(`${API_URL}/pedidos/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(pedidoData),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Error al enviar pedido');
  return data;
};

export const subirFotoComprobanteRequest = async (fotoUri, token) => {
  const responseFoto = await fetch(fotoUri);
  const rawBlob = await responseFoto.blob();

  const imageBlob = new Blob([rawBlob], { type: 'image/jpeg' });

  const formData = new FormData();
  formData.append('file', imageBlob, 'comprobante.jpg');

  const response = await fetch(`${API_URL}/upload/file?tipo=comprobantes`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Error al subir la imagen a Cloudinary');
  }

  return data.img_url; // https://res.cloudinary.com/...
};

