import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { loginRequest } from '../services/api';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorLocal, setErrorLocal] = useState(''); // Errores de validación del formulario
  const [cargando, setCargando] = useState(false);

  const { iniciarSesion } = useContext(AuthContext);

  const handleLogin = async () => {
    setErrorLocal(''); // Limpiar errores previos

    // 1. Validación de campos obligatorios
    if (!email.trim() || !password.trim()) {
      setErrorLocal('Todos los campos son obligatorios.');
      return;
    }

    // 2. Validación de formato de correo (Regex básico)
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email)) {
      setErrorLocal('Ingresa un formato de correo electrónico válido.');
      return;
    }

    setCargando(true);
    try {
      // Llamada al backend (FastAPI)
      const data = await loginRequest(email, password);

      // Si el backend responde 200 OK, guardamos el token y datos básicos
      await iniciarSesion(data.access_token, { email: email.toLowerCase() });

    } catch (error) {
      // 3. Manejo de errores del servidor (Credenciales incorrectas)
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

        {/* Caja de errores dinámicos */}
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
    backgroundColor: '#121212', // Fondo oscuro tipo terminal KDS
    justifyContent: 'center',
  },
  formContainer: {
    paddingHorizontal: 32,
  },
  logo: {
    fontSize: 42,
    fontWeight: '900',
    color: '#ea580c', // Naranja vibrante
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
    backgroundColor: '#ea580c', // Botón principal naranja
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4, // Sombra en Android
  },
  buttonDisabled: {
    backgroundColor: '#9a3412', // Naranja apagado si está cargando
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
    backgroundColor: '#7f1d1d', // Rojo oscuro para el contenedor
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