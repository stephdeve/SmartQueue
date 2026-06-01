import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { useTicket, useTicketStore } from '../store/ticketStore';
import { useUserStatsStore } from '../store/userStatsStore';
import axiosClient from '../api/axiosClient';

// Ensure Pusher is globally available for Laravel Echo
(window as any).Pusher = Pusher;

// Types pour les événements WebSocket
interface PositionUpdateEvent {
  ticket_id: number;
  position: number;
  eta_minutes: number;
  queue_length: number;
}

interface TicketCalledEvent {
  ticket_id: number;
  counter?: number;
  counter_id?: number;
  message: string;
  agent_name?: string;
}

interface TicketStatusEvent {
  ticket_id: number;
  status: 'created' | 'waiting' | 'called' | 'served' | 'closed' | 'absent' | 'expired';
  message?: string;
}

interface QueueHighDemandEvent {
  service_id: number;
  message: string;
  estimated_wait_increase: number;
}

export const useTicketSocket = (ticketId: string | number | null) => {
  const echoInstance = useRef<any>(null);
  const reconnectAttempts = useRef(0);
  // Canaux secondaires réellement souscrits (pour pouvoir les quitter proprement
  // sans dépendre de l'objet activeTicket dans les deps — source de reconnexions
  // en boucle qui faisaient manquer des événements).
  const subscribedUserId = useRef<number | null>(null);
  const subscribedServiceId = useRef<number | null>(null);
  const resyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    updatePosition,
    markAsCalled,
    updateTicketStatus,
    setWebSocketConnected,
    setLastUpdate,
  } = useTicket();

  // Re-synchronise l'état COMPLET depuis le backend (activeTicket + activeTickets)
  // après n'importe quel événement de cycle de vie. Garantit la cohérence sur tous
  // les écrans : un ticket servi/clôturé disparaît de "en cours", un absent reflète
  // son statut, etc. Débounce pour éviter les rafales (recompute des positions).
  const scheduleResync = useCallback(() => {
    if (resyncTimer.current) clearTimeout(resyncTimer.current);
    resyncTimer.current = setTimeout(() => {
      useTicketStore
        .getState()
        .fetchActiveTicket()
        .catch((err: any) => console.warn('[Echo] resync failed:', err?.message || err));
    }, 400);
  }, []);

  const connect = useCallback(async () => {
    if (!ticketId || echoInstance.current) {
      return;
    }

    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        console.warn('No auth token found for Echo WebSocket connection');
        return;
      }

      // Format the WebSocket URL
      const wsUrlStr = process.env.EXPO_PUBLIC_WS_URL || 'wss://reverb-production-b4e5.up.railway.app';
      
      // Parse host and port
      // Example: wss://reverb-production-b4e5.up.railway.app -> host: reverb-production-b4e5.up.railway.app, scheme: wss
      const isWss = wsUrlStr.startsWith('wss://');
      const hostWithoutScheme = wsUrlStr.replace('wss://', '').replace('ws://', '');
      const hostParts = hostWithoutScheme.split(':');
      const host = hostParts[0];
      const portStr = hostParts[1];
      const port = portStr ? parseInt(portStr, 10) : (isWss ? 443 : 80);

      console.log('Connecting to Reverb at:', host, 'port:', port, 'TLS:', isWss);

      // Create Echo instance with Pusher broadcaster connecting to Reverb
      echoInstance.current = new Echo({
        broadcaster: 'reverb', // 'reverb' is essentially 'pusher' but forces the config
        key: process.env.EXPO_PUBLIC_REVERB_APP_KEY || 'smartqueue_key',
        appid: process.env.EXPO_PUBLIC_REVERB_APP_ID || 'smartqueue_id',
        wsHost: host,
        wsPort: port,
        wssPort: port,
        forceTLS: isWss,
        enabledTransports: ['ws', 'wss'],
        disableStats: true,
        // Custom authorizer to use our existing axiosClient with JWT Token
        authorizer: (channel: any, options: any) => {
          return {
            authorize: (socketId: string, callback: Function) => {
              console.log('[Echo] authorizing channel:', channel.name, 'socket_id:', socketId);
              axiosClient.post('/broadcasting/auth', {
                socket_id: socketId,
                channel_name: channel.name
              })
              .then(response => {
                console.log('[Echo] auth response:', JSON.stringify(response.data));
                // Pusher/Echo expects {auth: "key:signature"} format
                callback(false, response.data);
              })
              .catch(error => {
                console.error('Pusher auth error:', error.response?.data || error);
                callback(true, error);
              });
            }
          };
        },
      });

      // Bind to connection events
      const connection = echoInstance.current.connector.pusher.connection;
      connection.bind('connected', () => {
        console.log('Echo (Reverb) connected for ticket:', ticketId);
        setWebSocketConnected(true);
        reconnectAttempts.current = 0;
        setLastUpdate(new Date());
      });

      connection.bind('disconnected', () => {
        console.log('Echo (Reverb) disconnected');
        setWebSocketConnected(false);
      });

      connection.bind('error', (err: any) => {
        console.error('Echo (Reverb) error:', err);
        setWebSocketConnected(false);
      });

      // Listen to the private ticket channel
      const ticketChannel = `ticket.${ticketId}`;
      echoInstance.current.private(ticketChannel)
        // Note: The event names often need a leading dot in Echo if they don't follow Laravel's default namespace (App\Events)
        // If your backend implements broadcastAs() returning 'ticket.position_updated', use '.ticket.position_updated'
        .listen('.ticket.position_updated', (data: PositionUpdateEvent) => {
          console.log('Position update received:', data);
          if (data.ticket_id === Number(ticketId)) {
            updatePosition(data.position, data.eta_minutes);
            setLastUpdate(new Date());
          }
        })
        .listen('.ticket.called', (data: TicketCalledEvent) => {
          console.log('Ticket called event received:', data);
          if (data.ticket_id === Number(ticketId)) {
            const counterNum = data.counter ?? data.counter_id;
            markAsCalled(counterNum?.toString());
            updateTicketStatus('called');
            setLastUpdate(new Date());
            triggerNotification("C'est votre tour !", data.message || 'Votre ticket est appelé');
            triggerHapticFeedback('success');
            scheduleResync();
          }
        })
        .listen('.ticket.updated', (data: any) => {
          console.log('Ticket updated event received:', data);
          // Ignorer les évènements qui ne concernent pas le ticket suivi : sinon
          // une mise à jour d'un autre ticket déclenchait une resync inutile.
          if (data.ticket_id != null && data.ticket_id !== Number(ticketId)) {
            return;
          }
          setLastUpdate(new Date());
          // Handle status changes
          if (data.status) {
            updateTicketStatus(data.status);
            switch (data.status) {
              case 'called':
                markAsCalled(data.counter_id?.toString());
                triggerNotification("C'est votre tour !", 'Votre ticket est appelé');
                triggerHapticFeedback('success');
                break;
              case 'absent':
                triggerNotification('Ticket absent', 'Vous avez été marqué absent');
                triggerHapticFeedback('warning');
                break;
              case 'waiting':
                triggerNotification('Ticket en attente', data.message || 'Votre position a été mise à jour');
                triggerHapticFeedback('light');
                break;
            }
          }
          // Handle position changes
          if (data.position) {
            updatePosition(data.position, data.eta_minutes || 0);
          }
          // Re-synchronise l'état complet pour rester cohérent sur tous les écrans.
          scheduleResync();
        })
        .listen('.ticket.status_changed', (data: TicketStatusEvent) => {
          console.log('Ticket status changed:', data);
          if (data.ticket_id === Number(ticketId)) {
            updateTicketStatus(data.status);
            setLastUpdate(new Date());
            switch (data.status) {
              case 'absent':
                triggerNotification('Ticket absent', data.message || 'Vous avez été marqué absent');
                triggerHapticFeedback('warning');
                break;
              case 'expired':
                triggerNotification('Ticket expiré', data.message || 'Votre ticket a expiré');
                triggerHapticFeedback('error');
                break;
              case 'served':
                triggerNotification('Service terminé', data.message || 'Votre service est terminé');
                triggerHapticFeedback('success');
                // Record completed ticket for stats
                const statsStore = useUserStatsStore.getState();
                statsStore.recordTicketCompleted({
                  id: Number(ticketId),
                  eta_minutes: 0,
                });
                break;
            }
            scheduleResync();
          }
        });

      // Also listen to user-specific channel for ticket updates.
      // On lit les ids via getState() (et non via les deps du useCallback) pour
      // éviter de reconstruire la connexion à chaque changement d'activeTicket.
      const storeTicket = useTicketStore.getState().activeTicket as any;
      const userId = storeTicket?.user_id ?? null;
      const serviceId = storeTicket?.service_id ?? null;
      subscribedUserId.current = userId;
      subscribedServiceId.current = serviceId;

      if (userId) {
        echoInstance.current.private(`user.${userId}`)
          .listen('.user.ticket.updated', (data: any) => {
            console.log('User ticket updated event received:', data);
            if (data.ticket_id === Number(ticketId)) {
              setLastUpdate(new Date());
              if (data.status) {
                updateTicketStatus(data.status);
                switch (data.status) {
                  case 'called':
                    markAsCalled(data.counter_id?.toString());
                    triggerNotification("C'est votre tour !", 'Votre ticket est appelé');
                    triggerHapticFeedback('success');
                    break;
                  case 'absent':
                    triggerNotification('Ticket absent', 'Vous avez été marqué absent');
                    triggerHapticFeedback('warning');
                    break;
                }
              }
              if (data.position) {
                updatePosition(data.position, 0);
              }
              scheduleResync();
            }
          });
      }

      // Listen to service-wide alerts (e.g. high demand)
      if (serviceId) {
         echoInstance.current.private(`service.${serviceId}`)
         .listen('.queue.high_demand', (data: QueueHighDemandEvent) => {
          console.log('High demand alert:', data);
          triggerNotification('Forte demande', data.message || "Le temps d'attente a augmenté");
          triggerHapticFeedback('warning');
         });
      }

    } catch (error) {
      console.error('Error creating Echo connection:', error);
      setWebSocketConnected(false);
    }
  }, [ticketId, updatePosition, markAsCalled, updateTicketStatus, setWebSocketConnected, setLastUpdate, scheduleResync]);

  const disconnect = useCallback(() => {
    if (echoInstance.current) {
      if (ticketId) echoInstance.current.leave(`ticket.${ticketId}`);
      if (subscribedUserId.current) echoInstance.current.leave(`user.${subscribedUserId.current}`);
      if (subscribedServiceId.current) echoInstance.current.leave(`service.${subscribedServiceId.current}`);
      subscribedUserId.current = null;
      subscribedServiceId.current = null;

      echoInstance.current.disconnect();
      echoInstance.current = null;
      setWebSocketConnected(false);
      console.log('WebSocket (Echo) disconnected gracefully');
    }
  }, [ticketId, setWebSocketConnected]);

  const sendMessage = useCallback((event: string, data: any) => {
    if (echoInstance.current && echoInstance.current.connector.pusher.connection.state === 'connected') {
       // With Pusher/Echo, sending messages from client requires "client events" setup on the server and use whisper()
       // echoInstance.current.private(`ticket.${ticketId}`).whisper(event, data);
       console.warn('sendMessage: client events (whisper) are not enabled or implemented yet');
    } else {
      console.warn('Echo not connected, cannot send message');
    }
  }, [ticketId]);

  useEffect(() => {
    if (ticketId) {
      connect();
    } else {
      disconnect();
    }
    return () => disconnect();
  }, [ticketId, connect, disconnect]);

  return {
    isConnected: echoInstance.current?.connector?.pusher?.connection?.state === 'connected',
    connect,
    disconnect,
    sendMessage,
    echo: echoInstance.current,
  };
};

const triggerNotification = async (title: string, body: string) => {
  try {
    const Notifications = require('expo-notifications');
    if (!Notifications) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority?.HIGH || 'high',
      },
      // Sur Android, cibler le canal "smartqueue-default" (importance MAX) pour
      // un affichage heads-up. Le handler foreground (NotificationsProvider) gère
      // l'affichage quand l'app est ouverte. trigger { channelId } = immédiat.
      trigger:
        Platform.OS === 'android' ? { channelId: 'smartqueue-default' } : null,
    });
  } catch (error) {
    console.warn('Notification scheduling not supported or failed:', error);
  }
};

const triggerHapticFeedback = async (type: 'success' | 'warning' | 'error' | 'light' | 'medium' | 'heavy') => {
  try {
    const Haptics = require('expo-haptics');
    if (!Haptics) return;

    switch (type) {
      case 'success':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
    console.warn('Haptic feedback not available:', error);
  }
};

export default useTicketSocket;