import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { loginRequest } from '../services/api';

function decodificarToken(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.warn('No se pudo decodificar el token, usando datos por defecto:', error);
    return {};
  }
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorLocal, setErrorLocal] = useState('');
  const [cargando, setCargando] = useState(false);

  const { iniciarSesion } = useContext(AuthContext);

  const handleLogin = async () => {
    setErrorLocal('');

    // 1. Validar que no haya campos vacíos
    if (!email.trim() || !password.trim()) {
      setErrorLocal('Todos los campos son obligatorios.');
      return;
    }

    // 2. Validar formato de correo
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email)) {
      setErrorLocal('Ingresa un formato de correo electrónico válido.');
      return;
    }

    setCargando(true);
    try {
      // 3. Llamar al backend de FastAPI
      const data = await loginRequest(email, password);

      // 4. Extraer el rol, nombre y restaurante desde el token
      const datosToken = decodificarToken(data.access_token);

      // 5. Guardar la sesión completa en el teléfono
      await iniciarSesion(data.access_token, {
        email: datosToken.email || email.toLowerCase(),
        nombre: datosToken.username || 'Operador',
        rol: datosToken.rol || 'STAFF',
        restaurante_id: datosToken.restaurante_id || null,
        user_id: datosToken.user_id || null,
      });

    } catch (error) {
      setErrorLocal(error.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.formContainer}>
        <Text style={styles.logo}>FastOrder</Text>
        <Text style={styles.subtitle}>Terminal del Sistema</Text>

        {/* Mensaje de error si las credenciales fallan */}
        {errorLocal ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorLocal}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>CORREO ELECTRÓNICO</Text>
        <TextInput
          style={styles.input}
          placeholder="ejemplo@restaurante.com"
          placeholderTextColor="#6b7280"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>CONTRASEÑA</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor="#6b7280"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, cargando && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={cargando}
        >
          {cargando ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.buttonText}>INGRESAR AL SISTEMA</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    justifyContent: 'center',
  },
  formContainer: {
    paddingHorizontal: 32,
  },
  logo: {
    fontSize: 42,
    fontWeight: '900',
    color: '#ea580c',
    textAlign: 'center',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 40,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  label: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: '#1f2937',
    color: '#f9fafb',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#374151',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#ea580c',
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#9a3412',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 1,
  },
  errorBox: {
    backgroundColor: '#7f1d1d',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#b91c1c',
  },
  errorText: {
    color: '#fca5a5',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
});