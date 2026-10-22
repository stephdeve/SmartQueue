import axiosClient from './axiosClient';

// Types pour les utilisateurs
export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  created_at: string;
  updated_at: string;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  phone?: string;
  avatar?: string;
}

export interface UserPreferences {
  push_notifications_enabled: boolean;
  sms_notifications_enabled: boolean;
  email_notifications_enabled: boolean;
  vibration_enabled: boolean;
  sound_enabled: boolean;
  language: string;
  dark_mode: boolean;
  location_sharing: boolean;
  proximity_alerts: boolean;
}

export interface NotificationPreferences {
  push_enabled: boolean;
  sms_enabled: boolean;
  email_enabled: boolean;
  position_updates: boolean;
  queue_alerts: boolean;
  promotions: boolean;
  reminders: boolean;
}

export interface AvatarData {
  avatar: string; // base64 encoded image
}

// Fonctions API pour les utilisateurs
export const usersApi = {
  // Obtenir le profil utilisateur courant
  getProfile: async (): Promise<User> => {
    const response = await axiosClient.get('/me');
    return response.data;
  },

  // Mettre à jour le profil utilisateur
  updateProfile: async (data: UpdateUserData): Promise<User> => {
    const response = await axiosClient.patch('/me', data);
    return response.data.user ?? response.data;
  },

  // Préférences utilisateur : seuls push/SMS sont stockés côté serveur
  // (/notification-preferences, utilisé pour les alertes « votre tour approche »).
  // Les autres (thème, langue, son…) restent locales (store persisté).
  getPreferences: async (): Promise<Partial<UserPreferences>> => {
    const response = await axiosClient.get('/notification-preferences');
    const prefs = response.data?.data ?? response.data ?? {};
    return {
      push_notifications_enabled: prefs.push_enabled ?? true,
      sms_notifications_enabled: prefs.sms_enabled ?? false,
    };
  },

  updatePreferences: async (preferences: Partial<UserPreferences>): Promise<Partial<UserPreferences>> => {
    const payload: Record<string, boolean> = {};
    if (preferences.push_notifications_enabled !== undefined) payload.push_enabled = preferences.push_notifications_enabled;
    if (preferences.sms_notifications_enabled !== undefined) payload.sms_enabled = preferences.sms_notifications_enabled;
    if (Object.keys(payload).length === 0) return {};

    const response = await axiosClient.put('/notification-preferences', payload);
    const prefs = response.data?.data ?? response.data ?? {};
    return {
      push_notifications_enabled: prefs.push_enabled ?? preferences.push_notifications_enabled,
      sms_notifications_enabled: prefs.sms_enabled ?? preferences.sms_notifications_enabled,
    };
  },

  // Obtenir les préférences de notification (réponse API enveloppée dans { data })
  getNotificationPreferences: async (): Promise<Partial<NotificationPreferences>> => {
    const response = await axiosClient.get('/notification-preferences');
    return response.data?.data ?? response.data ?? {};
  },

  // Mettre à jour les préférences de notification (le serveur ignore les clés inconnues)
  updateNotificationPreferences: async (preferences: Partial<NotificationPreferences>): Promise<Partial<NotificationPreferences>> => {
    const response = await axiosClient.put('/notification-preferences', preferences);
    return response.data?.data ?? response.data ?? {};
  },

  // Changer le mot de passe
  changePassword: async (currentPassword: string, newPassword: string, confirmPassword: string): Promise<void> => {
    await axiosClient.post('/me/change-password', {
      current_password: currentPassword,
      password: newPassword,
      password_confirmation: confirmPassword,
    });
  },

  // Supprimer le compte utilisateur
  deleteAccount: async (password: string): Promise<void> => {
    await axiosClient.delete('/me', { data: { password } });
  },

};

export default usersApi;
