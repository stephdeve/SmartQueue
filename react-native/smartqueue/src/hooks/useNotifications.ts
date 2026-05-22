/**
 * useNotifications — gestion complète des notifications push avec expo-notifications.
 *
 * Deux chemins automatiques :
 *  - Expo Go / EAS (dev)  → getExpoPushTokenAsync → ExponentPushToken[...]
 *                            Le backend appelle l'API Expo Push (proxy FCM gratuit)
 *  - EAS build production → getDevicePushTokenAsync → token FCM natif Android / APNs iOS
 *                            Le backend appelle directement l'API FCM HTTP v1
 *
 * Dans les deux cas : gratuit, tokens stockés dans PostgreSQL sur Railway.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axiosClient from "../api/axiosClient";
import { useCustomAlert } from "./useCustomAlert";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NotificationPermission {
  granted: boolean;
  canAskAgain: boolean;
  status: "granted" | "denied" | "disabled" | "restricted" | "undetermined";
}

export interface NotificationData {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
}

export interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  scheduledTime: Date;
  data?: Record<string, any>;
}

// ─── Foreground handler : affiche la notif même quand l'app est ouverte ───────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useNotifications = () => {
  const { showWarning } = useCustomAlert();

  const [permission, setPermission] = useState<NotificationPermission>({
    granted: false,
    canAskAgain: true,
    status: "undetermined",
  });
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduledNotifications, setScheduledNotifications] = useState<
    ScheduledNotification[]
  >([]);

  const foregroundListener = useRef<Notifications.EventSubscription | null>(
    null,
  );
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  // ── Vérifier la permission ────────────────────────────────────────────────
  const checkPermission =
    useCallback(async (): Promise<NotificationPermission> => {
      try {
        const { status, canAskAgain } =
          await Notifications.getPermissionsAsync();
        const perm: NotificationPermission = {
          granted: status === "granted",
          canAskAgain: canAskAgain ?? true,
          status: status as NotificationPermission["status"],
        };
        setPermission(perm);
        return perm;
      } catch (err) {
        console.error("[Notifications] checkPermission:", err);
        return { granted: false, canAskAgain: true, status: "denied" };
      }
    }, []);

  // ── Demander la permission ────────────────────────────────────────────────
  const requestPermission =
    useCallback(async (): Promise<NotificationPermission> => {
      setIsLoading(true);
      try {
        const { status, canAskAgain } =
          await Notifications.requestPermissionsAsync({
            ios: { allowAlert: true, allowBadge: true, allowSound: true },
          });
        const perm: NotificationPermission = {
          granted: status === "granted",
          canAskAgain: canAskAgain ?? true,
          status: status as NotificationPermission["status"],
        };
        setPermission(perm);
        return perm;
      } catch (err) {
        console.error("[Notifications] requestPermission:", err);
        return { granted: false, canAskAgain: true, status: "denied" };
      } finally {
        setIsLoading(false);
      }
    }, []);

  // ── Obtenir le token push ─────────────────────────────────────────────────
  //    1er essai : Expo Push Token  (fonctionne dans Expo Go + EAS)
  //    Fallback  : token FCM natif  (EAS build production uniquement)
  const getFCMToken = useCallback(async (): Promise<string | null> => {
    setIsLoading(true);
    setError(null);
    try {
      // Retourner le token mis en cache si disponible
      const cached = await AsyncStorage.getItem("push_token");
      if (cached) {
        setFcmToken(cached);
        return cached;
      }

      let token: string | null = null;

      try {
        // projectId requis pour getExpoPushTokenAsync avec EAS
        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          (Constants as any).easConfig?.projectId;

        const pushToken = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : {},
        );
        token = pushToken.data; // format : ExponentPushToken[xxxxx]
        console.log("[Notifications] Expo push token obtenu ✓");
      } catch (expoErr) {
        console.warn(
          "[Notifications] getExpoPushTokenAsync échoué, essai token natif:",
          expoErr,
        );
        try {
          const deviceToken = await Notifications.getDevicePushTokenAsync();
          token =
            typeof deviceToken.data === "string"
              ? deviceToken.data
              : JSON.stringify(deviceToken.data);
          console.log("[Notifications] Token FCM natif obtenu ✓");
        } catch (nativeErr) {
          console.error(
            "[Notifications] getDevicePushTokenAsync échoué:",
            nativeErr,
          );
          setError(
            "Impossible d'obtenir le token push. Vérifiez la configuration Firebase.",
          );
        }
      }

      if (token) {
        setFcmToken(token);
        await AsyncStorage.setItem("push_token", token);
      }

      return token;
    } catch (err) {
      console.error("[Notifications] getFCMToken:", err);
      setError("Erreur lors de l'obtention du token de notification");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Enregistrer le token auprès du backend (PostgreSQL Railway) ───────────
  const registerFCMToken = useCallback(
    async (deviceId?: string): Promise<void> => {
      try {
        const token = fcmToken || (await getFCMToken());
        if (!token) {
          console.warn("[Notifications] Aucun token à enregistrer");
          return;
        }

        const id = deviceId ?? `${Platform.OS}-${Date.now()}`;

        await axiosClient.post("/auth/devices/register", {
          device_id: id,
          fcm_token: token,
          platform: Platform.OS as "ios" | "android",
          push_enabled: true,
          app_version: Constants.expoConfig?.version ?? "1.0.0",
        });

        console.log(
          "[Notifications] Token enregistré côté backend ✓",
          token.substring(0, 40) + "…",
        );
      } catch (err: any) {
        // 401 = pas encore connecté, on ignore silencieusement
        if (err?.response?.status !== 401) {
          console.error(
            "[Notifications] registerFCMToken:",
            err?.response?.data ?? err,
          );
        }
      }
    },
    [fcmToken, getFCMToken],
  );

  // ── Notification locale immédiate ─────────────────────────────────────────
  const sendLocalNotification = useCallback(
    async (data: NotificationData): Promise<void> => {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: data.title,
            body: data.body,
            data: data.data ?? {},
            sound: data.sound ?? "default",
          },
          trigger: null, // null = immédiat
        });
      } catch (err) {
        console.error("[Notifications] sendLocalNotification:", err);
      }
    },
    [],
  );

  // ── Programmer une notification future ────────────────────────────────────
  const scheduleNotification = useCallback(
    async (
      title: string,
      body: string,
      scheduledTime: Date,
      data?: Record<string, any>,
    ): Promise<string | null> => {
      try {
        const secondsUntil = Math.max(
          1,
          Math.round((scheduledTime.getTime() - Date.now()) / 1000),
        );

        const id = await Notifications.scheduleNotificationAsync({
          content: { title, body, data: data ?? {}, sound: "default" },
          trigger: { seconds: secondsUntil, repeats: false },
        });

        setScheduledNotifications((prev) => [
          ...prev,
          { id, title, body, scheduledTime, data },
        ]);
        return id;
      } catch (err) {
        console.error("[Notifications] scheduleNotification:", err);
        return null;
      }
    },
    [],
  );

  // ── Annuler une notification programmée ──────────────────────────────────
  const cancelScheduledNotification = useCallback(
    async (notificationId: string): Promise<void> => {
      try {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
        setScheduledNotifications((prev) =>
          prev.filter((n) => n.id !== notificationId),
        );
      } catch (err) {
        console.error("[Notifications] cancelScheduledNotification:", err);
      }
    },
    [],
  );

  // ── Tout annuler ─────────────────────────────────────────────────────────
  const clearAllScheduledNotifications =
    useCallback(async (): Promise<void> => {
      try {
        await Notifications.cancelAllScheduledNotificationsAsync();
        setScheduledNotifications([]);
      } catch (err) {
        console.error("[Notifications] clearAll:", err);
      }
    }, []);

  // ── Alerte de demande de permission ──────────────────────────────────────
  const showPermissionAlert = useCallback(() => {
    showWarning(
      "Notifications requises",
      "SmartQueue a besoin de vous notifier quand c'est votre tour dans la file d'attente.",
      "Autoriser",
      () => requestPermission(),
      "Annuler",
    );
  }, [requestPermission, showWarning]);

  // ── Initialisation complète ───────────────────────────────────────────────
  const initializeNotifications = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      // Canal Android (obligatoire Android 8+)
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("smartqueue-default", {
          name: "SmartQueue",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#3B82F6",
          sound: "default",
        });
      }

      const perm = await checkPermission();

      if (perm.granted) {
        await getFCMToken();
      } else if (perm.canAskAgain) {
        // On ne spam pas l'utilisateur, on laisse l'UI décider quand demander
        console.log("[Notifications] Permission pas encore accordée");
      }
    } catch (err) {
      console.error("[Notifications] initializeNotifications:", err);
    } finally {
      setIsLoading(false);
    }
  }, [checkPermission, getFCMToken]);

  // ── Listeners ────────────────────────────────────────────────────────────
  useEffect(() => {
    // Notif reçue en premier plan
    foregroundListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        const { title, body } = notification.request.content;
        console.log("[Notifications] Reçue en FG:", title, body);
      },
    );

    // Utilisateur a tapé sur la notif
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as Record<
          string,
          any
        >;
        console.log("[Notifications] Tap sur notif, data:", data);
        // Navigation possible ici selon data.type / data.ticket_id
        // ex: router.push(`/(tabs)/tickets?id=${data.ticket_id}`)
      });

    return () => {
      foregroundListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  // ── Initialisation au montage ─────────────────────────────────────────────
  useEffect(() => {
    // Charger le token stocké
    AsyncStorage.getItem("push_token").then((stored) => {
      if (stored) setFcmToken(stored);
    });

    initializeNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    permission,
    fcmToken,
    isLoading,
    error,
    scheduledNotifications,
    checkPermission,
    requestPermission,
    getFCMToken,
    registerFCMToken,
    sendLocalNotification,
    scheduleNotification,
    cancelScheduledNotification,
    clearAllScheduledNotifications,
    showPermissionAlert,
    initializeNotifications,
    // Propriétés calculées
    hasPermission: permission.granted,
    canRequestPermission: permission.canAskAgain,
    isInitialized: fcmToken !== null,
  };
};

export default useNotifications;
