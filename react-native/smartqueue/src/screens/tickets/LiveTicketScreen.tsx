import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useTicket, useTicketStore } from "../../store/ticketStore";
import { useDistanceTracking } from "../../hooks/useDistanceTracking";
import { useSmartNotifications } from "../../hooks/useSmartNotifications";
import { useUserStatsStore } from "../../store/userStatsStore";
import { formatDistance, formatTravelTime } from "../../utils/distance";
import { useCustomAlert } from "../../hooks/useCustomAlert";
import { useThemeColors } from "../../hooks/useThemeColors";
import axiosClient from "../../api/axiosClient";
import { getApiErrorMessage } from "../../utils/errors";

const { width } = Dimensions.get("window");

// Composant de statut compact - Version avec fond opaque
const LiveStatusBadge: React.FC<{
  status: string;
  isCalled: boolean;
  colors: any;
}> = ({ status, isCalled, colors }) => {
  const getConfig = () => {
    if (status === "present")
      return { label: "Présent", icon: "checkmark-circle", color: colors.success };
    if (status === "en_route")
      return { label: "En route", icon: "walk", color: colors.warning };
    if (isCalled)
      return { label: "Appelé", icon: "notifications", color: colors.danger };
    return { label: "En attente", icon: "time", color: colors.primary };
  };

  const config = getConfig();

  return (
    <View style={[
      styles.statusBadge, 
      { 
        backgroundColor: colors.surface + "CC",
        borderColor: config.color,
      }
    ]}>
      <Ionicons name={config.icon as any} size={12} color={config.color} />
      <Text style={[styles.statusBadgeText, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
};

// Badge Live pour le header - Version avec fond plein
const LiveIndicator: React.FC<{ colors: any }> = ({ colors }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <Animated.View style={[
      styles.liveIndicator, 
      { 
        backgroundColor: colors.danger,
        transform: [{ scale: pulseAnim }],
      }
    ]}>
      <View style={[styles.liveDot, { backgroundColor: "#FFF" }]} />
      <Text style={styles.liveIndicatorText}>LIVE</Text>
      <Ionicons name="radio" size={10} color="#FFF" />
    </Animated.View>
  );
};

// Composant d'info compact
const CompactInfoRow: React.FC<{
  icon: string;
  label: string;
  value: string;
  color: string;
  colors: any;
}> = ({ icon, label, value, color, colors }) => (
  <View style={[styles.compactInfoRow, { backgroundColor: colors.surfaceSecondary }]}>
    <View style={[styles.compactInfoIcon, { backgroundColor: color + "15" }]}>
      <Ionicons name={icon as any} size={16} color={color} />
    </View>
    <View style={styles.compactInfoContent}>
      <Text style={[styles.compactInfoLabel, { color: colors.textTertiary }]}>{label}</Text>
      <Text style={[styles.compactInfoValue, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  </View>
);

// Composant distance avec icônes
const DistanceCard: React.FC<{
  distanceInfo: any;
  colors: any;
  departureInfo: any;
}> = ({ distanceInfo, colors, departureInfo }) => {
  const travelModes = [
    { 
      icon: "walk-outline", 
      label: "À pied", 
      time: distanceInfo?.travelTimes?.walking,
      color: colors.success
    },
    { 
      icon: "car-outline", 
      label: "Voiture", 
      time: distanceInfo?.travelTimes?.car,
      color: colors.primary
    },
    { 
      icon: "bicycle-outline", 
      label: "Moto", 
      time: distanceInfo?.travelTimes?.bicycle || (distanceInfo?.travelTimes?.car ? distanceInfo.travelTimes.car * 0.7 : null),
      color: colors.warning
    },
  ];

  return (
    <View style={[styles.distanceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.distanceCardHeader}>
        <View style={styles.distanceTitleContainer}>
          <Ionicons name="navigate-circle" size={20} color={colors.primary} />
          <Text style={[styles.distanceCardTitle, { color: colors.textPrimary }]}>
            Distance & durée
          </Text>
        </View>
        <View style={[styles.distanceBadge, { backgroundColor: colors.primary + "10" }]}>
          <Text style={[styles.distanceBadgeText, { color: colors.primary }]}>
            {formatDistance(distanceInfo?.kilometers || 0)}
          </Text>
        </View>
      </View>

      <View style={styles.travelModesGrid}>
        {travelModes.map((mode, index) => (
          <View key={index} style={styles.travelModeItem}>
            <View style={[styles.travelModeIcon, { backgroundColor: mode.color + "15" }]}>
              <Ionicons name={mode.icon as any} size={24} color={mode.color} />
            </View>
            <Text style={[styles.travelModeLabel, { color: colors.textSecondary }]}>
              {mode.label}
            </Text>
            <Text style={[styles.travelModeTime, { color: mode.color }]}>
              {mode.time ? formatTravelTime(mode.time) : "—"}
            </Text>
          </View>
        ))}
      </View>

      {departureInfo && (
        <View style={[styles.departureAlert, { backgroundColor: colors.warning + "10" }]}>
          <Ionicons 
            name={departureInfo.shouldLeaveNow ? "warning" : "time-outline"} 
            size={16} 
            color={colors.warning} 
          />
          <Text style={[styles.departureAlertText, { color: colors.textSecondary }]}>
            {departureInfo.shouldLeaveNow 
              ? "Partez immédiatement !" 
              : `Partez dans ${Math.ceil(departureInfo.leaveIn)} min`}
          </Text>
        </View>
      )}
    </View>
  );
};

interface LiveTicketScreenProps {
  ticketId?: string;
}

export const LiveTicketScreen: React.FC<LiveTicketScreenProps> = ({
  ticketId,
}) => {
  const colors = useThemeColors();
  const {
    activeTicket,
    activeTickets,
    position,
    etaMinutes,
    isAlmostThere,
    isCalled,
    cancelTicket,
    hasActiveTicket,
    hasRecalled,
    counterNumber,
    setRecalled,
    markAsCalled,
    clearCalled,
    fetchActiveTicket,
    markEnRoute,
  } = useTicket();

  const { AlertComponent, showError, showSuccess, showWarning } =
    useCustomAlert();

  useFocusEffect(
    useCallback(() => {
      const state = useTicketStore.getState();
      if (state.isCalled && state.activeTicket?.en_route_at) {
        return;
      }
      fetchActiveTicket().catch((err) =>
        console.error("Error fetching ticket:", err),
      );
    }, [fetchActiveTicket]),
  );

  const effectiveTicketId = useMemo(() => {
    const propId = ticketId ? Number(ticketId) : null;
    if (propId && !isNaN(propId)) return propId;
    return activeTicket?.id || null;
  }, [ticketId, activeTicket?.id]);

  // Ticket à afficher : celui identifié par ticketId (peut être secondaire), ou le ticket primaire
  const displayTicket = useMemo(() => {
    if (!effectiveTicketId) return activeTicket;
    return activeTickets.find(t => t.id === effectiveTicketId) ?? activeTicket;
  }, [effectiveTicketId, activeTickets, activeTicket]);

  const displayPosition = displayTicket?.position ?? position;
  const displayEta = displayTicket?.eta_minutes ?? etaMinutes;
  const isDisplayCalled = displayTicket?.status === "called";

  const hasValidCoordinates =
    displayTicket?.establishment &&
    (displayTicket.establishment as any)?.lat !== null &&
    (displayTicket.establishment as any)?.lat !== undefined &&
    (displayTicket.establishment as any)?.lng !== null &&
    (displayTicket.establishment as any)?.lng !== undefined;

  const { distanceInfo, hasPermission: hasLocationPermission } =
    useDistanceTracking({
      targetCoordinates: hasValidCoordinates
        ? {
            latitude: (displayTicket!.establishment as any).lat,
            longitude: (displayTicket!.establishment as any).lng,
          }
        : null,
      enabled: hasValidCoordinates && !!displayTicket,
    });

  const { lastAlert, departureInfo, journeyProgress } = useSmartNotifications({
    enabled: hasActiveTicket,
  });

  const { recordTicketCompleted, recordPresenceConfirmed, recordArrival } =
    useUserStatsStore();

  const [countdownSeconds, setCountdownSeconds] = useState(600);
  const didCancelRef = useRef(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleRecall = useCallback(async () => {
    if (!effectiveTicketId || hasRecalled) return;

    try {
      const response = await axiosClient.post(
        `/tickets/${effectiveTicketId}/request-recall`,
      );
      setRecalled();
      setCountdownSeconds(
        Math.max(0, Math.floor(Number(response.data.countdown_seconds || 600))),
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      showError(
        "Erreur",
        getApiErrorMessage(error, "Impossible d'envoyer le rappel"),
      );
    }
  }, [effectiveTicketId, hasRecalled, setRecalled, showError]);

  const handleEnRoute = useCallback(async () => {
    if (!effectiveTicketId) return;

    try {
      const payload: { estimated_travel_minutes?: number } = {};
      const rawTravel = distanceInfo?.travelTimes?.car;
      if (typeof rawTravel === "number" && Number.isFinite(rawTravel)) {
        payload.estimated_travel_minutes = Math.min(
          60,
          Math.max(1, Math.round(rawTravel)),
        );
      }
      await axiosClient.post(`/tickets/${effectiveTicketId}/en-route`, payload);
      markEnRoute();
      await fetchActiveTicket();
      showSuccess("Confirmation", "L'agent a été notifié");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      showError("Erreur", getApiErrorMessage(error, "Impossible de confirmer"));
    }
  }, [effectiveTicketId, distanceInfo, markEnRoute, fetchActiveTicket, showSuccess, showError]);

  const handleDefer = useCallback(async () => {
    if (!effectiveTicketId) return;

    try {
      const response = await axiosClient.post(
        `/tickets/${effectiveTicketId}/defer`,
      );
      if (response.data.success) {
        showSuccess("Position échangée", "Votre position a été échangée");
        clearCalled();
        await fetchActiveTicket();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        showWarning("Information", response.data.message || "Impossible d'échanger");
      }
    } catch (error: any) {
      showError("Erreur", getApiErrorMessage(error, "Impossible d'échanger"));
    }
  }, [effectiveTicketId, fetchActiveTicket, clearCalled, showError, showSuccess, showWarning]);

  const handleCancelTicket = useCallback(() => {
    showWarning(
      "Quitter la file ?",
      "Vous perdrez votre place dans la file d'attente.",
      "Quitter",
      async () => {
        try {
          didCancelRef.current = true;
          await cancelTicket(effectiveTicketId!);
          router.back();
        } catch (error: any) {
          showError("Erreur", error?.response?.data?.message || "Impossible d'annuler");
        }
      },
      "Annuler",
    );
  }, [effectiveTicketId, cancelTicket, showWarning, showError]);

  const isTicketPresent = displayTicket?.status === "present";
  const isTicketEnRoute = displayTicket?.status === "en_route";
  const isTicketCalledState = isDisplayCalled || (isCalled && displayTicket?.id === activeTicket?.id);

  // Rendu principal
  const renderHeader = () => (
    <LinearGradient
      colors={[colors.primary, colors.secondary]}
      style={styles.header}
    >
      <View style={styles.headerTop}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: "rgba(0,0,0,0.3)" }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        
        {/* Badge LIVE amélioré */}
        <LiveIndicator colors={colors} />
        
        {/* Status Badge amélioré avec fond opaque */}
        <LiveStatusBadge
          status={displayTicket?.status || "waiting"}
          isCalled={isTicketCalledState}
          colors={colors}
        />
      </View>

      <View style={styles.headerMain}>
        <Text style={styles.ticketLabel}>Ticket en cours</Text>
        <Text style={styles.ticketNumberHeader}>
          #{displayTicket?.number || "---"}
        </Text>
      </View>
    </LinearGradient>
  );

  const renderPositionCard = () => {
    // Si le ticket est appelé, présent ou en route, on affiche le statut au lieu de la position
    const isSpecialStatus = isTicketCalledState || isTicketPresent || isTicketEnRoute;
    const displayValue = isSpecialStatus
      ? (isTicketCalledState ? "Appelé" : isTicketPresent ? "Présent" : "En route")
      : `${displayPosition}e`;
    const displayTitle = isSpecialStatus ? "Statut" : "Position dans la file";
    const progress = !isSpecialStatus && displayPosition > 0 ? Math.min(100, (1 / displayPosition) * 100) : 0;
    
    return (
      <View style={[styles.positionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.positionCardHeader}>
          <Text style={[styles.positionCardTitle, { color: colors.textSecondary }]}>
            {displayTitle}
          </Text>
          <View style={[styles.positionNumberBadge, { backgroundColor: isSpecialStatus ? colors.primary + "15" : colors.primary + "15" }]}>
            <Text style={[styles.positionNumberText, { color: isSpecialStatus ? colors.primary : colors.primary }]}>
              {displayValue}
            </Text>
          </View>
        </View>
        
        {!isSpecialStatus && (
          <>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    { width: `${progress}%`, backgroundColor: colors.primary }
                  ]} 
                />
              </View>
            </View>
            
            <View style={styles.positionFooter}>
              <View style={styles.etaInfo}>
                <Ionicons name="time-outline" size={16} color={colors.textTertiary} />
                <Text style={[styles.etaText, { color: colors.textSecondary }]}>
                  {displayEta} min estimées
                </Text>
              </View>
              {displayPosition > 0 && displayPosition <= 3 && (
                <View style={[styles.soonBadge, { backgroundColor: colors.warning + "15" }]}>
                  <Ionicons name="flash" size={12} color={colors.warning} />
                  <Text style={[styles.soonText, { color: colors.warning }]}>
                    Bientôt votre tour
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
        
        {isSpecialStatus && (
          <View style={[styles.specialStatusMessage, { backgroundColor: (isTicketCalledState ? colors.danger : isTicketPresent ? colors.success : colors.warning) + "10" }]}>
            <Text style={[styles.specialStatusMessageText, { color: isTicketCalledState ? colors.danger : isTicketPresent ? colors.success : colors.warning }]}>
              {isTicketCalledState && "🎫 Présentez-vous au guichet"}
              {isTicketPresent && "✅ Priorité conservée"}
              {isTicketEnRoute && "🚶 En attente d'arrivée"}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderActionButtons = () => (
    <View style={styles.actionButtonsContainer}>
      <TouchableOpacity
        style={[styles.navButton, { backgroundColor: colors.primary }]}
        onPress={() => router.push("/navigation" as any)}
        activeOpacity={0.8}
      >
        <Ionicons name="navigate-circle" size={24} color="#FFF" />
        <Text style={styles.navButtonText}>Ouvrir navigation</Text>
      </TouchableOpacity>
      
      <View style={styles.iconButtonsRow}>
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={handleRecall}
        >
          <Ionicons name="repeat" size={22} color={colors.warning} />
          <Text style={[styles.iconButtonLabel, { color: colors.textSecondary }]}>Rappel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={handleDefer}
        >
          <Ionicons name="swap-horizontal" size={22} color={colors.secondary} />
          <Text style={[styles.iconButtonLabel, { color: colors.textSecondary }]}>Échanger</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={handleCancelTicket}
        >
          <Ionicons name="close-circle" size={22} color={colors.danger} />
          <Text style={[styles.iconButtonLabel, { color: colors.danger }]}>Annuler</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCalledOverlay = () => {
    if (!isCalled) return null;

    return (
      <Animated.View 
        style={[
          styles.calledOverlay,
          { opacity: fadeAnim }
        ]}
      >
        <LinearGradient
          colors={[colors.danger, colors.danger + "CC"]}
          style={styles.calledCard}
        >
          <View style={styles.calledIconContainer}>
            <Ionicons name="notifications-circle" size={80} color="#FFF" />
          </View>
          <Text style={styles.calledTitle}>C'est votre tour !</Text>
          <Text style={styles.calledSubtitle}>
            Guichet #{counterNumber || "N/A"}
          </Text>
          <TouchableOpacity
            style={styles.calledButton}
            onPress={handleEnRoute}
          >
            <Text style={styles.calledButtonText}>Je suis en route</Text>
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderHeader()}
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {renderPositionCard()}
          
          {/* Carte Distance avec icônes - uniquement si en attente */}
          {!isTicketCalledState && !isTicketPresent && hasValidCoordinates && distanceInfo && hasLocationPermission ? (
            <DistanceCard 
              distanceInfo={distanceInfo} 
              colors={colors}
              departureInfo={departureInfo}
            />
          ) : (!isTicketCalledState && !isTicketPresent) && (
            <View style={[styles.noLocationCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="location-off-outline" size={32} color={colors.textTertiary} />
              <Text style={[styles.noLocationText, { color: colors.textSecondary }]}>
                Position GPS non disponible
              </Text>
              <Text style={[styles.noLocationSubtext, { color: colors.textTertiary }]}>
                Activez la localisation pour voir les temps de trajet
              </Text>
            </View>
          )}
          
          {renderActionButtons()}
          
          {/* Infos supplémentaires */}
          <View style={styles.compactInfoGrid}>
            <CompactInfoRow
              icon="business-outline"
              label="Établissement"
              value={displayTicket?.establishment?.name || "---"}
              color={colors.primary}
              colors={colors}
            />
            <CompactInfoRow
              icon="briefcase-outline"
              label="Service"
              value={displayTicket?.service?.name || "---"}
              color={colors.success}
              colors={colors}
            />
            <CompactInfoRow
              icon="ribbon-outline"
              label="Priorité"
              value={
                displayTicket?.priority === 'vip' ? '⭐ VIP' :
                displayTicket?.priority === 'high' ? '🔥 Prioritaire' :
                '📋 Normal'
              }
              color={
                displayTicket?.priority === 'vip' ? colors.danger :
                displayTicket?.priority === 'high' ? colors.warning :
                colors.textSecondary
              }
              colors={colors}
            />
            <CompactInfoRow
              icon="calendar-outline"
              label="Créé le"
              value={displayTicket?.created_at ? new Date(displayTicket.created_at).toLocaleTimeString() : "---"}
              color={colors.secondary}
              colors={colors}
            />
          </View>
        </Animated.View>
      </ScrollView>
      
      {renderCalledOverlay()}
      {AlertComponent}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerMain: {
    marginTop: 8,
    alignItems: "center",
  },
  ticketLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 4,
    fontWeight: "500",
  },
  ticketNumberHeader: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1,
    textShadowColor: "rgba(0,0,0,0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // Status Badge amélioré
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderRadius: 20,
    gap: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  // Live Indicator amélioré
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveIndicatorText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  // Position Card
  positionCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  positionCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  positionCardTitle: {
    fontSize: 14,
    fontWeight: "500",
  },
  positionNumberBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  positionNumberText: {
    fontSize: 18,
    fontWeight: "800",
  },
  progressBarContainer: {
    marginBottom: 16,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  positionFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  etaInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  etaText: {
    fontSize: 13,
  },
  soonBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  soonText: {
    fontSize: 11,
    fontWeight: "600",
  },
  specialStatusMessage: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  specialStatusMessageText: {
    fontSize: 13,
    fontWeight: "600",
  },
  // Distance Card
  distanceCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  distanceCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  distanceTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  distanceCardTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  distanceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  distanceBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  travelModesGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
  },
  travelModeItem: {
    alignItems: "center",
    flex: 1,
  },
  travelModeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  travelModeLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  travelModeTime: {
    fontSize: 14,
    fontWeight: "700",
  },
  departureAlert: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  departureAlertText: {
    fontSize: 13,
    flex: 1,
  },
  // No Location
  noLocationCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  noLocationText: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 4,
  },
  noLocationSubtext: {
    fontSize: 12,
    textAlign: "center",
  },
  // Action Buttons
  actionButtonsContainer: {
    marginBottom: 20,
  },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 12,
  },
  navButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  iconButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  iconButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconButtonLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 6,
  },
  // Compact Info Grid
  compactInfoGrid: {
    gap: 12,
    marginTop: 8,
  },
  compactInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  compactInfoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  compactInfoContent: {
    flex: 1,
  },
  compactInfoLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  compactInfoValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  // Called Overlay
  calledOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  calledCard: {
    width: width * 0.85,
    borderRadius: 32,
    padding: 32,
    alignItems: "center",
  },
  calledIconContainer: {
    marginBottom: 20,
  },
  calledTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFF",
    marginBottom: 8,
  },
  calledSubtitle: {
    fontSize: 18,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 24,
  },
  calledButton: {
    backgroundColor: "#FFF",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 28,
    width: "100%",
    alignItems: "center",
  },
  calledButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#EF4444",
  },
});

export default LiveTicketScreen;