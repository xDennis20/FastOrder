import React, { useContext } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthContext } from '../context/AuthContext';

// Pantallas
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import PedidosScreen from '../screens/PedidosScreen';
import PerfilScreen from '../screens/PerfilScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { token, cargando } = useContext(AuthContext);

  // Mientras AsyncStorage revisa si hay un token guardado en el teléfono
  if (cargando) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ea580c" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#18181b' }, // Encabezado oscuro KDS
        headerTintColor: '#ea580c', // Botones y títulos de navegación en naranja
        headerTitleStyle: { fontWeight: 'bold', color: '#f3f4f6' },
        contentStyle: { backgroundColor: '#121212' },
      }}
    >
      {token === null ? (
        // ÁRBOL PÚBLICO: Solo accesible si NO hay sesión activa
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      ) : (
        // ÁRBOL PRIVADO: Solo existe en memoria si el token existe
        <>
          <Stack.Screen
            name="Inicio"
            component={HomeScreen}
            options={{ title: 'FastOrder - Panel' }}
          />
          <Stack.Screen
            name="Pedidos"
            component={PedidosScreen}
            options={{ title: 'Cocina / Pedidos' }}
          />
          <Stack.Screen
            name="Perfil"
            component={PerfilScreen}
            options={{ title: 'Detalles de Sesión' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
  },
});