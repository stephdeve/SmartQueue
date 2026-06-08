import React, { useEffect, useRef, useCallback } from "react";
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

const { width } = Dimensions.get("window");

interface ActiveTicketCardProps {
  onPress?: () => void;
  onCancel?: () => void;
  onConfirmPresence?: () => void;
  compact?: boolean;
}

export const ActiveTicketCard: React.FC<ActiveTicketCardProps> = ({
  onPress,
  onCancel,
  onConfirmPresence,
  compact = false,
}) => {
  const colors = useThemeColors();

  const { activeTicket, position, etaMinutes, isCalled, cancelTicket } = useTicket();
  const { marginMinutes, preferredTransportMode } = useAlertPreferencesStore();
  const { AlertComponent, showWarning, showError, showSuccess } = useCustomAlert();

  const progressAnim = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: progress,
      friction: 7,
      tension: 40,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const isTicketCalledState = activeTicket?.status === "called";
  const isTicketEnRoute = activeTicket?.status === "en_route";
  const isTicketPresent = activeTicket?.status === "present";
  const isTicketAbsent = activeTicket?.status === "absent";
  const hasConfirmedPresence = isTicketEnRoute || isTicketPresent;
  const canCancelTicket = activeTicket?.status === "waiting";
  const canConfirmEnRoute = activeTicket?.status === "called";
  const canMarkPresent = activeTicket?.status === "en_route" || activeTicket?.status === "called";

  const getStatusConfig = () => {
    if (isTicketPresent) return { label: "Présent", icon: "checkmark-circle", color: colors.success, bg: colors.success + "15" };
    if (isTicketEnRoute) return { label: "En route", icon: "walk", color: colors.warning, bg: colors.warning + "15" };
    if (isTicketCalledState) return { label: "Appelé !", icon: "notifications", color: colors.danger, bg: colors.danger + "15" };
    if (isTicketAbsent) return { label: "Expiré", icon: "close-circle", color: colors.textTertiary, bg: colors.textTertiary + "15" };
    return { label: "En attente", icon: "time", color: colors.primary, bg: colors.primary + "15" };
  };

  const statusConfig = getStatusConfig();
  const isSpecialStatus = isTicketCalledState || isTicketEnRoute || isTicketPresent;
  const isSoon = position <= 3 && !isSpecialStatus;

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
      await axiosClient.post(`/tickets/${activeTicket?.id}/en-route`, payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const s = useTicketStore.getState();
      if (s.activeTicket?.id === activeTicket?.id) {
        s.markEnRoute();
        try { await s.fetchActiveTicket(); } catch (err) { console.warn(err); }
      }
      showSuccess("Confirmation", "L'agent a été notifié que vous êtes en route");
      onConfirmPresence?.();
    } catch (error: any) {
      showError("Erreur", getApiErrorMessage(error, "Impossible de confirmer"));
    }
  }, [activeTicket, distanceInfo, preferredTransportMode, onConfirmPresence, showSuccess, showError]);

  const handleMarkPresent = useCallback(async () => {
    try {
      await axiosClient.post(`/tickets/${activeTicket?.id}/present`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const s = useTicketStore.getState();
      if (s.activeTicket?.id === activeTicket?.id) {
        s.markPresent();
        try { await s.fetchActiveTicket(); } catch (err) { console.warn(err); }
      }
      showSuccess("Présence confirmée", "Votre priorité est conservée. L'agent sait que vous êtes arrivé.");
      onConfirmPresence?.();
    } catch (error: any) {
      showError("Erreur", getApiErrorMessage(error, "Impossible de confirmer votre présence"));
    }
  }, [activeTicket, onConfirmPresence, showSuccess, showError]);

  if (!activeTicket) return null;

  const absentMessage = activeTicket.absent_at
    ? "Vous avez été marqué absent par l'agent. Ce ticket n'est plus actif."
    : "Votre délai de présentation est dépassé. Ce ticket n'est plus actif.";

  const getGraceRemainingText = useCallback(() => {
    if (!activeTicket?.en_route_expires_at) return null;
    const remainingMs = new Date(activeTicket.en_route_expires_at).getTime() - Date.now();
    if (remainingMs <= 0) return "Délai expiré";
    const totalMinutes = Math.ceil(remainingMs / 60000);
    return `${totalMinutes} min restantes`;
  }, [activeTicket?.en_route_expires_at]);

  const graceRemainingText = getGraceRemainingText();

  // Calcul du temps pour la moto (environ 30% plus rapide que la voiture)
  const getMotorcycleTime = () => {
    if (!distanceInfo?.travelTimes?.car) return null;
    const carMinutes = distanceInfo.travelTimes.car;
    const motorcycleMinutes = Math.round(carMinutes * 0.7);
    return formatTravelTime(motorcycleMinutes);
  };

  // 4 moyens de transport avec icônes et couleurs
  const transportModes = [
    { key: "distance", icon: "location-outline", label: "Distance", value: distanceInfo ? formatDistance(distanceInfo.kilometers) : null, color: colors.primary },
    { key: "walking", icon: "walk-outline", label: "À pied", value: distanceInfo ? formatTravelTime(distanceInfo.travelTimes.walking) : null, color: colors.success },
    { key: "car", icon: "car-outline", label: "Voiture", value: distanceInfo ? formatTravelTime(distanceInfo.travelTimes.car) : null, color: colors.warning },
    { key: "motorcycle", icon: "bicycle-outline", label: "Moto", value: getMotorcycleTime(), color: colors.secondary || "#8B5CF6" },
  ];

  // Déterminer l'affichage de la position ou du statut
  const getQueueDisplay = () => {
    if (isTicketPresent) return { label: "Statut", value: "Présent", color: colors.success };
    if (isTicketEnRoute) return { label: "Statut", value: "En route", color: colors.warning };
    if (isTicketCalledState) return { label: "Statut", value: "Appelé", color: colors.danger };
    return { label: "Position", value: `${position}e / ${queueLength}`, color: colors.primary };
  };

  const queueDisplay = getQueueDisplay();
  const etaDisplay = isSpecialStatus ? "—" : `${etaMinutes} min`;

  // When to leave calculation
  const getWhenToLeave = useCallback(() => {
    if (!distanceInfo || isSpecialStatus || isTicketAbsent) return null;
    const travelTime = distanceInfo.travelTimes[preferredTransportMode];
    const leaveIn = etaMinutes - travelTime - marginMinutes;
    if (leaveIn <= 0) return { urgent: true, message: "Partez maintenant !" };
    if (leaveIn <= 5) return { urgent: true, message: `Partez dans ~${leaveIn} min` };
    return { urgent: false, message: `Partez dans ~${leaveIn} min` };
  }, [distanceInfo, etaMinutes, marginMinutes, preferredTransportMode, isSpecialStatus, isTicketAbsent]);

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
        {/* Header */}
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

        {/* Ticket Info */}
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

        {/* Position & ETA */}
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

        {/* Progress Bar - only if waiting */}
        {!isSpecialStatus && !isTicketAbsent && (
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

        {/* When to Leave Alert */}
        {whenToLeave && (
          <View style={[styles.leaveAlert, { backgroundColor: whenToLeave.urgent ? colors.danger + "20" : colors.warning + "20" }]}>
            <Ionicons name={whenToLeave.urgent ? "warning" : "time"} size={14} color={whenToLeave.urgent ? colors.danger : colors.warning} />
            <Text style={[styles.leaveText, { color: whenToLeave.urgent ? colors.danger : colors.warning }]}>{whenToLeave.message}</Text>
          </View>
        )}

        {/* Actions - sans le bouton "Je suis présent" ici */}
        {!isTicketAbsent && !isTicketPresent && !isTicketEnRoute && (
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

        {/* Timer et bouton présent pour l'état "en route" */}
        {isTicketEnRoute && (
          <View style={styles.enRouteContainer}>
            <View style={[styles.enRouteTimerBadge, { backgroundColor: colors.warning + "15" }]}>
              <Ionicons name="time" size={14} color={colors.warning} />
              <Text style={[styles.enRouteTimerText, { color: colors.warning }]}>
                Délai de priorité : {graceRemainingText || "Expiré"}
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

        {/* 4 moyens de transport - compact mode only */}
        {compact && !isSpecialStatus && hasValidCoordinates && distanceInfo && !isTicketAbsent && (
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

        {/* Absent State */}
        {isTicketAbsent && (
          <View style={[styles.stateMsg, { backgroundColor: colors.danger + "10", borderColor: colors.danger + "20" }]}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.stateMsgText, { color: colors.danger }]}>Ticket expiré ou absent</Text>
              <Text style={[styles.stateMsgSubtext, { color: colors.textSecondary }]}>{absentMessage}</Text>
            </View>
          </View>
        )}

        {/* Present State */}
        {isTicketPresent && (
          <View style={[styles.stateMsg, { backgroundColor: colors.success + "10", borderColor: colors.success + "20" }]}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={[styles.stateMsgText, { color: colors.success }]}>Présent - Priorité conservée</Text>
          </View>
        )}
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
    marginTop:18,
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
    justifyContent:"space-between",
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
});

export default ActiveTicketCard;