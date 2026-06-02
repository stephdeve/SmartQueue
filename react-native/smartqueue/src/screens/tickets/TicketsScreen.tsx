import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  RefreshControl,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTicket } from "../../store/ticketStore";
import type { Ticket } from "../../api/ticketsApi";
import { useCustomAlert } from "../../hooks/useCustomAlert";
import { useThemeColors } from "../../hooks/useThemeColors";

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

const { width } = Dimensions.get("window");

// Composant TicketsScreen
export const TicketsScreen: React.FC = () => {
  const colors = useThemeColors();
  const {
    hasActiveTicket,
    activeTicket,
    activeTickets,
    position,
    etaMinutes,
    isAlmostThere,
    isCalled,
    error,
    fetchActiveTicket,
    cancelTicket,
    isInitialized,
  } = useTicket();
  const { AlertComponent, showWarning, showError } = useCustomAlert();

  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = new Animated.Value(0);

  const otherActiveTickets = React.useMemo(
    () => activeTickets.filter((ticket) => ticket.id !== activeTicket?.id),
    [activeTickets, activeTicket?.id],
  );

  // Debug log
  useEffect(() => {
    console.log("[TicketsScreen] State:", {
      hasActiveTicket,
      isInitialized,
      activeTicketId: activeTicket?.id,
      position,
    });
  }, [hasActiveTicket, isInitialized, activeTicket, position]);

  // Rafraîchir le ticket actif au montage ET à chaque focus de l'écran pour
  // garantir des données à jour même si un événement temps réel a été manqué.
  useFocusEffect(
    useCallback(() => {
      fetchActiveTicket().catch((error) =>
        console.error("Error fetching active ticket on focus:", error),
      );
    }, [fetchActiveTicket]),
  );

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  // Rafraîchir les données
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchActiveTicket();
    } catch (error) {
      console.error("Error refreshing ticket:", error);
    } finally {
      setRefreshing(false);
    }
  };

  // Annuler le ticket actif
  const handleCancelTicket = () => {
    if (!activeTicket) return;

    showWarning(
      "Annuler le ticket",
      "Êtes-vous sûr de vouloir annuler votre ticket ? Vous perdrez votre place dans la file.",
      "Oui, annuler",
      async () => {
        try {
          await cancelTicket(activeTicket.id);
        } catch (error: any) {
          console.error("Error canceling ticket:", error);
          const errorMsg =
            error?.response?.data?.message ||
            error?.message ||
            "Impossible d'annuler le ticket. Veuillez réessayer.";
          showError("Erreur", errorMsg);
        }
      },
      "Non",
    );
  };

  // Navigation vers les différentes fonctionnalités
  const handleScanQR = () => {
    router.push("/(tabs)/scan");
  };

  const handleViewLiveTicket = () => {
    if (!activeTicket) return;
    router.push({
      pathname: "/(tabs)/live-ticket",
      params: { ticketId: String(activeTicket.id) },
    });
  };

  const handleViewHistory = () => {
    router.push("/(tabs)/history");
  };

  const handleNotifications = () => {
    router.push("/notifications");
  };

  const getStatusColor = () => {
    if (isCalled) return ["#EF4444", "#DC2626"];
    if (isAlmostThere) return ["#F59E0B", "#D97706"];
    return ["#3B82F6", "#2563EB"];
  };

  const getStatusText = () => {
    if (isCalled) return "Appelé";
    if (isAlmostThere) return "Bientôt votre tour";
    return "En attente";
  };

  const getStatusIcon = () => {
    if (isCalled) return "notifications";
    if (isAlmostThere) return "walk";
    return "time-outline";
  };

  const getTicketStatusMeta = (ticket: Ticket) => {
    switch (ticket.status) {
      case "called":
        return {
          label: "Appelé",
          icon: "notifications",
          color: colors.danger,
          backgroundColor: colors.danger + "15",
        };
      case "absent":
        return {
          label: "Absent",
          icon: "alert-circle-outline",
          color: colors.warning,
          backgroundColor: colors.warning + "15",
        };
      case "created":
        return {
          label: "Créé",
          icon: "add-circle-outline",
          color: colors.secondary,
          backgroundColor: colors.secondary + "15",
        };
      case "waiting":
      default:
        return {
          label: "En attente",
          icon: "time-outline",
          color: colors.primary,
          backgroundColor: colors.primary + "15",
        };
    }
  };

  const getTicketQueueInfo = (ticket: Ticket) => {
    if (ticket.status === "called") {
      return "Appelé — présentez-vous au guichet";
    }

    if (typeof ticket.position === "number" && ticket.position > 0) {
      return `${ticket.position}${ticket.position === 1 ? "er" : "e"} dans la file`;
    }

    if (typeof ticket.eta_minutes === "number" && ticket.eta_minutes > 0) {
      return `≈ ${ticket.eta_minutes} min d'attente`;
    }

    return "Estimation indisponible";
  };

  const isPrimaryCalled = activeTicket?.status === "called";

  const renderPrimaryQueueState = () => {
    if (isPrimaryCalled) {
      return {
        value: "Appelé",
        suffix: "",
        label: "statut du ticket",
        helperText: "Présentez-vous maintenant au guichet",
      };
    }

    return {
      value: String(position),
      suffix: position === 1 ? "er" : "ème",
      label: "position dans la file",
      helperText:
        position <= 3
          ? position === 1
            ? "C'est bientôt votre tour !"
            : "Approchez-vous du guichet"
          : null,
    };
  };

  // Rendu du ticket actif
  const renderActiveTicket = () => {
    if (!hasActiveTicket) {
      return (
        <Animated.View style={[styles.noTicketCard, { opacity: fadeAnim }]}>
          <View style={styles.noTicketContent}>
            <View
              style={[
                styles.noTicketIconContainer,
                { backgroundColor: colors.primary + "20" },
              ]}
            >
              <Ionicons
                name="ticket-outline"
                size={48}
                color={colors.primary}
              />
            </View>
            <Text style={[styles.noTicketTitle, { color: colors.textPrimary }]}>
              Aucun ticket actif
            </Text>
            <Text
              style={[styles.noTicketSubtitle, { color: colors.textSecondary }]}
            >
              Scannez un QR code ou rejoignez une file pour obtenir un ticket
            </Text>
            <TouchableOpacity style={styles.scanButton} onPress={handleScanQR}>
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                style={styles.scanButtonGradient}
              >
                <Ionicons name="qr-code-outline" size={20} color="#FFFFFF" />
                <Text style={styles.scanButtonText}>Scanner un QR code</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      );
    }

    const queueState = renderPrimaryQueueState();

    return (
      <Animated.View
        style={[
          styles.activeTicketCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
          },
        ]}
      >
        {/* Status Banner - Modern Design */}
        <LinearGradient
          colors={getStatusColor() as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.statusBanner}
        >
          <View
            style={[styles.statusIconContainer, isCalled && styles.pulseIcon]}
          >
            <Ionicons name={getStatusIcon()} size={18} color="#FFFFFF" />
          </View>
          <Text style={styles.statusText}>{getStatusText()}</Text>
          {isCalled && (
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </LinearGradient>

        <View style={styles.ticketContent}>
          {/* Position - Modern Badge Design */}
          <View style={styles.positionSection}>
            <View
              style={[
                styles.positionBadge,
                {
                  backgroundColor: isPrimaryCalled
                    ? colors.danger + "15"
                    : colors.primary + "15",
                },
              ]}
            >
              <Text
                style={[
                  styles.positionNumber,
                  styles.positionNumberAdaptive,
                  { color: isPrimaryCalled ? colors.danger : colors.primary },
                ]}
              >
                {queueState.value}
              </Text>
              {!!queueState.suffix && (
                <Text
                  style={[
                    styles.positionSuffix,
                    { color: isPrimaryCalled ? colors.danger : colors.primary },
                  ]}
                >
                  {queueState.suffix}
                </Text>
              )}
            </View>
            <Text
              style={[styles.positionLabel, { color: colors.textTertiary }]}
            >
              {queueState.label}
            </Text>
            {!!queueState.helperText && (
              <View
                style={[
                  styles.urgentBadge,
                  {
                    backgroundColor: isPrimaryCalled
                      ? colors.danger + "15"
                      : colors.warning + "20",
                  },
                ]}
              >
                <Ionicons
                  name={isPrimaryCalled ? "notifications" : "flash"}
                  size={12}
                  color={isPrimaryCalled ? colors.danger : colors.warning}
                />
                <Text
                  style={[
                    styles.urgentText,
                    { color: isPrimaryCalled ? colors.danger : colors.warning },
                  ]}
                >
                  {queueState.helperText}
                </Text>
              </View>
            )}
          </View>

          {/* Ticket Info */}
          <View style={styles.ticketInfo}>
            <View style={styles.infoItem}>
              <View
                style={[
                  styles.infoIconContainer,
                  { backgroundColor: colors.primary + "20" },
                ]}
              >
                <Ionicons
                  name="pricetag-outline"
                  size={18}
                  color={colors.primary}
                />
              </View>
              <View>
                <Text
                  style={[styles.infoLabel, { color: colors.textTertiary }]}
                >
                  Numéro
                </Text>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                  {activeTicket?.number}
                </Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <View
                style={[
                  styles.infoIconContainer,
                  { backgroundColor: colors.success + "20" },
                ]}
              >
                <Ionicons
                  name="briefcase-outline"
                  size={18}
                  color={colors.success}
                />
              </View>
              <View>
                <Text
                  style={[styles.infoLabel, { color: colors.textTertiary }]}
                >
                  Service
                </Text>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                  {activeTicket?.service?.name || "Service"}
                </Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <View
                style={[
                  styles.infoIconContainer,
                  { backgroundColor: colors.warning + "20" },
                ]}
              >
                <Ionicons
                  name="business-outline"
                  size={18}
                  color={colors.warning}
                />
              </View>
              <View>
                <Text
                  style={[styles.infoLabel, { color: colors.textTertiary }]}
                >
                  Établissement
                </Text>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                  {activeTicket?.establishment?.name || "Établissement"}
                </Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <View
                style={[
                  styles.infoIconContainer,
                  { backgroundColor: colors.secondary + "20" },
                ]}
              >
                <Ionicons
                  name="time-outline"
                  size={18}
                  color={colors.secondary}
                />
              </View>
              <View>
                <Text
                  style={[styles.infoLabel, { color: colors.textTertiary }]}
                >
                  Temps estimé
                </Text>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                  {etaMinutes} min
                </Text>
              </View>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.ticketActions}>
            <TouchableOpacity
              style={styles.primaryAction}
              onPress={handleViewLiveTicket}
            >
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                style={styles.primaryActionGradient}
              >
                <Ionicons name="eye-outline" size={20} color="#FFFFFF" />
                <Text style={styles.primaryActionText}>Voir en direct</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.dangerAction,
                { backgroundColor: colors.danger + "15" },
              ]}
              onPress={handleCancelTicket}
            >
              <View style={styles.dangerActionContent}>
                <Ionicons
                  name="close-outline"
                  size={20}
                  color={colors.danger}
                />
                <Text
                  style={[styles.dangerActionText, { color: colors.danger }]}
                >
                  Annuler le ticket
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    );
  };

  const renderOtherActiveTickets = () => {
    if (!hasActiveTicket || otherActiveTickets.length === 0) return null;

    return (
      <View style={styles.otherTicketsSection}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Autres tickets actifs
          </Text>
          <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>
            {otherActiveTickets.length}
          </Text>
        </View>

        {otherActiveTickets.map((ticket) => {
          const statusMeta = getTicketStatusMeta(ticket);

          return (
            <View
              key={ticket.id}
              style={[
                styles.otherTicketCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                },
              ]}
            >
              <View style={styles.otherTicketTopRow}>
                <View style={styles.otherTicketIdentity}>
                  <Text
                    style={[
                      styles.otherTicketNumber,
                      { color: colors.textPrimary },
                    ]}
                  >
                    {ticket.number}
                  </Text>
                  <Text
                    style={[
                      styles.otherTicketService,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {ticket.service?.name || "Service"}
                  </Text>
                </View>

                <View
                  style={[
                    styles.otherTicketStatusBadge,
                    { backgroundColor: statusMeta.backgroundColor },
                  ]}
                >
                  <Ionicons
                    name={statusMeta.icon as any}
                    size={14}
                    color={statusMeta.color}
                  />
                  <Text
                    style={[
                      styles.otherTicketStatusText,
                      { color: statusMeta.color },
                    ]}
                  >
                    {statusMeta.label}
                  </Text>
                </View>
              </View>

              <View style={styles.otherTicketMetaRow}>
                <View style={styles.otherTicketMetaItem}>
                  <Ionicons
                    name="business-outline"
                    size={16}
                    color={colors.textTertiary}
                  />
                  <Text
                    style={[
                      styles.otherTicketMetaText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {ticket.establishment?.name || "Établissement"}
                  </Text>
                </View>

                <View style={styles.otherTicketMetaItem}>
                  <Ionicons
                    name="git-compare-outline"
                    size={16}
                    color={colors.textTertiary}
                  />
                  <Text
                    style={[
                      styles.otherTicketMetaText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {getTicketQueueInfo(ticket)}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  // Rendu des actions rapides
  const renderQuickActions = () => {
    const actions = [
      {
        id: "scan",
        title: "Scanner",
        icon: "qr-code-outline",
        color: colors.primary,
        onPress: handleScanQR,
      },
      {
        id: "history",
        title: "Historique",
        icon: "time-outline",
        color: colors.success,
        onPress: handleViewHistory,
      },
      {
        id: "map",
        title: "Carte",
        icon: "map-outline",
        color: colors.warning,
        onPress: () => router.push("/(tabs)"),
      },
    ];

    return (
      <View style={styles.quickActionsSection}>
        <Text style={styles.sectionTitle}>Actions rapides</Text>
        <View style={styles.quickActionsGrid}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={[
                styles.quickActionCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                },
              ]}
              onPress={action.onPress}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.quickActionIcon,
                  { backgroundColor: action.color + "15" },
                ]}
              >
                <Ionicons
                  name={action.icon as any}
                  size={24}
                  color={action.color}
                />
              </View>
              <Text
                style={[styles.quickActionTitle, { color: colors.textPrimary }]}
              >
                {action.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  // Rendu des statistiques
  const renderStats = () => {
    if (!hasActiveTicket) return null;

    return (
      <View style={styles.statsSection}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          Statistiques
        </Text>
        <View style={styles.statsGrid}>
          <View
            style={[
              styles.statCard,
              {
                backgroundColor: colors.primary + "15",
                borderColor: colors.border,
                borderWidth: 1,
              },
            ]}
          >
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {position}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Position
            </Text>
          </View>
          <View
            style={[
              styles.statCard,
              {
                backgroundColor: colors.warning + "15",
                borderColor: colors.border,
                borderWidth: 1,
              },
            ]}
          >
            <Text style={[styles.statValue, { color: colors.warning }]}>
              {etaMinutes}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Minutes
            </Text>
          </View>
          <View
            style={[
              styles.statCard,
              {
                backgroundColor: colors.success + "15",
                borderColor: colors.border,
                borderWidth: 1,
              },
            ]}
          >
            <Text style={[styles.statValue, { color: colors.success }]}>
              {Math.max(0, position - 1)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Avant vous
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Gradient Header */}
      <LinearGradient
        colors={
          colors.dark?.background
            ? ["#1E3A5F", "#2563EB", "#3B82F6"]
            : ["#3B82F6", "#2563EB", "#1D4ED8"]
        }
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={[styles.headerTitle, { color: "#FFFFFF" }]}>
              Ma File
            </Text>
            <Text style={styles.headerSubtitle}>Gérez vos tickets</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.notificationButton,
              { backgroundColor: "rgba(255,255,255,0.2)" },
            ]}
            onPress={handleNotifications}
          >
            <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
            {hasActiveTicket && (
              <View
                style={[
                  styles.notificationBadge,
                  { backgroundColor: colors.danger },
                ]}
              >
                <Text
                  style={[styles.notificationBadgeText, { color: "#FFFFFF" }]}
                >
                  1
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons
              name="alert-circle-outline"
              size={64}
              color={colors.danger}
            />
            <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>
              Oups ! Une erreur est survenue
            </Text>
            <Text
              style={[styles.errorSubtitle, { color: colors.textSecondary }]}
            >
              {error.includes("401")
                ? "Votre session a expiré. Veuillez vous reconnecter."
                : error}
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={handleRefresh}
            >
              <Text style={[styles.retryButtonText, { color: "#FFFFFF" }]}>
                Réessayer
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {renderActiveTicket()}
            {renderOtherActiveTickets()}
            {renderStats()}
            {renderQuickActions()}
          </>
        )}
        {AlertComponent}
        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    paddingTop: 50,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 4,
  },
  notificationButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 30,
  },
  // No Ticket Card
  noTicketCard: {
    borderRadius: 24,
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  noTicketContent: {
    alignItems: "center",
    padding: 32,
  },
  noTicketIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  noTicketTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  noTicketSubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  scanButton: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  scanButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 32,
    gap: 8,
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  // Active Ticket Card
  activeTicketCard: {
    borderRadius: 24,
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    overflow: "hidden",
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 10,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  statusIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  pulseIcon: {
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.15)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 6,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
  liveText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  ticketContent: {
    padding: 24,
  },
  positionSection: {
    alignItems: "center",
    marginBottom: 24,
    paddingTop: 8,
  },
  positionBadge: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 24,
    marginBottom: 12,
  },
  positionNumber: {
    fontSize: 56,
    fontWeight: "800",
    lineHeight: 56,
  },
  positionNumberAdaptive: {
    fontSize: 42,
    lineHeight: 46,
  },
  positionSuffix: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 8,
    marginLeft: 2,
  },
  positionLabel: {
    fontSize: 14,
    fontWeight: "500",
    textTransform: "lowercase",
    letterSpacing: 0.5,
  },
  urgentBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  urgentText: {
    fontSize: 12,
    fontWeight: "600",
  },
  ticketInfo: {
    gap: 16,
    marginBottom: 24,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "600",
  },
  ticketActions: {
    gap: 12,
  },
  primaryAction: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  primaryActionGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  primaryActionText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  dangerAction: {
    borderRadius: 16,
    paddingVertical: 16,
  },
  dangerActionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  dangerActionText: {
    fontSize: 16,
    fontWeight: "700",
  },
  // Stats Section
  otherTicketsSection: {
    marginTop: 24,
  },
  otherTicketCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  otherTicketTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 12,
  },
  otherTicketIdentity: {
    flex: 1,
  },
  otherTicketNumber: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  otherTicketService: {
    fontSize: 14,
    fontWeight: "600",
  },
  otherTicketStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  otherTicketStatusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  otherTicketMetaRow: {
    gap: 10,
  },
  otherTicketMetaItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  otherTicketMetaText: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  statsSection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: "700",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  // Quick Actions
  quickActionsSection: {
    marginTop: 20,
    marginBottom: 100,
  },
  quickActionsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  quickActionTitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  // Error
  errorContainer: {
    alignItems: "center",
    padding: 40,
    marginTop: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  errorSubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
  },
  retryButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  bottomSpace: {
    height: 40,
  },
});

export default TicketsScreen;
