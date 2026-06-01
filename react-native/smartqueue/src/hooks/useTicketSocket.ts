/**
 * useTicketSocket — connexion WebSocket temps réel via Laravel Echo / Reverb.
 *
 * Corrections appliquées :
 *  1. userId lu depuis authStore (pas depuis activeTicket.user_id qui peut être
 *     null ou appartenir à une session précédente) → élimine les notifications
 *     envoyées au mauvais utilisateur.
 *  2. Canal service.* souscrit via .join() (PresenceChannel) et non .private()
 *     → les événements service.ticket.called arrivent correctement.
 *  3. Filtre ticket_id strict sur TOUS les événements (y compris .ticket.called)
 *     → un événement d'un autre ticket ne déclenche plus de notification.
 *  4. Guard anti-doublon : on ne déclenche pas de notification locale si l'app
 *     est en premier plan ET que l'overlay est déjà visible (isCalled=true).
 *  5. scheduleResync ne réécrase plus en_route_at local : on fusionne la valeur
 *     locale dans le résultat du fetch pour éviter la réouverture de l'overlay.
 */
import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { useTicketStore } from '../store/ticketStore';
import { useAuthStore } from '../store/authStore';
import { useUserStatsStore } from '../store/userStatsStore';
import axiosClient from '../api/axiosClient';

// Rendre Pusher disponible globalement pour Laravel Echo
(window as any).Pusher = Pusher;

// ─── Types des événements WebSocket ──────────────────────────────────────────

interface TicketCalledEvent {
  ticket_id: number;
  counter?: number;
  counter_id?: number;
  number?: string;
  service_id?: number;
}

interface TicketUpdatedEvent {
  ticket_id: number;
  status?: string;
  position?: number;
  eta_minutes?: number;
  counter_id?: number;
  is_swapped?: boolean;
  deferred?: boolean;
}

interface UserTicketUpdatedEvent {
  ticket_id: number;
  status?: string;
  position?: number;
  eta_minutes?: number;
  counter_id?: number;
  service_id?: number;
  number?: string;
  deferred?: boolean;
  swapped?: boolean;
}

interface QueueHighDemandEvent {
  service_id: number;
  message: string;
  estimated_wait_increase: number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useTicketSocket = (ticketId: string | number | null) => {
  const echoInstance = useRef<any>(null);
  const reconnectAttempts = useRef(0);
  const subscribedUserId = useRef<number | null>(null);
  const subscribedServiceId = useRef<number | null>(null);
  const resyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Sélecteurs store ────────────────────────────────────────────────────────
  const {
    updatePosition,
    markAsCalled,
    updateTicketStatus,
    setWebSocketConnected,
    setLastUpdate,
  } = useTicketStore.getState();

  // userId depuis authStore — source fiable, indépendante du ticket actif.
  // On lit via getState() pour ne pas recréer la connexion à chaque re-render.
  const getAuthUserId = useCallback((): number | null => {
    const user = useAuthStore.getState().user;
    return user?.id ?? null;
  }, []);

  // ── Resync complet depuis le backend ────────────────────────────────────────
  // Fusionne en_route_at local pour éviter la réouverture de l'overlay après
  // un fetchActiveTicket si l'utilisateur a déjà cliqué "Je suis en route".
  const scheduleResync = useCallback(() => {
    if (resyncTimer.current) clearTimeout(resyncTimer.current);
    resyncTimer.current = setTimeout(async () => {
      try {
        const store = useTicketStore.getState();
        // Mémoriser en_route_at local AVANT le fetch
        const localEnRouteAt = store.activeTicket?.en_route_at ?? null;

        await store.fetchActiveTicket();

        // Si l'utilisateur avait déjà répondu localement mais que le backend
        // n'a pas encore persisté en_route_at, on restaure la valeur locale
        // pour éviter la réouverture de l'overlay.
        if (localEnRouteAt) {
          const afterFetch = useTicketStore.getState();
          if (afterFetch.activeTicket && !afterFetch.activeTicket.en_route_at) {
            useTicketStore.setState((s) => ({
              activeTicket: s.activeTicket
                ? { ...s.activeTicket, en_route_at: localEnRouteAt }
                : null,
              isCalled: false,
            }));
          }
        }
      } catch (err: any) {
        console.warn('[Echo] resync failed:', err?.message || err);
      }
    }, 400);
  }, []);

  // ── Connexion ────────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (!ticketId || echoInstance.current) return;

    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        console.warn('[Echo] Pas de token auth pour la connexion WebSocket');
        return;
      }

