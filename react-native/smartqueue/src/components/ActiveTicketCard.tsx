import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTicket } from "../store/ticketStore";
import { useDistanceTracking } from "../hooks/useDistanceTracking";
import { useAlertPreferencesStore } from "../store/alertPreferencesStore";
import { useCustomAlert } from "../hooks/useCustomAlert";
import { useThemeColors } from "../hooks/useThemeColors";
import { formatDistance, formatTravelTime } from "../utils/distance";
import "../../global.css";
import axiosClient from "../api/axiosClient";
import { getApiErrorMessage } from "../utils/errors";

interface ActiveTicketCardProps {
  onPress?: () => void;
  onCancel?: () => void;
  onConfirmPresence?: () => void;
}

export const ActiveTicketCard: React.FC<ActiveTicketCardProps> = ({
  onPress,
  onCancel,
  onConfirmPresence,
}) => {
  const colors = useThemeColors();
  const isDark = !!colors.dark?.background;
  const {
    activeTicket,
    position,
    etaMinutes,
    isCalled,
    counterNumber,
    hasRecalled,
    setRecalled,
    cancelTicket,
  } = useTicket();

  const { marginMinutes, preferredTransportMode } = useAlertPreferencesStore();
  const { AlertComponent, showWarning, showError, showInfo, showSuccess } =
    useCustomAlert();

  // Debug: log establishment coordinates
  useEffect(() => {
    if (activeTicket?.establishment) {
      console.log(
        "[ActiveTicketCard] Establishment:",
        JSON.stringify(activeTicket.establishment),
      );
    }
  }, [activeTicket?.establishment]);

  // Check if establishment has valid coordinates
  const hasValidCoordinates =
    activeTicket?.establishment &&
    (activeTicket.establishment as any)?.lat !== null &&
    (activeTicket.establishment as any)?.lat !== undefined &&
    (activeTicket.establishment as any)?.lng !== null &&
    (activeTicket.establishment as any)?.lng !== undefined;

  // Distance tracking
  const { distanceInfo } = useDistanceTracking({
    targetCoordinates: hasValidCoordinates
      ? {
          latitude: (activeTicket.establishment as any).lat,
          longitude: (activeTicket.establishment as any).lng,
        }
      : null,
    enabled: hasValidCoordinates,
  });

  // Animation refs
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Queue length (from ticket data from backend)
  const queueLength = (activeTicket as any)?.queue_length || position || 1;
  const processedCount = Math.max(0, queueLength - (position || 0));

  const isTicketCalledState = activeTicket?.status === "called";

  const queueState = isTicketCalledState
    ? {
        label: "Statut du ticket",
        value: "Appelé au guichet",
        etaLabel: "Présentez-vous maintenant",
      }
    : {
        label: "Position dans la file",
        value: `${position}ème / ${queueLength}`,
        etaLabel: `≈ ${etaMinutes} minutes`,
      };

  // Calculate when to leave
  const getWhenToLeave = useCallback(() => {
    if (!distanceInfo) return null;

    const travelTime = distanceInfo.travelTimes[preferredTransportMode];
    const leaveIn = etaMinutes - travelTime - marginMinutes;

    if (leaveIn <= 0) {
      return { urgent: true, message: "Partez maintenant !" };
    } else if (leaveIn <= 5) {
      return { urgent: true, message: `Partez dans ~${leaveIn} min` };
    }
    return {
      urgent: false,
      message: `Vous devriez partir dans ~${leaveIn} min`,
    };
  }, [distanceInfo, etaMinutes, marginMinutes, preferredTransportMode]);

  const whenToLeave = getWhenToLeave();

  // Progress bar animation
  useEffect(() => {
    const progress = queueLength > 0 ? processedCount / queueLength : 0;
    Animated.spring(progressAnim, {
      toValue: progress,
      friction: 7,
      tension: 40,
      useNativeDriver: false,
    }).start();
  }, [processedCount, queueLength, progressAnim]);

  // Called state animations (pulsing red)
  useEffect(() => {
    if (isCalled) {
      // Haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      // Pulsing animation
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();

      return () => pulse.stop();
    }
  }, [isCalled, pulseAnim]);

  // Handle cancel ticket
  const handleCancel = useCallback(() => {
    showWarning(
      "Annuler le ticket",
      "Êtes-vous sûr de vouloir annuler votre ticket ?",
      "Oui, annuler",
      async () => {
        try {
          if (activeTicket?.id) {
            await cancelTicket(activeTicket.id);
          }
          onCancel?.();
        } catch (error: any) {
          const errorMsg =
            error?.response?.data?.message ||
            error?.message ||
            "Impossible d'annuler le ticket";
          showError("Erreur", errorMsg);
        }
      },
      "Non",
    );
  }, [activeTicket, cancelTicket, onCancel, showWarning, showError]);

  // Handle confirm presence
  const handleConfirmPresence = useCallback(async () => {
    try {
      const rawTravel = distanceInfo?.travelTimes?.[preferredTransportMode];
      const payload: { estimated_travel_minutes?: number } = {};
      if (typeof rawTravel === "number" && Number.isFinite(rawTravel)) {
        // Le backend valide estimated_travel_minutes en integer|min:1|max:60 ;
        // on borne pour éviter un 422 (qui crashait l'app en build).
        payload.estimated_travel_minutes = Math.min(
          60,
          Math.max(1, Math.round(rawTravel)),
        );
      }
      await axiosClient.post(`/tickets/${activeTicket?.id}/en-route`, payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSuccess(
        "Présence confirmée",
        "L'agent a été notifié de votre arrivée",
      );
      onConfirmPresence?.();
    } catch (error: any) {
      showError("Erreur", getApiErrorMessage(error, "Impossible de confirmer"));
    }
  }, [
    activeTicket,
    distanceInfo,
    preferredTransportMode,
    onConfirmPresence,
    showSuccess,
    showError,
  ]);

  // Handle recall
  const handleRecall = useCallback(async () => {
    if (hasRecalled) {
      showInfo("Info", "Le rappel a déjà été utilisé");
      return;
    }

    try {
      await axiosClient.post(`/tickets/${activeTicket?.id}/request-recall`);
      setRecalled();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (error: any) {
      showError(
        "Erreur",
        getApiErrorMessage(error, "Impossible d'envoyer le rappel"),
      );
    }
  }, [activeTicket, hasRecalled, setRecalled, showInfo, showError]);

  if (!activeTicket) return null;

  // Called state is now handled by global CalledTicketOverlay in tab layout
  // When ticket is called, the overlay takes over the entire screen

  // Normal state
  return (
    <>
      <TouchableOpacity
        style={[
          styles.container,
          {
            backgroundColor: colors.surface,
            borderColor: colors.borderSecondary,
            borderWidth: 1,
          },
        ]}
        onPress={onPress}
        activeOpacity={0.95}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.establishmentInfo}>
            <Ionicons name="business" size={18} color={colors.primary} />
            <Text
              style={[styles.establishmentName, { color: colors.textPrimary }]}
            >
              {activeTicket.establishment?.name || "Établissement"}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: colors.success + "20" },
            ]}
          >
            <View
              style={[styles.statusDot, { backgroundColor: colors.success }]}
            />
            <Text style={[styles.statusText, { color: colors.success }]}>
              File ouverte
            </Text>
          </View>
        </View>

        {/* Ticket Info */}
        <View style={styles.ticketSection}>
          <View style={styles.ticketNumberContainer}>
            <Text style={[styles.ticketLabel, { color: colors.textTertiary }]}>
              VOTRE TICKET
            </Text>
            <View
              style={[
                styles.ticketNumberBox,
                { backgroundColor: colors.danger },
              ]}
            >
              <Text style={styles.ticketNumber}>
                N°{activeTicket.number?.split("-").pop() || position}
              </Text>
            </View>
          </View>
          <View style={styles.serviceInfo}>
            <Text style={[styles.serviceName, { color: colors.textPrimary }]}>
              {activeTicket.service?.name || "Service"}
            </Text>
            <Text style={[styles.ticketTime, { color: colors.textSecondary }]}>
              Pris à{" "}
              {new Date(
                activeTicket.created_at || Date.now(),
              ).toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        </View>

        {/* Position & ETA */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              {queueState.label}
            </Text>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              <Text
                style={[
                  styles.statHighlight,
                  {
                    color: isTicketCalledState ? colors.danger : colors.primary,
                  },
                ]}
              >
                {queueState.value}
              </Text>
            </Text>
          </View>
          <View
            style={[styles.statDivider, { backgroundColor: colors.separator }]}
          />
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Temps d&apos;attente estimé
            </Text>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {isTicketCalledState ? (
                <Text style={[styles.statHighlight, { color: colors.danger }]}>
                  {queueState.etaLabel}
                </Text>
              ) : (
                <>
                  ≈ <Text style={styles.statHighlight}>{etaMinutes}</Text>{" "}
                  minutes
                </>
              )}
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressSection}>
          <View
            style={[
              styles.progressBar,
              { backgroundColor: colors.surfaceSecondary },
            ]}
          >
            <Animated.View
              style={[
                styles.progressFill,
                { backgroundColor: colors.primary },
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            {processedCount} / {queueLength} traités
          </Text>
        </View>

        {/* Distance Block */}
        {hasValidCoordinates && distanceInfo ? (
          <View style={styles.distanceGrid}>
            {[
              {
                icon: "navigate",
                label: "Distance",
                value: formatDistance(distanceInfo.kilometers),
              },
              {
                icon: "walk",
                label: "À pied",
                value: formatTravelTime(distanceInfo.travelTimes.walking),
              },
              {
                icon: "bicycle",
                label: "À moto",
                value: formatTravelTime(distanceInfo.travelTimes.car * 0.7), // Moto ~30% plus rapide que voiture
              },
              {
                icon: "car",
                label: "Voiture",
                value: formatTravelTime(distanceInfo.travelTimes.car),
              },
            ].map((item, index) => (
              <View
                key={index}
                style={[
                  styles.distanceCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons
                  name={item.icon as any}
                  size={24}
                  color={colors.textSecondary}
                />
                <Text
                  style={[styles.distanceValue, { color: colors.textPrimary }]}
                >
                  {item.value}
                </Text>
                <Text
                  style={[styles.distanceLabel, { color: colors.textTertiary }]}
                >
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View
            style={[
              styles.noCoordinatesContainer,
              { backgroundColor: colors.surfaceSecondary },
            ]}
          >
            <Ionicons
              name="location-outline"
              size={24}
              color={colors.textTertiary}
            />
            <Text
              style={[
                styles.noCoordinatesText,
                { color: colors.textSecondary },
              ]}
            >
              Coordonnées non disponibles
            </Text>
            <Text
              style={[
                styles.noCoordinatesSubtext,
                { color: colors.textTertiary },
              ]}
            >
              L&apos;établissement n&lsquo;a pas renseigné sa position GPS
            </Text>
          </View>
        )}

        {/* When to Leave Alert */}
        {whenToLeave && (
          <View
            style={[
              styles.leaveAlert,
              {
                backgroundColor: whenToLeave.urgent
                  ? colors.danger + "20"
                  : colors.warning + "20",
              },
            ]}
          >
            <Ionicons
              name={whenToLeave.urgent ? "warning" : "time"}
              size={16}
              color={whenToLeave.urgent ? colors.danger : colors.warning}
            />
            <Text
              style={[
                styles.leaveText,
                { color: whenToLeave.urgent ? colors.danger : colors.warning },
              ]}
            >
              {whenToLeave.message}
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[
              styles.confirmPresenceButton,
              { backgroundColor: colors.success + "20" },
            ]}
            onPress={handleConfirmPresence}
            activeOpacity={0.8}
          >
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={colors.success}
            />
            <Text
              style={[styles.confirmPresenceText, { color: colors.success }]}
            >
              Je suis présent
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.cancelTicketButton,
              { backgroundColor: colors.danger + "20" },
            ]}
            onPress={handleCancel}
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle" size={18} color={colors.danger} />
            <Text style={[styles.cancelTicketText, { color: colors.danger }]}>
              Annuler
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
      {AlertComponent}
    </>
  );
};

const styles = StyleSheet.create({
  // Normal state
  container: {
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  establishmentInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  establishmentName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginLeft: 8,
    flex: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#16A34A",
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#16A34A",
  },
  ticketSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  ticketNumberContainer: {
    alignItems: "center",
  },
  ticketLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 1,
    marginBottom: 6,
  },
  ticketNumberBox: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
  },
  ticketNumber: {
    fontSize: 20,
    fontWeight: "800",
    color: "white",
  },
  serviceInfo: {
    marginLeft: 16,
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  ticketTime: {
    fontSize: 13,
    color: "#6B7280",
  },
  statsRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "500",
    color: "#111827",
  },
  statHighlight: {
    fontWeight: "700",
    color: "#3B82F6",
  },
  statDivider: {
    width: 1,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 16,
  },
  progressSection: {
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#3B82F6",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 11,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 6,
  },
  distanceRow: {
    flexDirection: "row",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  distanceItem: {
    flexDirection: "column",
    alignItems: "center",
  },

  leaveAlert: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  leaveAlertUrgent: {
    backgroundColor: "#FEE2E2",
  },
  leaveText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#B45309",
    marginLeft: 8,
  },
  leaveTextUrgent: {
    color: "#DC2626",
  },
  noCoordinatesContainer: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 12,
  },
  noCoordinatesText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 8,
  },
  noCoordinatesSubtext: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  confirmPresenceButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DCFCE7",
    paddingVertical: 12,
    borderRadius: 12,
  },
  confirmPresenceText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#16A34A",
    marginLeft: 6,
  },
  cancelTicketButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  cancelTicketText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#EF4444",
    marginLeft: 6,
  },

  // Called state
  calledContainer: {
    backgroundColor: "#DC2626",
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 16,
    marginTop: 16,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  calledContent: {
    alignItems: "center",
    marginBottom: 24,
  },
  calledIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  calledTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "white",
    textAlign: "center",
    letterSpacing: 1,
  },
  counterBadge: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
  },
  counterText: {
    fontSize: 18,
    fontWeight: "700",
    color: "white",
  },
  calledSubtext: {
    fontSize: 16,
    color: "rgba(255,255,255,0.8)",
    marginTop: 12,
  },
  calledActions: {
    gap: 12,
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    paddingVertical: 14,
    borderRadius: 12,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#16A34A",
    marginLeft: 8,
  },
  recallButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
  },
  recallButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
    marginLeft: 8,
  },
  cancelButtonSmall: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  cancelButtonText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    marginLeft: 6,
  },
  distanceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  distanceCard: {
    backgroundColor: "white",
    width: "48%", // deux cartes par ligne
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderColor: "#E5E7EB",
    borderWidth: 1,
  },
  distanceValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginTop: 8,
  },
  distanceLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
});

export default ActiveTicketCard;
