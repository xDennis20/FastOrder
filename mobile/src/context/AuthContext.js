import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Al abrir la app, recupera la sesión guardada del almacenamiento local
  useEffect(() => {
    const verificarSesion = async () => {
      try {
        const tokenGuardado = await AsyncStorage.getItem('user_token');
        const usuarioGuardado = await AsyncStorage.getItem('user_data');

        if (tokenGuardado) {
          setToken(tokenGuardado);
          setUsuario(JSON.parse(usuarioGuardado));
        }
      } catch (error) {
        console.error('Error recuperando sesión:', error);
      } finally {
        setCargando(false);
      }
    };

    verificarSesion();
  }, []);

  const iniciarSesion = async (jwtToken, datosUsuario) => {
    setToken(jwtToken);
    setUsuario(datosUsuario);
    await AsyncStorage.setItem('user_token', jwtToken);
    await AsyncStorage.setItem('user_data', JSON.stringify(datosUsuario));
  };

  const cerrarSesion = async () => {
    setToken(null);
    setUsuario(null);
    await AsyncStorage.removeItem('user_token');
    await AsyncStorage.removeItem('user_data');
  };

  return (
    <AuthContext.Provider value={{ token, usuario, iniciarSesion, cerrarSesion, cargando }}>
      {children}
    </AuthContext.Provider>
  );
};