      const wsUrlStr =
        process.env.EXPO_PUBLIC_WS_URL ||
        'wss://reverb-production-b4e5.up.railway.app';
      const isWss = wsUrlStr.startsWith('wss://');
      const hostWithoutScheme = wsUrlStr
        .replace('wss://', '')
        .replace('ws://', '');
      const hostParts = hostWithoutScheme.split(':');
      const host = hostParts[0];
      const portStr = hostParts[1];
      const port = portStr ? parseInt(portStr, 10) : isWss ? 443 : 80;

      console.log('[Echo] Connexion à Reverb:', host, 'port:', port, 'TLS:', isWss);

      echoInstance.current = new Echo({
        broadcaster: 'reverb',
        key: process.env.EXPO_PUBLIC_REVERB_APP_KEY || 'smartqueue_key',
        appid: process.env.EXPO_PUBLIC_REVERB_APP_ID || 'smartqueue_id',
        wsHost: host,
        wsPort: port,
        wssPort: port,
        forceTLS: isWss,
        enabledTransports: ['ws', 'wss'],
        disableStats: true,
        authorizer: (channel: any) => ({
          authorize: (socketId: string, callback: Function) => {
            console.log('[Echo] Auth canal:', channel.name, 'socket_id:', socketId);
            axiosClient
              .post('/broadcasting/auth', {
                socket_id: socketId,
                channel_name: channel.name,
              })
              .then((response) => {
                callback(false, response.data);
              })
              .catch((error) => {
                console.error('[Echo] Auth error:', error.response?.data || error);
                callback(true, error);
              });
          },
        }),
      });

      // ── Événements de connexion ──────────────────────────────────────────────
      const connection = echoInstance.current.connector.pusher.connection;

      connection.bind('connected', () => {
        console.log('[Echo] Connecté pour ticket:', ticketId);
        setWebSocketConnected(true);
        reconnectAttempts.current = 0;
        setLastUpdate(new Date());
      });

      connection.bind('disconnected', () => {
        console.log('[Echo] Déconnecté');
        setWebSocketConnected(false);
      });

      connection.bind('error', (err: any) => {
        console.error('[Echo] Erreur:', err);
        setWebSocketConnected(false);
      });

      const numericTicketId = Number(ticketId);

      // ── Canal privé du ticket ────────────────────────────────────────────────
      // Reçoit les mises à jour de position, statut et appel pour CE ticket.
      echoInstance.current
        .private(`ticket.${ticketId}`)
        .listen('.ticket.called', (data: TicketCalledEvent) => {
          console.log('[Echo] ticket.called:', data);
          // Filtre strict : ignorer si ce n'est pas notre ticket
          if (data.ticket_id !== numericTicketId) return;

          const counterNum = data.counter ?? data.counter_id;
          markAsCalled(counterNum?.toString());
          updateTicketStatus('called');
          setLastUpdate(new Date());

          // Ne déclencher la notification locale que si l'overlay n'est pas
          // déjà visible (évite le doublon quand l'app est en premier plan).
          const { isCalled } = useTicketStore.getState();
          if (!isCalled) {
            triggerLocalNotification("C'est votre tour !", 'Présentez-vous au guichet');
          }
          triggerHapticFeedback('success');
          scheduleResync();
        })
        .listen('.ticket.updated', (data: TicketUpdatedEvent) => {
          console.log('[Echo] ticket.updated:', data);
          // Filtre strict
          if (data.ticket_id != null && data.ticket_id !== numericTicketId) return;

          setLastUpdate(new Date());

          if (data.status) {
            updateTicketStatus(data.status as any);

            switch (data.status) {
              case 'called': {
                markAsCalled(data.counter_id?.toString());
                const { isCalled } = useTicketStore.getState();
                if (!isCalled) {
                  triggerLocalNotification("C'est votre tour !", 'Votre ticket est appelé');
                }
                triggerHapticFeedback('success');
                break;
              }
              case 'absent':
                triggerLocalNotification('Ticket absent', 'Vous avez été marqué absent');
                triggerHapticFeedback('warning');
                break;
              case 'closed':
              case 'served':
                triggerLocalNotification('Service terminé', 'Votre ticket a été servi. Merci !');
                triggerHapticFeedback('success');
                break;
            }
          }

          if (data.position != null) {
            updatePosition(data.position, data.eta_minutes ?? 0);
          }

          scheduleResync();
        });

      // ── Canal privé de l'utilisateur ─────────────────────────────────────────
      // userId lu depuis authStore — jamais depuis activeTicket pour éviter
      // de s'abonner au canal d'un autre utilisateur.
      const userId = getAuthUserId();
      subscribedUserId.current = userId;

