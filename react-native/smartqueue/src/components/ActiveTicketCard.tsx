import React, { useEffect, useRef, useCallback, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTicket, useTicketStore } from "../store/ticketStore";
import { useDistanceTracking } from "../hooks/useDistanceTracking";
import { useAlertPreferencesStore } from "../store/alertPreferencesStore";
import { useCustomAlert } from "../hooks/useCustomAlert";
import { useThemeColors } from "../hooks/useThemeColors";
import { formatDistance, formatTravelTime } from "../utils/distance";
import axiosClient from "../api/axiosClient";
import { getApiErrorMessage } from "../utils/errors";
import type { Ticket } from "../api/ticketsApi";

const { width } = Dimensions.get("window");

interface ActiveTicketCardProps {
  ticket?: Ticket;
  onPress?: () => void;
  onCancel?: () => void;
  onConfirmPresence?: () => void;
  compact?: boolean;
  onTicketExpired?: () => void;
  suppressAutoAlerts?: boolean;
}

export const ActiveTicketCard: React.FC<ActiveTicketCardProps> = ({
  ticket: propTicket,
  onPress,
  onCancel,
  onConfirmPresence,
  compact = false,
  onTicketExpired,
  suppressAutoAlerts = false,
}) => {
  const colors = useThemeColors();

  const { 
    activeTicket: storeTicket, 
    position: storePosition, 
    etaMinutes: storeEtaMinutes, 
    cancelTicket,
    removeExpiredTicket,
  } = useTicket();
  
  const activeTicket = propTicket || storeTicket;
  const position = activeTicket?.position ?? storePosition;
  const etaMinutes = activeTicket?.eta_minutes ?? storeEtaMinutes;

  const { marginMinutes, preferredTransportMode } = useAlertPreferencesStore();
  const { AlertComponent, showWarning, showError, showSuccess, showInfo } = useCustomAlert();

  const progressAnim = useRef(new Animated.Value(0)).current;
  const alertShownRef = useRef(false);
  const wsChannelRef = useRef<any>(null);
  const expiryCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const hasValidCoordinates =
    activeTicket?.establishment &&
    (activeTicket.establishment as any)?.lat != null &&
    (activeTicket.establishment as any)?.lng != null;

  const { distanceInfo } = useDistanceTracking({
    targetCoordinates: hasValidCoordinates
      ? {
        latitude: (activeTicket.establishment as any).lat,
        longitude: (activeTicket.establishment as any).lng,
      }
      : null,
    enabled: hasValidCoordinates,
  });

  const queueLength = (activeTicket as any)?.queue_length || position || 1;
  const processedCount = Math.max(0, queueLength - (position || 0));
  const progress = queueLength > 0 ? processedCount / queueLength : 0;

  const [localStatus, setLocalStatus] = useState(activeTicket?.status);
  const [calledExpiresAt, setCalledExpiresAt] = useState((activeTicket as any)?.called_expires_at);
  const [enRouteExpiresAt, setEnRouteExpiresAt] = useState(activeTicket?.en_route_expires_at);

  useEffect(() => {
    const newCalledExp = (activeTicket as any)?.called_expires_at;
    const newEnRouteExp = activeTicket?.en_route_expires_at;
    const newStatus = activeTicket?.status;
    setLocalStatus(newStatus);
    setCalledExpiresAt(newCalledExp);
    setEnRouteExpiresAt(newEnRouteExp);

    // Only reset the alert flag when the expiry is genuinely in the future (a new call).
    // If the ticket loads with an already-expired timestamp, keep alertShownRef=true
    // to prevent a false expiry alert on mount/re-mount.
    const now = Date.now();
    const alreadyExpired =
      (newStatus === "called" && newCalledExp && new Date(newCalledExp).getTime() <= now) ||
      (newStatus === "en_route" && newEnRouteExp && new Date(newEnRouteExp).getTime() <= now);
    alertShownRef.current = !!alreadyExpired;
  }, [activeTicket?.id, activeTicket?.status]);

  const isCalledExpired = localStatus === "called" && calledExpiresAt 
    ? new Date(calledExpiresAt).getTime() <= Date.now()
    : false;

  const isEnRouteExpired = localStatus === "en_route" && enRouteExpiresAt
    ? new Date(enRouteExpiresAt).getTime() <= Date.now()
    : false;

  const handleTicketExpired = useCallback(() => {
    if (alertShownRef.current) return;
    alertShownRef.current = true;
    
    const ticketNumber = activeTicket?.number || "N/A";
    const serviceName = activeTicket?.service?.name || "Service";
    
    if (!suppressAutoAlerts) {
      showWarning(
        "Ticket expiré",
        `Le ticket ${ticketNumber} (${serviceName}) n'est plus actif car le délai de réponse est dépassé.`,
        "OK",
        () => {
          if (expiryCheckIntervalRef.current) {
            clearInterval(expiryCheckIntervalRef.current);
          }
          if (activeTicket?.id) {
            removeExpiredTicket(activeTicket.id);
          }
          onTicketExpired?.();
        }
      );
    } else {
      if (expiryCheckIntervalRef.current) {
        clearInterval(expiryCheckIntervalRef.current);
      }
      if (activeTicket?.id) {
        removeExpiredTicket(activeTicket.id);
      }
      onTicketExpired?.();
    }
  }, [activeTicket?.id, activeTicket?.number, activeTicket?.service?.name, showWarning, onTicketExpired, removeExpiredTicket, suppressAutoAlerts]);

  useEffect(() => {
    if (expiryCheckIntervalRef.current) {
      clearInterval(expiryCheckIntervalRef.current);
    }

    if (!localStatus || (localStatus !== "called" && localStatus !== "en_route")) {
      return;
    }

    expiryCheckIntervalRef.current = setInterval(() => {
      const now = Date.now();
      let expired = false;

      if (localStatus === "called" && calledExpiresAt) {
        expired = new Date(calledExpiresAt).getTime() <= now;
      } else if (localStatus === "en_route" && enRouteExpiresAt) {
        expired = new Date(enRouteExpiresAt).getTime() <= now;
      }

      if (expired && !alertShownRef.current) {
        handleTicketExpired();
        if (expiryCheckIntervalRef.current) {
          clearInterval(expiryCheckIntervalRef.current);
        }
      }
    }, 1000);

    return () => {
      if (expiryCheckIntervalRef.current) {
        clearInterval(expiryCheckIntervalRef.current);
      }
    };
  }, [localStatus, calledExpiresAt, enRouteExpiresAt, handleTicketExpired]);

  useEffect(() => {
    if (wsChannelRef.current) {
      try {
        wsChannelRef.current.stopListening('.ticket.updated');
        wsChannelRef.current.stopListening('.ticket.marked.absent');
        wsChannelRef.current.leave();
      } catch (e) {}
      wsChannelRef.current = null;
    }

    if (!activeTicket?.id) return;

    const setupWebSocket = async () => {
      try {
        const echo = axiosClient.defaults?.echo;
        if (!echo) return;

        const channel = echo.private(`ticket.${activeTicket.id}`);
        wsChannelRef.current = channel;

        const handleTicketUpdated = (data: any) => {
          if (data.status) {
            if (data.status === 'absent') {
              handleTicketExpired();
            } else {
              setLocalStatus(data.status);
              if (data.called_expires_at) setCalledExpiresAt(data.called_expires_at);
              if (data.en_route_expires_at) setEnRouteExpiresAt(data.en_route_expires_at);
            }
          }
          const store = useTicketStore.getState();
          store.fetchActiveTicket().catch(console.warn);
        };

        const handleMarkedAbsent = () => {
          if (alertShownRef.current) return;
          alertShownRef.current = true;
          const ticketNum = activeTicket?.number || "N/A";
          const svcName = activeTicket?.service?.name || "Service";
          if (!suppressAutoAlerts) {
            showWarning(
              "Ticket marqué absent",
              `Le ticket #${ticketNum} pour le service "${svcName}" a été marqué absent par l'agent.`,
              "OK",
              () => {
                if (expiryCheckIntervalRef.current) clearInterval(expiryCheckIntervalRef.current);
                if (activeTicket?.id) removeExpiredTicket(activeTicket.id);
                onTicketExpired?.();
              }
            );
          } else {
            if (expiryCheckIntervalRef.current) clearInterval(expiryCheckIntervalRef.current);
            if (activeTicket?.id) removeExpiredTicket(activeTicket.id);
            onTicketExpired?.();
          }
        };

        channel.listen('.ticket.updated', handleTicketUpdated);
        channel.listen('.ticket.marked.absent', handleMarkedAbsent);
      } catch (error) {
        console.warn("Erreur setup WebSocket:", error);
      }
    };

    setupWebSocket();

    return () => {
      if (wsChannelRef.current) {
        try {
          wsChannelRef.current.stopListening('.ticket.updated');
          wsChannelRef.current.stopListening('.ticket.marked.absent');
          wsChannelRef.current.leave();
        } catch (e) {}
        wsChannelRef.current = null;
      }
    };
  }, [activeTicket?.id, handleTicketExpired]);

  useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: progress,
      friction: 7,
      tension: 40,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  if (localStatus === "absent") {
    return null;
  }

  const isTicketCalledState = localStatus === "called";
  const isTicketEnRoute = localStatus === "en_route";
  const isTicketPresent = localStatus === "present";
  const canCancelTicket = localStatus === "waiting";
  const canConfirmEnRoute = localStatus === "called";
  const canMarkPresent = localStatus === "en_route" || localStatus === "called";

  const getStatusConfig = () => {
    if (isTicketPresent) return { label: "Présent", icon: "checkmark-circle", color: colors.success, bg: colors.success + "15" };
    if (isTicketEnRoute) return { label: "En route", icon: "walk", color: colors.warning, bg: colors.warning + "15" };
    if (isTicketCalledState) return { label: "Appelé !", icon: "notifications", color: colors.danger, bg: colors.danger + "15" };
    return { label: "En attente", icon: "time", color: colors.primary, bg: colors.primary + "15" };
  };

  const statusConfig = getStatusConfig();
  const isSpecialStatus = isTicketCalledState || isTicketEnRoute || isTicketPresent;
  const isSoon = position <= 3 && !isSpecialStatus;

  const [calledCountdown, setCalledCountdown] = useState<number | null>(null);
  useEffect(() => {
    if (!isTicketCalledState || !calledExpiresAt) { 
      setCalledCountdown(null); 
      return; 
    }
    const calc = () => Math.max(0, Math.floor((new Date(calledExpiresAt).getTime() - Date.now()) / 1000));
    setCalledCountdown(calc());
    const id = setInterval(() => setCalledCountdown(calc()), 1000);
    return () => clearInterval(id);
  }, [isTicketCalledState, calledExpiresAt]);

  const handleCancel = useCallback(() => {
    showWarning("Annuler le ticket", "Êtes-vous sûr de vouloir annuler votre ticket ?", "Oui, annuler", async () => {
      try {
        if (activeTicket?.id) await cancelTicket(activeTicket.id);
        onCancel?.();
      } catch (error: any) {
        showError("Erreur", error?.response?.data?.message || "Impossible d'annuler");
      }
    }, "Non");
  }, [activeTicket, cancelTicket, onCancel, showWarning, showError]);

  const handleConfirmPresence = useCallback(async () => {
    try {
      const rawTravel = distanceInfo?.travelTimes?.[preferredTransportMode];
      const payload: { estimated_travel_minutes?: number } = {};
      if (typeof rawTravel === "number" && Number.isFinite(rawTravel)) {
        payload.estimated_travel_minutes = Math.min(60, Math.max(1, Math.round(rawTravel)));
      }
      const response = await axiosClient.post(`/tickets/${activeTicket?.id}/en-route`, payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      setLocalStatus("en_route");
      setEnRouteExpiresAt(response.data?.en_route_expires_at || null);
      
      const s = useTicketStore.getState();
      if (s.activeTicket?.id === activeTicket?.id) {
        const updatedTicket = response.data?.data || response.data;
        if (updatedTicket?.en_route_expires_at) {
          useTicketStore.setState({
            activeTicket: { ...(s.activeTicket as any), status: "en_route", en_route_at: updatedTicket.en_route_at, en_route_expires_at: updatedTicket.en_route_expires_at },
            activeTickets: s.activeTickets.map((t: any) =>
              t.id === activeTicket?.id ? { ...t, status: "en_route", en_route_at: updatedTicket.en_route_at, en_route_expires_at: updatedTicket.en_route_expires_at } : t
            ),
          });
        }
        s.markEnRoute();
      }
      const graceMinutes = response.data?.grace_minutes ?? 10;

      showSuccess(
        "Confirmation envoyée !",
        `L'agent a été notifié. Vous avez ${graceMinutes} minute${graceMinutes > 1 ? "s" : ""} pour vous présenter à l'établissement.`,
        "OK",
        () => { useTicketStore.getState().fetchActiveTicket().catch(console.warn); }
      );
      onConfirmPresence?.();
    } catch (error: any) {
      showError("Erreur", getApiErrorMessage(error, "Impossible de confirmer"));
    }
  }, [activeTicket, distanceInfo, preferredTransportMode, onConfirmPresence, showSuccess, showError]);

  const handleMarkPresent = useCallback(async () => {
    try {
      await axiosClient.post(`/tickets/${activeTicket?.id}/present`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      setLocalStatus("present");

      const s = useTicketStore.getState();
      s.markPresent();

      showSuccess(
        "Présence confirmée !",
        "Votre priorité est conservée. L'agent sait maintenant que vous êtes arrivé.",
        "OK",
        () => { s.fetchActiveTicket().catch(console.warn); }
      );
      onConfirmPresence?.();
    } catch (error: any) {
      showError("Erreur", getApiErrorMessage(error, "Impossible de confirmer votre présence"));
    }
  }, [activeTicket, onConfirmPresence, showSuccess, showError]);

  if (!activeTicket) return null;

  const ticketNumber = activeTicket.number || position;
  const serviceName = activeTicket.service?.name || "Service";

  const [enRouteCountdown, setEnRouteCountdown] = useState<number | null>(null);
  const enRouteExpiryAlerted = useRef(false);
  
  useEffect(() => {
    if (!isTicketEnRoute || !enRouteExpiresAt) { 
      setEnRouteCountdown(null); 
      enRouteExpiryAlerted.current = false; 
      return; 
    }
    const calc = () => Math.max(0, Math.floor((new Date(enRouteExpiresAt).getTime() - Date.now()) / 1000));
    setEnRouteCountdown(calc());
    const id = setInterval(() => setEnRouteCountdown(calc()), 1000);
    return () => clearInterval(id);
  }, [isTicketEnRoute, enRouteExpiresAt]);

  const isEnRouteExpiredNow = isTicketEnRoute && enRouteCountdown !== null && enRouteCountdown <= 0;

  useEffect(() => {
    if (isEnRouteExpiredNow && !enRouteExpiryAlerted.current && localStatus === "en_route" && !suppressAutoAlerts) {
      enRouteExpiryAlerted.current = true;
      handleTicketExpired();
    }
  }, [isEnRouteExpiredNow, localStatus, suppressAutoAlerts, handleTicketExpired]);

  const warningShownRef = useRef(false);
  useEffect(() => {
    if (suppressAutoAlerts) return;
    
    if (isTicketCalledState && calledCountdown !== null && calledCountdown === 30 && !warningShownRef.current) {
      warningShownRef.current = true;
      showWarning(
        "Délai bientôt expiré",
        `Vous avez 30 secondes pour confirmer votre présence, sinon votre ticket ${ticketNumber} sera annulé.`,
        "OK",
        undefined
      );
    }
    
    if (isTicketEnRoute && enRouteCountdown !== null && enRouteCountdown === 60 && !warningShownRef.current) {
      warningShownRef.current = true;
      showWarning(
        "Présentation imminente",
        `Vous avez 1 minute pour vous présenter, sinon votre ticket ${ticketNumber} sera marqué absent.`,
        "OK",
        undefined
      );
    }
  }, [isTicketCalledState, calledCountdown, isTicketEnRoute, enRouteCountdown, ticketNumber, showWarning, suppressAutoAlerts]);

  const getMotorcycleTime = () => {
    if (!distanceInfo?.travelTimes?.car) return null;
    const carMinutes = distanceInfo.travelTimes.car;
    const motorcycleMinutes = Math.round(carMinutes * 0.7);
    return formatTravelTime(motorcycleMinutes);
  };

  const transportModes = [
    { key: "distance", icon: "location-outline", label: "Distance", value: distanceInfo ? formatDistance(distanceInfo.kilometers) : null, color: colors.primary },
    { key: "walking", icon: "walk-outline", label: "À pied", value: distanceInfo ? formatTravelTime(distanceInfo.travelTimes.walking) : null, color: colors.success },
    { key: "car", icon: "car-outline", label: "Voiture", value: distanceInfo ? formatTravelTime(distanceInfo.travelTimes.car) : null, color: colors.warning },
    { key: "motorcycle", icon: "bicycle-outline", label: "Moto", value: getMotorcycleTime(), color: colors.secondary || "#8B5CF6" },
  ];

  const getQueueDisplay = () => {
    if (isTicketPresent) return { label: "Statut", value: "Présent", color: colors.success };
    if (isTicketEnRoute) return { label: "Statut", value: "En route", color: colors.warning };
    if (isTicketCalledState) return { label: "Statut", value: "Appelé", color: colors.danger };
    return { label: "Position", value: `${position}e / ${queueLength}`, color: colors.primary };
  };

  const queueDisplay = getQueueDisplay();
  const etaDisplay = isSpecialStatus ? "—" : `${etaMinutes} min`;

  const getWhenToLeave = useCallback(() => {
    if (!distanceInfo || isSpecialStatus) return null;
    const travelTime = distanceInfo.travelTimes[preferredTransportMode];
    const leaveIn = etaMinutes - travelTime - marginMinutes;
    if (leaveIn <= 0) return { urgent: true, message: "Partez maintenant !" };
    if (leaveIn <= 5) return { urgent: true, message: `Partez dans ~${leaveIn} min` };
    return { urgent: false, message: `Partez dans ~${leaveIn} min` };
  }, [distanceInfo, etaMinutes, marginMinutes, preferredTransportMode, isSpecialStatus]);

  const whenToLeave = getWhenToLeave();

  return (
    <>
      <TouchableOpacity
        style={[
          styles.container,
          compact && styles.containerCompact,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        onPress={onPress}
        activeOpacity={0.95}
        disabled={!onPress}
      >
        <View style={styles.header}>
          <View style={styles.estabInfo}>
            <View style={[styles.estabIcon, { backgroundColor: colors.primary + "15" }]}>
              <Ionicons name="business" size={14} color={colors.primary} />
            </View>
            <Text style={[styles.estabName, { color: colors.textPrimary }]} numberOfLines={2} ellipsizeMode="tail">
              {activeTicket.establishment?.name || "Établissement"}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <Ionicons name={statusConfig.icon as any} size={10} color={statusConfig.color} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
          </View>
        </View>

        <View style={styles.ticketRow}>
          <View style={[styles.ticketNumberBox, { backgroundColor: colors.danger }]}>
            <Text style={styles.ticketNumber}>{activeTicket.number || position}</Text>
          </View>
          <View style={styles.serviceInfo}>
            <Text style={[styles.serviceName, { color: colors.textPrimary }]} numberOfLines={1}>
              {activeTicket.service?.name || "Service"}
            </Text>
            <Text style={[styles.ticketTime, { color: colors.textTertiary }]}>
              {new Date(activeTicket.created_at || Date.now()).toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{queueDisplay.label}</Text>
            <Text style={[styles.statValue, { color: queueDisplay.color }]}>{queueDisplay.value}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Estimation</Text>
            <Text style={[styles.statValue, { color: colors.primary }]}>{etaDisplay}</Text>
          </View>
        </View>

        {!isSpecialStatus && (
          <View style={styles.progressSection}>
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <Animated.View
                style={[
                  styles.progressFill,
                  { backgroundColor: isSoon ? colors.warning : colors.primary },
                  { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) },
                ]}
              />
            </View>
            {isSoon && <Text style={[styles.soonText, { color: colors.warning }]}>⚡ Bientôt votre tour !</Text>}
          </View>
        )}

        {/* Bannière ticket reporté */}
        {(activeTicket as any)?.auto_deferred && (activeTicket as any)?.valid_date && (
          <View style={[styles.deferredBanner, { backgroundColor: colors.warning + "18", borderColor: colors.warning + "40" }]}>
            <Ionicons name="calendar-outline" size={14} color={colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.deferredBannerTitle, { color: colors.warning }]}>
                Ticket reporté au{" "}
                {new Date((activeTicket as any).valid_date + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" })}
              </Text>
              <Text style={[styles.deferredBannerSub, { color: colors.textSecondary }]}>
                {(activeTicket as any).defer_reason === "past_cutoff" ? "Créé après la fermeture du service" :
                 (activeTicket as any).defer_reason === "non_working_day" ? "Service fermé ce jour" :
                 (activeTicket as any).defer_reason === "holiday" ? "Jour férié" :
                 (activeTicket as any).defer_reason === "critical_zone" ? "File saturée — reporté automatiquement" :
                 (activeTicket as any).defer_reason === "exceptional_closure" ? "Fermeture exceptionnelle" :
                 "Votre ticket sera traité à l'ouverture"}
              </Text>
            </View>
          </View>
        )}

        {/* When to Leave Alert */}
        {whenToLeave && (
          <View style={[styles.leaveAlert, { backgroundColor: whenToLeave.urgent ? colors.danger + "20" : colors.warning + "20" }]}>
            <Ionicons name={whenToLeave.urgent ? "warning" : "time"} size={14} color={whenToLeave.urgent ? colors.danger : colors.warning} />
            <Text style={[styles.leaveText, { color: whenToLeave.urgent ? colors.danger : colors.warning }]}>{whenToLeave.message}</Text>
          </View>
        )}

        {isTicketCalledState && calledCountdown !== null && (
          <View style={[
            styles.calledCountdownBadge,
            { backgroundColor: calledCountdown <= 30 ? colors.danger + "15" : colors.warning + "12", borderColor: calledCountdown <= 30 ? colors.danger + "40" : colors.warning + "30" },
          ]}>
            <Ionicons name="timer-outline" size={14} color={calledCountdown <= 30 ? colors.danger : colors.warning} />
            <Text style={[styles.calledCountdownText, { color: calledCountdown <= 30 ? colors.danger : colors.warning }]}>
              {calledCountdown <= 0
                ? "Délai expiré"
                : `Délai : ${Math.floor(calledCountdown / 60)}:${String(calledCountdown % 60).padStart(2, "0")}`}
            </Text>
          </View>
        )}

        {!isTicketPresent && !isTicketEnRoute && (
          <View style={styles.actionsRow}>
            {canConfirmEnRoute && (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.success + "12" }]} onPress={handleConfirmPresence}>
                <Ionicons name="walk" size={16} color={colors.success} />
                <Text style={[styles.actionBtnText, { color: colors.success }]}>En route</Text>
              </TouchableOpacity>
            )}
            {canCancelTicket && !isSpecialStatus && (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.danger + "12" }]} onPress={handleCancel}>
                <Ionicons name="close-circle" size={16} color={colors.danger} />
                <Text style={[styles.actionBtnText, { color: colors.danger }]}>Annuler</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {isTicketEnRoute && (
          <View style={styles.enRouteContainer}>
            <View style={[
              styles.enRouteTimerBadge,
              { backgroundColor: enRouteCountdown !== null && enRouteCountdown <= 60 ? colors.danger + "15" : colors.warning + "15" },
            ]}>
              <Ionicons name="timer-outline" size={14} color={enRouteCountdown !== null && enRouteCountdown <= 60 ? colors.danger : colors.warning} />
              <Text style={[styles.enRouteTimerText, { color: enRouteCountdown !== null && enRouteCountdown <= 60 ? colors.danger : colors.warning, fontVariant: ["tabular-nums"] as any }]}>
                {enRouteCountdown !== null
                  ? `Présentation : ${Math.floor(enRouteCountdown / 60)}:${String(enRouteCountdown % 60).padStart(2, "0")}`
                  : "Délai de présence en cours…"}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.presentButton, { backgroundColor: colors.primary + "15", marginTop: 10 }]}
              onPress={handleMarkPresent}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-done-circle" size={18} color={colors.primary} />
              <Text style={[styles.presentButtonText, { color: colors.primary }]}>Je suis présent</Text>
            </TouchableOpacity>
          </View>
        )}

        {compact && !isSpecialStatus && hasValidCoordinates && distanceInfo && (
          <View style={styles.distanceContainer}>
            {transportModes.map((mode) => (
              <View key={mode.key} style={styles.distanceItem}>
                <View style={[styles.distanceIconWrapper, { backgroundColor: mode.color + "15" }]}>
                  <Ionicons name={mode.icon as any} size={18} color={mode.color} />
                </View>
                <Text style={[styles.distanceValue, { color: colors.textPrimary }]}>{mode.value || "—"}</Text>
                <Text style={[styles.distanceLabel, { color: colors.textTertiary }]}>{mode.label}</Text>
              </View>
            ))}
          </View>
        )}

        {isTicketPresent && (
          <View style={[styles.stateMsg, { backgroundColor: colors.success + "10", borderColor: colors.success + "20" }]}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={[styles.stateMsgText, { color: colors.success }]}>Présent - Priorité conservée</Text>
          </View>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.followBtn, { backgroundColor: colors.primary }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Ionicons name="eye-outline" size={14} color="#FFF" />
        <Text style={styles.followBtnText}>Suivre ce ticket</Text>
      </TouchableOpacity>
      {AlertComponent}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    marginTop: 18,
  },
  containerCompact: {
    padding: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  estabInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  estabIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  estabName: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
    flexWrap: "wrap",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
  },
  ticketRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  ticketNumberBox: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  ticketNumber: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFF",
  },
  serviceInfo: {
    maxWidth: "70%",
    flexShrink: 1,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  ticketTime: {
    fontSize: 11,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 10,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  statDivider: {
    width: 1,
    height: 30,
  },
  progressSection: {
    marginBottom: 12,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  soonText: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 6,
  },
  leaveAlert: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 12,
  },
  leaveText: {
    fontSize: 11,
    fontWeight: "600",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  distanceContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 0.5,
    borderTopColor: "rgba(0,0,0,0.05)",
    flexWrap: "wrap",
  },
  distanceItem: {
    alignItems: "center",
    flex: 1,
    minWidth: 70,
  },
  distanceIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  distanceValue: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
  },
  distanceLabel: {
    fontSize: 10,
    fontWeight: "500",
  },
  stateMsg: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  stateMsgText: {
    fontSize: 12,
    fontWeight: "700",
  },
  stateMsgSubtext: {
    fontSize: 11,
    marginTop: 4,
  },
  deferredBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  deferredBannerTitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
    marginBottom: 1,
  },
  deferredBannerSub: {
    fontSize: 11,
  },
  calledCountdownBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  calledCountdownText: {
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"] as any,
  },
  enRouteContainer: {
    marginTop: 8,
  },
  enRouteTimerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  enRouteTimerText: {
    fontSize: 11,
    fontWeight: "600",
  },
  presentButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  presentButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  followBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 10 },
  followBtnText: { color: "#FFF", fontSize: 13, fontWeight: "600" },
});

export default ActiveTicketCard;