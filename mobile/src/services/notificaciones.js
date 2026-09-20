import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function configurarNotificaciones() {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('kds-pedidos', {
        name: 'Alertas de Cocina y Pedidos',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#ea580c',
        // Se omite 'sound': Android usa automáticamente el timbre predeterminado del sistema
      });
    } catch (e) {
      console.warn('No se pudo registrar el canal:', e);
    }
  }

  try {
    const { status: estadoExistente } = await Notifications.getPermissionsAsync();
    let estadoFinal = estadoExistente;

    if (estadoExistente !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      estadoFinal = status;
    }

    return estadoFinal === 'granted';
  } catch (error) {
    return true;
  }
}

export async function dispararNotificacionPedido({ titulo, cuerpo, datos = {} }) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: titulo,
        body: cuerpo,
        data: datos,
        sound: true, // Activa el timbre asignado al canal
        channelId: 'kds-pedidos',
      },
      trigger: null,
    });
  } catch (error) {
    console.warn('Error al disparar notificación local:', error);
  }
}