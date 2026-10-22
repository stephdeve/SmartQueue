import axiosClient from "./axiosClient";

// Types pour les notifications
export interface Notification {
  id: string; // UUID from Laravel notifications table
  user_id: number;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error" | "user_en_route";
  read_at?: string;
  created_at: string;
  data?: {
    ticket_id?: number;
    establishment_id?: number;
    service_id?: number;
    action?: string;
    ticket_number?: string;
    estimated_minutes?: number;
  };
}

export interface NotificationListResponse {
  data: Notification[];
  unread_count: number;
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface NotificationPreferences {
  push_enabled: boolean;
  sms_enabled: boolean;
  email_enabled: boolean;
  position_updates: boolean;
  queue_alerts: boolean;
  promotions: boolean;
  reminders: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

export interface DeviceRegistration {
  device_id: string;
  platform: "ios" | "android";
  token: string; // FCM token
  app_version: string;
  os_version: string;
}

// Fonctions API pour les notifications
export const notificationsApi = {
  // Obtenir la liste des notifications
  getNotifications: async (
    page: number = 1,
    perPage: number = 20,
  ): Promise<NotificationListResponse> => {
    const response = await axiosClient.get("/notifications", {
      params: { page, per_page: perPage },
    });
    return response.data;
  },

  // Marquer une notification comme lue
  markAsRead: async (notificationId: string): Promise<void> => {
    await axiosClient.post(`/notifications/${notificationId}/read`);
  },

  // Marquer toutes les notifications comme lues
  markAllAsRead: async (): Promise<void> => {
    await axiosClient.post("/notifications/mark-all-read");
  },

  // Supprimer une notification
  deleteNotification: async (notificationId: string): Promise<void> => {
    await axiosClient.delete(`/notifications/${notificationId}`);
  },

  // Obtenir le nombre de notifications non lues
  getUnreadCount: async (): Promise<{ count: number }> => {
    const response = await axiosClient.get("/notifications/unread-count");
    return response.data;
  },

  // Obtenir les préférences de notification
  getPreferences: async (): Promise<NotificationPreferences> => {
    const response = await axiosClient.get("/notification-preferences");
    return response.data;
  },

  // Mettre à jour les préférences de notification
  updatePreferences: async (
    preferences: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> => {
    const response = await axiosClient.put(
      "/notification-preferences",
      preferences,
    );
    return response.data;
  },

  // Enregistrer un appareil pour les notifications push
  registerDevice: async (deviceData: DeviceRegistration): Promise<void> => {
    await axiosClient.post("/auth/devices/register", deviceData);
  },

  // Désenregistrer le token push courant
  unregisterDevice: async (fcmToken: string): Promise<void> => {
    await axiosClient.delete("/auth/devices/current", {
      data: { fcm_token: fcmToken },
    });
  },

  // Activer/Désactiver les notifications push
  togglePushNotifications: async (enabled: boolean): Promise<void> => {
    await axiosClient.put("/notification-preferences", {
      push_enabled: enabled,
    });
  },

  // Activer/Désactiver les notifications SMS
  toggleSmsNotifications: async (enabled: boolean): Promise<void> => {
    await axiosClient.put("/notification-preferences", {
      sms_enabled: enabled,
    });
  },

  // Configurer les heures silencieuses
  setQuietHours: async (
    startTime: string,
    endTime: string,
    enabled: boolean,
  ): Promise<void> => {
    await axiosClient.put("/notification-preferences", {
      quiet_hours_enabled: enabled,
      quiet_hours_start: startTime,
      quiet_hours_end: endTime,
    });
  },

};

export default notificationsApi;
