import { useEffect, useRef, useCallback } from "react";
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";
import { Platform, Vibration } from "react-native";

export interface CalledTicketSoundConfig {
  enabled?: boolean;
  repeatIntervalSeconds?: number;
}

interface UseCalledTicketSoundReturn {
  stopSound: () => void;
}

// Configurer les notifications pour utiliser le son système
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: false, // Ajout requis pour satisfaire le type
    shouldShowList: false,   // Ajout requis pour satisfaire le type
  }),
});

export function useCalledTicketSound(
  isCalled: boolean,
  config: CalledTicketSoundConfig = {},
): UseCalledTicketSoundReturn {
  const {
    enabled = true,
    repeatIntervalSeconds = 30,
  } = config;

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  // Demander la permission pour les notifications
  useEffect(() => {
    const requestPermissions = async () => {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          console.log("[useCalledTicketSound] Notification permission not granted");
        }
        
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("alerts", {
            name: "Alertes",
            importance: Notifications.AndroidImportance.HIGH,
            sound: "default", // Son système par défaut
            vibrationPattern: [0, 800, 300, 800],
            enableVibrate: true,
          });
        }
      } catch (error) {
        console.log("[useCalledTicketSound] Permission error:", error);
      }
    };
    requestPermissions();
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const playNotification = useCallback(async () => {
    if (!enabled || !isMountedRef.current) return;

    // Haptic
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {}

    // Vibration
    try {
      if (Platform.OS === "ios") {
        Vibration.vibrate([0, 500, 200, 500]);
      } else {
        Vibration.vibrate([0, 800, 300, 800]);
      }
    } catch {}

    // Notification silencieuse avec son système
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Votre tour est arrivé !",
          body: "Présentez-vous au guichet",
          sound: true, // Utilise le son système par défaut
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Immédiat
      });
    } catch (error) {
      console.log("[useCalledTicketSound] Notification error:", error);
    }
  }, [enabled]);

  const stopSound = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    try {
      Vibration.cancel();
      Notifications.dismissAllNotificationsAsync();
    } catch {}
  }, []);

  useEffect(() => {
    if (!isCalled || !enabled) {
      stopSound();
      return;
    }

    playNotification();

    const intervalMs = Math.max(10000, repeatIntervalSeconds * 1000);
    intervalRef.current = setInterval(() => {
      if (isMountedRef.current) {
        playNotification();
      }
    }, intervalMs);

    return () => stopSound();
  }, [isCalled, enabled, repeatIntervalSeconds, playNotification, stopSound]);

  return { stopSound };
}