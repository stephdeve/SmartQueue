import { useState, useEffect, useCallback, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { useTicket } from '../store/ticketStore';
import { useDistanceTracking } from './useDistanceTracking';
import { useAlertPreferencesStore } from '../store/alertPreferencesStore';
import { formatTravelTime, formatDistance } from '../utils/distance';

// Get notifications module safely (lazy evaluation)
const getNotifications = () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Notifications = require('expo-notifications');
    return Notifications;
  } catch (e) {
    return null;
  }
};

export type SmartAlertType = 
  | 'LEAVE_NOW'      // Partez maintenant !
  | 'LEAVE_SOON'     // Partez dans X min
  | 'ARRIVING_SOON'  // Vous arrivez dans 2 min
  | 'ARRIVED'        // Vous êtes arrivé
  | 'CALLED'         // C'est votre tour
  | 'ALMOST_THERE'   // 5 personnes avant vous
  | 'TEN_MIN_WARNING'; // Votre tour dans ~10 min

export interface SmartAlert {
  type: SmartAlertType;
  title: string;
  body: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  data?: {
    distanceKm?: number;
    travelTimeMinutes?: number;
    etaMinutes?: number;
    position?: number;
  };
}

interface UseSmartNotificationsOptions {
  enabled?: boolean;
}

/**
 * Hook for smart geolocation-based notifications
 * Calculates optimal departure time based on distance, travel mode, and queue position
 */
