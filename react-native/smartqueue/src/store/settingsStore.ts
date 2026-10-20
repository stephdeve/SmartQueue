import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usersApi, UserPreferences, NotificationPreferences } from '../api/usersApi';
import { getToken } from '../api/axiosClient';

// Types pour le store de paramètres
export interface SettingsState {
  // Préférences utilisateur
  preferences: UserPreferences;
  notificationPreferences: NotificationPreferences;
  
  // État de l'application
  isDarkMode: boolean;
  language: string;
  isFirstLaunch: boolean;
  onboardingCompleted: boolean;
  
  // Localisation
  locationPermission: 'granted' | 'denied' | 'not_determined';
  notificationsPermission: 'granted' | 'denied' | 'not_determined';
  
  // État de chargement
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setDarkMode: (enabled: boolean) => void;
  setLanguage: (language: string) => void;
  setFirstLaunch: (firstLaunch: boolean) => void;
  setOnboardingCompleted: (completed: boolean) => void;
  setLocationPermission: (permission: 'granted' | 'denied' | 'not_determined') => void;
  setNotificationsPermission: (permission: 'granted' | 'denied' | 'not_determined') => void;
  updatePreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
  updateNotificationPreferences: (preferences: Partial<NotificationPreferences>) => Promise<void>;
  loadPreferences: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  resetSettings: () => void;
}

// Préférences par défaut
const defaultUserPreferences: UserPreferences = {
  push_notifications_enabled: true,
  sms_notifications_enabled: false,
  email_notifications_enabled: true,
  vibration_enabled: true,
  sound_enabled: true,
  language: 'fr',
  dark_mode: false,
  location_sharing: true,
  proximity_alerts: true,
};

const defaultNotificationPreferences: NotificationPreferences = {
  push_enabled: true,
  sms_enabled: false,
  email_enabled: true,
  position_updates: true,
  queue_alerts: true,
  promotions: false,
  reminders: true,
};

// Store de paramètres avec Zustand
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // État initial
      preferences: defaultUserPreferences,
      notificationPreferences: defaultNotificationPreferences,
      isDarkMode: false,
      language: 'fr',
      isFirstLaunch: true,
      onboardingCompleted: false,
      locationPermission: 'not_determined',
      notificationsPermission: 'not_determined',
      isLoading: false,
      error: null,

      // Activer/Désactiver le mode sombre
      setDarkMode: (enabled: boolean) => {
        set({
          isDarkMode: enabled,
          preferences: { ...get().preferences, dark_mode: enabled },
        });
      },

      // Définir la langue
      setLanguage: (language: string) => {
        set({
          language,
          preferences: { ...get().preferences, language },
        });
      },

      // Définir si c'est le premier lancement
      setFirstLaunch: (firstLaunch: boolean) => {
        set({ isFirstLaunch: firstLaunch });
      },

      // Définir si l'onboarding est complété
      setOnboardingCompleted: (completed: boolean) => {
        set({ onboardingCompleted: completed });
      },

      // Définir la permission de localisation
      setLocationPermission: (permission: 'granted' | 'denied' | 'not_determined') => {
        set({ locationPermission: permission });
      },

      // Définir la permission de notifications
      setNotificationsPermission: (permission: 'granted' | 'denied' | 'not_determined') => {
        set({ notificationsPermission: permission });
      },

      // Mettre à jour les préférences utilisateur
      updatePreferences: async (preferencesUpdate: Partial<UserPreferences>) => {
        set({ isLoading: true, error: null });

        try {
          const serverPreferences = await usersApi.updatePreferences(preferencesUpdate);
          const preferences = { ...get().preferences, ...preferencesUpdate, ...serverPreferences };

          set({
            preferences,
            isDarkMode: preferences.dark_mode,
            language: preferences.language,
            isLoading: false,
            error: null,
          });
        } catch (error: any) {
          const errorMessage = error.response?.data?.message || 'Erreur lors de la mise à jour des préférences';
          set({
            isLoading: false,
            error: errorMessage,
          });
          throw error;
        }
      },

      // Mettre à jour les préférences de notification
      updateNotificationPreferences: async (preferencesUpdate: Partial<NotificationPreferences>) => {
        set({ isLoading: true, error: null });

        try {
          const updatedPreferences = await usersApi.updateNotificationPreferences(preferencesUpdate);

          set({
            notificationPreferences: { ...get().notificationPreferences, ...preferencesUpdate, ...updatedPreferences },
            isLoading: false,
            error: null,
          });
        } catch (error: any) {
          const errorMessage = error.response?.data?.message || 'Erreur lors de la mise à jour des préférences de notification';
          set({
            isLoading: false,
            error: errorMessage,
          });
          throw error;
        }
      },

      // Charger les préférences depuis l'API
      loadPreferences: async () => {
        set({ isLoading: true, error: null });

        try {
          const token = await getToken();
          if (!token) {
            set({ isLoading: false, error: null });
            return;
          }
          const [userPreferences, notificationPreferences] = await Promise.all([
            usersApi.getPreferences(),
            usersApi.getNotificationPreferences(),
          ]);

          // Fusion : le serveur fait foi pour push/SMS, le reste est local
          set({
            preferences: { ...get().preferences, ...userPreferences },
            notificationPreferences: { ...get().notificationPreferences, ...notificationPreferences },
            isLoading: false,
            error: null,
          });
        } catch (error: any) {
          const errorMessage = error.response?.data?.message || 'Erreur lors du chargement des préférences';
          set({
            isLoading: false,
            error: errorMessage,
          });
          return;
        }
      },

      // Définir l'état de chargement
      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      // Définir l'erreur
      setError: (error: string | null) => {
        set({ error });
      },

      // Effacer l'erreur
      clearError: () => {
        set({ error: null });
      },

      // Réinitialiser tous les paramètres
      resetSettings: () => {
        set({
          preferences: defaultUserPreferences,
          notificationPreferences: defaultNotificationPreferences,
          isDarkMode: false,
          language: 'fr',
          isFirstLaunch: true,
          onboardingCompleted: false,
          locationPermission: 'not_determined',
          notificationsPermission: 'not_determined',
          error: null,
        });
      },
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        preferences: state.preferences,
        notificationPreferences: state.notificationPreferences,
        isDarkMode: state.isDarkMode,
        language: state.language,
        isFirstLaunch: state.isFirstLaunch,
        onboardingCompleted: state.onboardingCompleted,
        locationPermission: state.locationPermission,
        notificationsPermission: state.notificationsPermission,
      }),
    }
  )
);

