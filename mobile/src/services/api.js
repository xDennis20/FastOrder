const API_URL = process.env.EXPO_PUBLIC_API_URL;

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

  return data; // Retorna { access_token: "...", token_type: "bearer" }
};