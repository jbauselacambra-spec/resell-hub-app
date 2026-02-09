import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Servicio de notificaciones para alertas de resubida
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export class NotificationService {
  static async initialize() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B35',
      });

      await Notifications.setNotificationChannelAsync('repost-alerts', {
        name: 'Alertas de Resubida',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFB800',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return false;
    }

    return true;
  }

  /**
   * Programa notificación de resubida
   */
  static async scheduleRepostNotification(product, daysThreshold = 60) {
    const daysSinceProcessed = this.getDaysSince(new Date(product.processedDate));
    
    if (daysSinceProcessed >= daysThreshold) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ Producto para resubir',
          body: `"${product.title}" lleva ${daysSinceProcessed} días sin venderse`,
          data: { productId: product.id, type: 'repost_alert' },
          sound: true,
          badge: 1,
        },
        trigger: null, // Inmediata
      });
    }
  }

  /**
   * Programa notificación para producto sin vistas
   */
  static async scheduleNoViewsNotification(product, daysThreshold = 7) {
    const daysSinceProcessed = this.getDaysSince(new Date(product.processedDate));
    
    if (daysSinceProcessed >= daysThreshold && product.views < 10) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '👀 Producto sin interés',
          body: `"${product.title}" solo tiene ${product.views} vistas en ${daysSinceProcessed} días`,
          data: { productId: product.id, type: 'low_views' },
          sound: true,
        },
        trigger: null,
      });
    }
  }

  /**
   * Notificación de resumen semanal
   */
  static async scheduleWeeklySummary(stats) {
    const trigger = {
      weekday: 1, // Lunes
      hour: 10,
      minute: 0,
      repeats: true,
    };

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📊 Resumen Semanal',
        body: `Vendidos: ${stats.sold} | Activos: ${stats.active} | Ingresos: ${stats.revenue}€`,
        data: { type: 'weekly_summary' },
        sound: true,
      },
      trigger,
    });
  }

  /**
   * Notificación instantánea
   */
  static async sendInstantNotification(title, body, data = {}) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: null,
    });
  }

  /**
   * Cancela todas las notificaciones programadas
   */
  static async cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  /**
   * Cancela notificación específica
   */
  static async cancelNotification(notificationId) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  /**
   * Obtiene todas las notificaciones programadas
   */
  static async getScheduledNotifications() {
    return await Notifications.getAllScheduledNotificationsAsync();
  }

  /**
   * Helper: Calcula días desde una fecha
   */
  static getDaysSince(date) {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Configura listener para cuando el usuario toca una notificación
   */
  static addNotificationResponseListener(callback) {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }
}

// ============== EJEMPLO DE USO ==============

/*
// 1. Inicializar servicio
await NotificationService.initialize();

// 2. Programar notificación de resubida
await NotificationService.scheduleRepostNotification(product, 60);

// 3. Notificación instantánea
await NotificationService.sendInstantNotification(
  '✅ Producto vendido',
  'iPhone 13 Pro se ha marcado como vendido'
);

// 4. Escuchar cuando el usuario toca una notificación
NotificationService.addNotificationResponseListener((response) => {
  const { productId, type } = response.notification.request.content.data;
  
  if (type === 'repost_alert') {
    // Navegar a la pantalla del producto
    navigation.navigate('ProductDetail', { id: productId });
  }
});

// 5. Resumen semanal
await NotificationService.scheduleWeeklySummary({
  sold: 12,
  active: 8,
  revenue: 1245,
});
*/
