import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AlertPreferences,
  AlertChannel,
  MarginOption,
  DEFAULT_ALERT_PREFERENCES,
} from '../types/alertPreferences';
import axiosClient from '../api/axiosClient';

interface AlertPreferencesState extends AlertPreferences {
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setChannels: (channels: AlertChannel[]) => void;
  setMarginMinutes: (minutes: number, option?: MarginOption) => void;
  setEnableSafetyAlert: (enabled: boolean) => void;
  setPhoneNumber: (phone: string) => void;
  setPreferredTransportMode: (mode: 'walking' | 'motorcycle' | 'car') => void;
  
  // API Actions
  loadPreferences: () => Promise<void>;
  savePreferences: () => Promise<void>;
  resetToDefaults: () => void;
}

export const useAlertPreferencesStore = create<AlertPreferencesState>()(
  persist(
    (set, get) => ({
      // Initial state from defaults
      ...DEFAULT_ALERT_PREFERENCES,
      isLoading: false,
      error: null,

      // Setters
      setChannels: (channels) => {
        set({ channels });
        get().savePreferences();
      },

      setMarginMinutes: (minutes, option) => {
        set({
          marginMinutes: minutes,
          // Une marge hors préréglages (5/10/15/20) correspond à l'option "custom"
          marginOption: option ?? ([5, 10, 15, 20].includes(minutes) ? (minutes as MarginOption) : 'custom'),
        });
        get().savePreferences();
      },

      setEnableSafetyAlert: (enabled) => {
        set({ enableSafetyAlert: enabled });
        get().savePreferences();
      },

      setPhoneNumber: (phone) => {
        set({ phoneNumber: phone });
        get().savePreferences();
      },

      setPreferredTransportMode: (mode) => {
        set({ preferredTransportMode: mode });
        get().savePreferences();
      },

      // API Actions
      loadPreferences: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await axiosClient.get('/user/alert-preferences');
          const prefs = response.data?.data || response.data;
          set({
            ...prefs,
            isLoading: false,
            error: null,
          });
        } catch (error: any) {
          console.warn('Failed to load alert preferences:', error);
          set({ isLoading: false, error: null }); // Use defaults on error
        }
      },

      savePreferences: async () => {
        const state = get();
        const { isLoading, error, ...prefs } = state;
        
        try {
          await axiosClient.put('/user/alert-preferences', prefs);
        } catch (error: any) {
          console.warn('Failed to save alert preferences:', error);
        }
      },

      resetToDefaults: () => {
        set(DEFAULT_ALERT_PREFERENCES);
        get().savePreferences();
      },
    }),
    {
      name: 'alert-preferences',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        channels: state.channels,
        marginMinutes: state.marginMinutes,
        marginOption: state.marginOption,
        enableSafetyAlert: state.enableSafetyAlert,
        phoneNumber: state.phoneNumber,
        preferredTransportMode: state.preferredTransportMode,
      }),
    }
  )
);