// Hooks personnalisés pour le store de paramètres
export const useSettings = () => {
  const settingsStore = useSettingsStore();
  
  return {
    // État
    preferences: settingsStore.preferences,
    notificationPreferences: settingsStore.notificationPreferences,
    isDarkMode: settingsStore.isDarkMode,
    language: settingsStore.language,
    isFirstLaunch: settingsStore.isFirstLaunch,
    onboardingCompleted: settingsStore.onboardingCompleted,
    locationPermission: settingsStore.locationPermission,
    notificationsPermission: settingsStore.notificationsPermission,
    isLoading: settingsStore.isLoading,
    error: settingsStore.error,
    
    // Actions
    setDarkMode: settingsStore.setDarkMode,
    setLanguage: settingsStore.setLanguage,
    setFirstLaunch: settingsStore.setFirstLaunch,
    setOnboardingCompleted: settingsStore.setOnboardingCompleted,
    setLocationPermission: settingsStore.setLocationPermission,
    setNotificationsPermission: settingsStore.setNotificationsPermission,
    updatePreferences: settingsStore.updatePreferences,
    updateNotificationPreferences: settingsStore.updateNotificationPreferences,
    loadPreferences: settingsStore.loadPreferences,
    setLoading: settingsStore.setLoading,
    setError: settingsStore.setError,
    clearError: settingsStore.clearError,
    resetSettings: settingsStore.resetSettings,
    
    // Computed properties
    pushNotificationsEnabled: settingsStore.preferences.push_notifications_enabled,
    smsNotificationsEnabled: settingsStore.preferences.sms_notifications_enabled,
    emailNotificationsEnabled: settingsStore.preferences.email_notifications_enabled,
    vibrationEnabled: settingsStore.preferences.vibration_enabled,
    soundEnabled: settingsStore.preferences.sound_enabled,
    locationSharingEnabled: settingsStore.preferences.location_sharing,
    proximityAlertsEnabled: settingsStore.preferences.proximity_alerts,
    positionUpdatesEnabled: settingsStore.notificationPreferences.position_updates,
    queueAlertsEnabled: settingsStore.notificationPreferences.queue_alerts,
    promotionsEnabled: settingsStore.notificationPreferences.promotions,
    remindersEnabled: settingsStore.notificationPreferences.reminders,
    
    // Permissions
    hasLocationPermission: settingsStore.locationPermission === 'granted',
    hasNotificationsPermission: settingsStore.notificationsPermission === 'granted',
    needsLocationPermission: settingsStore.locationPermission === 'not_determined',
    needsNotificationsPermission: settingsStore.notificationsPermission === 'not_determined',
  };
};

export default useSettingsStore;