export const useSmartNotifications = (options: UseSmartNotificationsOptions = {}) => {
  const { enabled = true } = options;
  
  const { 
    activeTicket, 
    hasActiveTicket, 
    position, 
    etaMinutes, 
    isCalled,
    isAlmostThere 
  } = useTicket();
  
  const { 
    marginMinutes, 
    preferredTransportMode,
    enableSafetyAlert 
  } = useAlertPreferencesStore();

  // Get establishment coordinates
  const establishmentCoords = (() => {
    if (!activeTicket?.establishment) return null;
    const est = activeTicket.establishment as any;
    if (est?.lat == null || est?.lng == null) return null;
    return {
      latitude: Number(est.lat),
      longitude: Number(est.lng),
    };
  })();

  // Distance tracking
  const { distanceInfo, userLocation } = useDistanceTracking({
    targetCoordinates: establishmentCoords,
    enabled: hasActiveTicket && !!establishmentCoords && enabled,
    autoRefreshInterval: 30000, // 30 seconds
  });

  // State
  const [lastAlert, setLastAlert] = useState<SmartAlert | null>(null);
  const [alertsSent, setAlertsSent] = useState<Set<SmartAlertType>>(new Set());
  
  // Refs for tracking state without re-renders
  const lastAlertRef = useRef<SmartAlert | null>(null);
  const alertsSentRef = useRef<Set<SmartAlertType>>(new Set());

  // Reset alerts when ticket changes
  useEffect(() => {
    setAlertsSent(new Set());
    alertsSentRef.current = new Set();
    setLastAlert(null);
    lastAlertRef.current = null;
  }, [activeTicket?.id]);

  // Calculate when to leave
  const getDepartureInfo = useCallback(() => {
    if (!distanceInfo || !etaMinutes) return null;

    const travelTime = distanceInfo.travelTimes[preferredTransportMode];
    const leaveIn = etaMinutes - travelTime - marginMinutes;
    const arrivalTime = Date.now() + travelTime * 60000;
    const serviceTime = Date.now() + etaMinutes * 60000;
    const buffer = serviceTime - arrivalTime;

    return {
      travelTime,
      leaveIn,
      buffer,
      shouldLeaveNow: leaveIn <= 0,
      shouldLeaveSoon: leaveIn > 0 && leaveIn <= 5,
      distanceKm: distanceInfo.kilometers,
      meters: distanceInfo.meters,
    };
  }, [distanceInfo, etaMinutes, marginMinutes, preferredTransportMode]);

  // Send notification helper
  const sendNotification = useCallback(async (alert: SmartAlert) => {
    // Check if already sent this alert type
    if (alertsSentRef.current.has(alert.type)) {
      return;
    }

    // Update refs and state
    alertsSentRef.current.add(alert.type);
    setAlertsSent(new Set(alertsSentRef.current));
    lastAlertRef.current = alert;
    setLastAlert(alert);

    // Haptic feedback based on urgency
    if (alert.urgency === 'critical' || alert.urgency === 'high') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else if (alert.urgency === 'medium') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Schedule local notification (only if available - not in Expo Go)
    const Notifications = getNotifications();
    if (Notifications?.scheduleNotificationAsync) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: alert.title,
            body: alert.body,
            data: { ...alert.data, alertType: alert.type },
            sound: alert.urgency === 'critical' ? 'default' : undefined,
            priority: alert.urgency === 'critical' ? 'high' : 'default',
          },
          trigger: null, // Immediate
        });
      } catch (error) {
        console.error('Failed to send notification:', error);
      }
    } else {
      // In Expo Go, just log the alert
      console.log('[SmartAlert]', alert.title, alert.body);
    }
  }, []);

  // Main smart alert logic
  useEffect(() => {
    if (!enabled || !hasActiveTicket || !distanceInfo || !userLocation) return;

    const departureInfo = getDepartureInfo();
    if (!departureInfo) return;

    const { 
      travelTime, 
      leaveIn, 
      shouldLeaveNow, 
      shouldLeaveSoon, 
      distanceKm,
      meters 
    } = departureInfo;

    // CRITICAL: Leave immediately (travel time > available time)
    if (shouldLeaveNow && !alertsSentRef.current.has('LEAVE_NOW')) {
      sendNotification({
        type: 'LEAVE_NOW',
        title: '🚨 Partez maintenant !',
        body: `Vous risquez d'arriver en retard. Temps de trajet: ${formatTravelTime(travelTime)}, il vous reste ${etaMinutes} min d'attente.`,
        urgency: 'critical',
        timestamp: new Date(),
        data: {
          distanceKm,
          travelTimeMinutes: travelTime,
          etaMinutes,
          position,
        },
      });
      return;
    }

    // HIGH: Leave soon (within 5 minutes)
    if (shouldLeaveSoon && !alertsSentRef.current.has('LEAVE_SOON')) {
      sendNotification({
        type: 'LEAVE_SOON',
        title: '⏰ Préparez-vous à partir',
        body: `Partez dans ${Math.ceil(leaveIn)} min pour arriver à temps. Trajet estimé: ${formatTravelTime(travelTime)}.`,
        urgency: 'high',
        timestamp: new Date(),
        data: {
          distanceKm,
          travelTimeMinutes: travelTime,
          etaMinutes,
          position,
        },
      });
      return;
    }

    // MEDIUM: Arriving soon (within 2 minutes of destination)
    if (meters < 300 && meters > 50 && !alertsSentRef.current.has('ARRIVING_SOON')) {
      sendNotification({
        type: 'ARRIVING_SOON',
        title: '📍 Vous arrivez bientôt',
        body: `Vous êtes à ${formatDistance(distanceKm)} de ${activeTicket?.establishment?.name || 'la destination'}. Position dans la file: ${position}ème.`,
        urgency: 'medium',
        timestamp: new Date(),
        data: {
          distanceKm,
          position,
        },
      });
      return;
    }

    // LOW: Arrived (within 50m)
    if (meters <= 50 && !alertsSentRef.current.has('ARRIVED')) {
      sendNotification({
        type: 'ARRIVED',
        title: '✅ Vous êtes arrivé',
        body: `Vous êtes sur place à ${activeTicket?.establishment?.name || "l'établissement"}. Enregistrez votre présence !`,
        urgency: 'low',
        timestamp: new Date(),
        data: {
          position,
        },
      });
      return;
    }

    // HIGH: 5 people ahead (prepare to leave)
    if (position <= 5 && position > 0 && !isCalled && !alertsSentRef.current.has('ALMOST_THERE')) {
      const travelTime = distanceInfo?.travelTimes[preferredTransportMode] || 0;
      const shouldLeaveNow = travelTime >= etaMinutes;
      
      sendNotification({
        type: 'ALMOST_THERE',
        title: '⚠️ 5 personnes avant vous',
        body: shouldLeaveNow 
          ? `Préparez-vous ! Il reste ${position} personnes. Temps de trajet: ${formatTravelTime(travelTime)} min.`
          : `Préparez-vous ! Il reste ${position} personnes avant votre tour.`,
        urgency: 'high',
        timestamp: new Date(),
        data: {
          position,
          travelTimeMinutes: travelTime,
          etaMinutes,
        },
      });
      return;
    }

    // MEDIUM: 10 minutes warning (ETA based)
    if (etaMinutes <= 10 && etaMinutes > 5 && !alertsSentRef.current.has('TEN_MIN_WARNING')) {
      sendNotification({
        type: 'TEN_MIN_WARNING',
        title: '⏱️ Votre tour approche',
        body: `Environ ${etaMinutes} min d'attente restantes. Position: ${position}ème. Préparez-vous à partir !`,
        urgency: 'medium',
        timestamp: new Date(),
        data: {
          etaMinutes,
          position,
        },
      });
      return;
    }

    // CRITICAL: Called (it's your turn)
    if (isCalled && !alertsSentRef.current.has('CALLED')) {
      sendNotification({
        type: 'CALLED',
        title: '🎯 C\'EST VOTRE TOUR !',
        body: `Présentez-vous immédiatement au guichet. Votre ticket: ${activeTicket?.number || ''}`,
        urgency: 'critical',
        timestamp: new Date(),
        data: {
          position,
        },
      });
      return;
    }
  }, [
    enabled,
    hasActiveTicket,
    distanceInfo,
    userLocation,
    position,
    etaMinutes,
    isCalled,
    activeTicket,
    getDepartureInfo,
    sendNotification,
    preferredTransportMode,
  ]);

  // Calculate progress percentage for journey
  const getJourneyProgress = useCallback(() => {
    if (!distanceInfo || !etaMinutes) return null;

    const travelTime = distanceInfo.travelTimes[preferredTransportMode];
    const totalTimeNeeded = travelTime + marginMinutes;
    
    // How much of the needed time do we still have?
    const buffer = etaMinutes - totalTimeNeeded;
    
    return {
      // 100% = perfect timing, <100% = running late, >100% = early
      timingScore: Math.max(0, Math.min(100, (etaMinutes / totalTimeNeeded) * 100)),
      bufferMinutes: buffer,
      isLate: buffer < 0,
      isOptimal: buffer >= 0 && buffer <= 5,
      isEarly: buffer > 5,
    };
  }, [distanceInfo, etaMinutes, marginMinutes, preferredTransportMode]);

  return {
    // State
    lastAlert,
    alertsSent: Array.from(alertsSent),
    
    // Calculated values
    departureInfo: getDepartureInfo(),
    journeyProgress: getJourneyProgress(),
    
    // Helpers
    hasPendingAlert: (type: SmartAlertType) => alertsSent.has(type),
    resetAlerts: useCallback(() => {
      setAlertsSent(new Set());
      alertsSentRef.current = new Set();
    }, []),
  };
};

export default useSmartNotifications;