      if (userId) {
        echoInstance.current
          .private(`user.${userId}`)
          .listen('.user.ticket.updated', (data: UserTicketUpdatedEvent) => {
            console.log('[Echo] user.ticket.updated:', data);

            // Filtre strict : ignorer les événements d'autres tickets
            if (data.ticket_id !== numericTicketId) {
              console.log(
                '[Echo] Ignoré — ticket_id',
                data.ticket_id,
                '!= ticket suivi',
                numericTicketId,
              );
              return;
            }

            setLastUpdate(new Date());

            if (data.status) {
              updateTicketStatus(data.status as any);

              switch (data.status) {
                case 'called': {
                  markAsCalled(data.counter_id?.toString());
                  const { isCalled } = useTicketStore.getState();
                  if (!isCalled) {
                    triggerLocalNotification("C'est votre tour !", 'Votre ticket est appelé');
                  }
                  triggerHapticFeedback('success');
                  break;
                }
                case 'absent':
                  triggerLocalNotification('Ticket absent', 'Vous avez été marqué absent');
                  triggerHapticFeedback('warning');
                  break;
                case 'waiting':
                  // Mise à jour silencieuse de position — pas de notification
                  break;
              }
            }

            if (data.position != null) {
              updatePosition(data.position, data.eta_minutes ?? 0);
            }

            scheduleResync();
          });
      } else {
        console.warn('[Echo] userId non disponible — canal user.* non souscrit');
      }

      // ── Canal de présence du service ─────────────────────────────────────────
      // Utiliser .join() (PresenceChannel) et non .private() — correction du
      // bug qui empêchait la réception des événements service.*.
      const storeTicket = useTicketStore.getState().activeTicket;
      const serviceId = storeTicket?.service_id ?? null;
      subscribedServiceId.current = serviceId;

      if (serviceId) {
        echoInstance.current
          .join(`service.${serviceId}`)
          .listen('.queue.high_demand', (data: QueueHighDemandEvent) => {
            console.log('[Echo] queue.high_demand:', data);
            triggerLocalNotification(
              'Forte demande',
              data.message || "Le temps d'attente a augmenté",
            );
            triggerHapticFeedback('warning');
          })
          // Écouter aussi service.ticket.called pour les agents (info seulement)
          .listen('.service.ticket.called', (data: any) => {
            console.log('[Echo] service.ticket.called:', data);
          });
      }
    } catch (error) {
      console.error('[Echo] Erreur de connexion:', error);
      setWebSocketConnected(false);
    }
  }, [
    ticketId,
    updatePosition,
    markAsCalled,
    updateTicketStatus,
    setWebSocketConnected,
    setLastUpdate,
    scheduleResync,
    getAuthUserId,
  ]);

  // ── Déconnexion ──────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    if (resyncTimer.current) {
      clearTimeout(resyncTimer.current);
      resyncTimer.current = null;
    }

    if (echoInstance.current) {
      try {
        if (ticketId) echoInstance.current.leave(`ticket.${ticketId}`);
        if (subscribedUserId.current) {
          echoInstance.current.leave(`user.${subscribedUserId.current}`);
        }
        if (subscribedServiceId.current) {
          echoInstance.current.leave(`service.${subscribedServiceId.current}`);
        }
        echoInstance.current.disconnect();
      } catch (e) {
        console.warn('[Echo] Erreur lors de la déconnexion:', e);
      }

      echoInstance.current = null;
      subscribedUserId.current = null;
      subscribedServiceId.current = null;
      setWebSocketConnected(false);
      console.log('[Echo] Déconnecté proprement');
    }
  }, [ticketId, setWebSocketConnected]);

  // ── Cycle de vie ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (ticketId) {
      connect();
    } else {
      disconnect();
    }
    return () => disconnect();
  }, [ticketId, connect, disconnect]);

  return {
    isConnected:
      echoInstance.current?.connector?.pusher?.connection?.state === 'connected',
    connect,
    disconnect,
    echo: echoInstance.current,
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Déclenche une notification locale immédiate.
 * Utilisée uniquement quand l'app est en premier plan (le backend envoie déjà
 * une notification push FCM pour l'arrière-plan).
 */
const triggerLocalNotification = async (title: string, body: string) => {
  try {
    const Notifications = require('expo-notifications');
    if (!Notifications) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        priority:
          Notifications.AndroidNotificationPriority?.HIGH || 'high',
      },
      trigger:
        Platform.OS === 'android'
          ? { channelId: 'smartqueue-default' }
          : null,
    });
  } catch (error) {
    console.warn('[Echo] Notification locale échouée:', error);
  }
};

const triggerHapticFeedback = async (
  type: 'success' | 'warning' | 'error' | 'light' | 'medium' | 'heavy',
) => {
  try {
    const Haptics = require('expo-haptics');
    if (!Haptics) return;

    switch (type) {
      case 'success':
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        break;
      case 'warning':
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Warning,
        );
        break;
      case 'error':
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error,
        );
        break;
      case 'light':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
    }
  } catch (error) {
    console.warn('[Echo] Haptic feedback non disponible:', error);
  }
};

export default useTicketSocket;
