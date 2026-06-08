import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  RefreshControl,
  Dimensions,
  Platform,
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

// Composant de statut compact
const StatusBadge: React.FC<{ status: string; colors: any }> = ({ status, colors }) => {
  const getStatusConfig = () => {
    switch (status) {
      case "present":
        return { label: "Présent", icon: "checkmark-circle", color: colors.success };
      case "en_route":
        return { label: "En route", icon: "walk", color: colors.warning };
      case "called":
        return { label: "Appelé", icon: "notifications", color: colors.danger };
      default:
        return { label: "En attente", icon: "time", color: colors.primary };
    }
  };

  const config = getStatusConfig();

  return (
    <View style={[styles.statusBadge, { backgroundColor: config.color + "15" }]}>
      <Ionicons name={config.icon as any} size={14} color={config.color} />
      <Text style={[styles.statusBadgeText, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
};

// Carte de progression
const ProgressCard: React.FC<{
  position: number;
  etaMinutes: number;
  colors: any;
}> = ({ position, etaMinutes, colors }) => {
  const progress = position > 0 ? Math.min(100, (1 / position) * 100) : 0;

  return (
    <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.progressHeader}>
        <View style={styles.progressInfo}>
          <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
            Votre position
          </Text>
          <Text style={[styles.progressValue, { color: colors.primary }]}>
            {position > 0 ? `${position}e` : "—"}
          </Text>
        </View>
        <View style={styles.progressInfo}>
          <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
            Temps estimé
          </Text>
          <Text style={[styles.progressValue, { color: colors.warning }]}>
            {etaMinutes > 0 ? `${etaMinutes} min` : "—"}
          </Text>
        </View>
      </View>
      
      <View style={styles.progressBarContainer}>
        <View 
          style={[
            styles.progressBar, 
            { 
              width: `${progress}%`,
              backgroundColor: colors.primary 
            }
          ]} 
        />
      </View>
      
      <Text style={[styles.progressHint, { color: colors.textTertiary }]}>
        {position > 0 && position <= 3 
          ? "🎯 C'est bientôt votre tour ! Restez à proximité" 
          : position > 0 ? "⏱️ Vous serez notifié quand votre tour approche" : "Statut en attente de mise à jour"}
      </Text>
    </View>
  );
};

// Carte de ticket verticale
const TicketCard: React.FC<{
  ticket: Ticket;
  colors: any;
  onPress?: () => void;
}> = ({ ticket, colors, onPress }) => {
  const getQueueInfo = () => {
    if (ticket.status === "called") return "Présentez-vous";
    if (ticket.status === "present") return "Présent";
    if (ticket.status === "en_route") return "En route";
    if (ticket.position && ticket.position > 0) return `${ticket.position}e place`;
    return "En traitement";
  };

  return (
    <TouchableOpacity 
      style={[styles.ticketCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.ticketCardLeft}>
        <View style={[styles.ticketNumberBadge, { backgroundColor: colors.primary + "20" }]}>
          <Text style={[styles.ticketNumber, { color: colors.primary }]}>
            #{ticket.number}
          </Text>
        </View>
        <View style={styles.ticketDetails}>
          <Text style={[styles.ticketService, { color: colors.textPrimary }]}>
            {ticket.service?.name || "Service"}
          </Text>
          <Text style={[styles.ticketQueueInfo, { color: colors.textTertiary }]}>
            {getQueueInfo()}
          </Text>
        </View>
      </View>
      <StatusBadge status={ticket.status} colors={colors} />
    </TouchableOpacity>
  );
};

// Action rapide circulaire
const QuickActionCircle: React.FC<{
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
}> = ({ icon, label, color, onPress }) => (
  <TouchableOpacity style={styles.quickActionCircle} onPress={onPress} activeOpacity={0.8}>
    <LinearGradient
      colors={[color, color + "CC"]}
      style={styles.quickActionCircleGradient}
    >
      <Ionicons name={icon as any} size={28} color="#FFFFFF" />
    </LinearGradient>
    <Text style={[styles.quickActionCircleLabel, { color }]}>{label}</Text>
  </TouchableOpacity>
);

// Composant principal
export const TicketsScreen: React.FC = () => {
  const colors = useThemeColors();
  const {
    hasActiveTicket,
    activeTicket,
    activeTickets,
    position,
    etaMinutes,
    isCalled,
    error,
    fetchActiveTicket,
    cancelTicket,
  } = useTicket();
  const { AlertComponent, showWarning, showError } = useCustomAlert();

  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  const otherActiveTickets = useMemo(
    () => activeTickets.filter((ticket) => ticket.id !== activeTicket?.id),
    [activeTickets, activeTicket?.id],
  );

  useFocusEffect(
    useCallback(() => {
      fetchActiveTicket().catch(console.error);
    }, [fetchActiveTicket]),
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchActiveTicket();
    } finally {
      setRefreshing(false);
    }
  }, [fetchActiveTicket]);

  const handleCancelTicket = useCallback(() => {
    if (!activeTicket) return;

    showWarning(
      "Annuler le ticket",
      "Vous perdrez votre place dans la file",
      "Annuler",
      async () => {
        try {
          await cancelTicket(activeTicket.id);
        } catch (error: any) {
          showError("Erreur", error?.message || "Impossible d'annuler");
        }
      },
      "Retour",
    );
  }, [activeTicket, cancelTicket, showWarning, showError]);

  // Navigation
  const handleScanQR = useCallback(() => router.push("/(tabs)/scan"), []);
  const handleViewLiveTicket = useCallback(() => {
    if (!activeTicket) return;
    router.push({
      pathname: "/(tabs)/live-ticket",
      params: { ticketId: String(activeTicket.id) },
    });
  }, [activeTicket]);
  const handleViewHistory = useCallback(() => router.push("/(tabs)/history"), []);
  const handleNotifications = useCallback(() => router.push("/notifications"), []);

  // Rendu principal
  const renderHeader = () => (
    <LinearGradient
      colors={["#3B82F6", "#2563EB"]}
      style={styles.header}
    >
      <View style={styles.headerTop}>
        <View>
          <Text style={styles.welcomeText}>Soyez les bienvenus</Text>
          <Text style={styles.headerTitle}>Ma File d'attente</Text>
        </View>
        <TouchableOpacity 
          style={[styles.notificationIcon, { backgroundColor: "rgba(255,255,255,0.2)" }]}
          onPress={handleNotifications}
        >
          <Ionicons name="notifications-outline" size={24} color="#FFF" />
          {hasActiveTicket && <View style={styles.notificationDot} />}
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );

  const renderEmptyState = () => (
    <Animated.View 
      style={[
        styles.emptyContainer,
        { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
      ]}
    >
      <View style={[styles.emptyIconContainer, { backgroundColor: colors.primary + "15" }]}>
        <Ionicons name="ticket-outline" size={64} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
        Aucun ticket actif
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Scannez un QR code pour rejoindre une file
      </Text>
      <TouchableOpacity style={styles.scanButton} onPress={handleScanQR}>
        <LinearGradient
          colors={[colors.primary, colors.secondary]}
          style={styles.scanButtonGradient}
        >
          <Ionicons name="qr-code-outline" size={20} color="#FFF" />
          <Text style={styles.scanButtonText}>Scanner un QR code</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderActiveTicket = () => {
    // Déterminer si on affiche la position ou le statut
    const isSpecialStatus = activeTicket?.status === "called" || 
                           activeTicket?.status === "present" || 
                           activeTicket?.status === "en_route";
    
    const displayValue = isSpecialStatus ? null : position;
    const displayLabel = isSpecialStatus ? "Statut" : "Position dans la file";
    const displayText = isSpecialStatus 
      ? (activeTicket?.status === "called" ? "Appelé" :
         activeTicket?.status === "present" ? "Présent" :
         activeTicket?.status === "en_route" ? "En route" : "")
      : `${position}e`;

    return (
      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
        {/* Ticket principal compact */}
        <View style={[styles.mainTicketCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.ticketHeader}>
            <View style={styles.ticketHeaderLeft}>
              <Text style={[styles.ticketLabel, { color: colors.textTertiary }]}>
                Votre ticket
              </Text>
              <Text style={[styles.ticketNumber, { color: colors.primary }]}>
                {activeTicket?.number}
              </Text>
            </View>
            <StatusBadge status={activeTicket?.status || "waiting"} colors={colors} />
          </View>

          {/* Position ou Statut */}
          <View style={styles.positionContainer}>
            <View style={[styles.positionBadge, { backgroundColor: isSpecialStatus ? colors.primary + "15" : colors.primary + "15" }]}>
              <Text style={[styles.positionValue, { color: isSpecialStatus ? colors.primary : colors.primary }]}>
                {displayText}
              </Text>
            </View>
            <Text style={[styles.positionLabel, { color: colors.textTertiary }]}>
              {displayLabel}
            </Text>
          </View>

          <View style={styles.ticketDivider} />

          <View style={styles.ticketBody}>
            <View style={styles.ticketInfoRow}>
              <Ionicons name="business-outline" size={18} color={colors.textTertiary} />
              <Text style={[styles.ticketInfoText, { color: colors.textSecondary }]}>
                {activeTicket?.establishment?.name || "Établissement"}
              </Text>
            </View>
            <View style={styles.ticketInfoRow}>
              <Ionicons name="briefcase-outline" size={18} color={colors.textTertiary} />
              <Text style={[styles.ticketInfoText, { color: colors.textSecondary }]}>
                {activeTicket?.service?.name || "Service"}
              </Text>
            </View>
          </View>

          <View style={styles.ticketActions}>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: colors.primary + "10" }]}
              onPress={handleViewLiveTicket}
            >
              <Ionicons name="eye-outline" size={20} color={colors.primary} />
              <Text style={[styles.actionButtonText, { color: colors.primary }]}>
                Suivre
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: colors.danger + "10" }]}
              onPress={handleCancelTicket}
            >
              <Ionicons name="close-outline" size={20} color={colors.danger} />
              <Text style={[styles.actionButtonText, { color: colors.danger }]}>
                Annuler
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Progression - seulement si en attente */}
        {activeTicket?.status === "waiting" && (
          <ProgressCard position={position} etaMinutes={etaMinutes} colors={colors} />
        )}
        
        {/* Message pour les statuts spéciaux */}
        {activeTicket?.status === "called" && (
          <View style={[styles.specialStatusCard, { backgroundColor: colors.danger + "10", borderColor: colors.danger }]}>
            <Ionicons name="notifications" size={24} color={colors.danger} />
            <Text style={[styles.specialStatusText, { color: colors.danger }]}>
              Vous êtes appelé au guichet !
            </Text>
            <Text style={[styles.specialStatusSubtext, { color: colors.textSecondary }]}>
              Présentez-vous immédiatement
            </Text>
          </View>
        )}
        
        {activeTicket?.status === "present" && (
          <View style={[styles.specialStatusCard, { backgroundColor: colors.success + "10", borderColor: colors.success }]}>
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
            <Text style={[styles.specialStatusText, { color: colors.success }]}>
              Vous êtes présent
            </Text>
            <Text style={[styles.specialStatusSubtext, { color: colors.textSecondary }]}>
              Un agent va bientôt vous prendre en charge
            </Text>
          </View>
        )}
        
        {activeTicket?.status === "en_route" && (
          <View style={[styles.specialStatusCard, { backgroundColor: colors.warning + "10", borderColor: colors.warning }]}>
            <Ionicons name="walk" size={24} color={colors.warning} />
            <Text style={[styles.specialStatusText, { color: colors.warning }]}>
              Vous êtes en route
            </Text>
            <Text style={[styles.specialStatusSubtext, { color: colors.textSecondary }]}>
              L'agent a été notifié de votre arrivée
            </Text>
          </View>
        )}
      </Animated.View>
    );
  };

  const renderOtherTickets = () => {
    if (!hasActiveTicket || otherActiveTickets.length === 0) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Autres tickets
          </Text>
          <Text style={[styles.sectionBadge, { backgroundColor: colors.primary + "15", color: colors.primary }]}>
            {otherActiveTickets.length}
          </Text>
        </View>
        {otherActiveTickets.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} colors={colors} onPress={() => handleViewLiveTicket()} />
        ))}
      </View>
    );
  };

  const renderQuickActions = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
        Actions rapides
      </Text>
      <View style={styles.quickActionsGrid}>
        <QuickActionCircle
          icon="qr-code-outline"
          label="Scanner"
          color={colors.primary}
          onPress={handleScanQR}
        />
        <QuickActionCircle
          icon="time-outline"
          label="Historique"
          color={colors.success}
          onPress={handleViewHistory}
        />
        <QuickActionCircle
          icon="map-outline"
          label="Carte"
          color={colors.warning}
          onPress={() => router.push("/navigation" as any)}
        />
        <QuickActionCircle
          icon="call-outline"
          label="Support"
          color={colors.secondary}
          onPress={() => {/* Support logic */}}
        />
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderHeader()}
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={64} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.textPrimary }]}>
              Une erreur est survenue
            </Text>
            <TouchableOpacity 
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={handleRefresh}
            >
              <Text style={styles.retryButtonText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {hasActiveTicket ? renderActiveTicket() : renderEmptyState()}
            {renderOtherTickets()}
            {renderQuickActions()}
          </>
        )}
        {AlertComponent}
        <View style={styles.bottomSpace} />
      </ScrollView>

      {/* Bouton flottant pour scanner si aucun ticket */}
      {!hasActiveTicket && !error && (
        <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={handleScanQR}>
          <Ionicons name="qr-code" size={28} color="#FFF" />
        </TouchableOpacity>
      )}
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
  },
  welcomeText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 30,
  },
  // Empty state
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 32,
    paddingHorizontal: 40,
  },
  scanButton: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  scanButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 28,
    gap: 8,
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  // Main ticket card
  mainTicketCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  ticketHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  ticketHeaderLeft: {
    flex: 1,
  },
  ticketLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  ticketNumber: {
    fontSize: 28,
    fontWeight: "800",
  },
  positionContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  positionBadge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 8,
  },
  positionValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  positionLabel: {
    fontSize: 12,
  },
  ticketDivider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.05)",
    marginVertical: 16,
  },
  ticketBody: {
    gap: 12,
    marginBottom: 20,
  },
  ticketInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ticketInfoText: {
    fontSize: 14,
    flex: 1,
  },
  ticketActions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  // Progress card
  progressCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 24,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  progressInfo: {
    alignItems: "center",
  },
  progressLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  progressValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 12,
  },
  progressBar: {
    height: "100%",
    borderRadius: 4,
  },
  progressHint: {
    fontSize: 12,
    textAlign: "center",
  },
  // Section
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  sectionBadge: {
    fontSize: 14,
    fontWeight: "600",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: "hidden",
  },
  // Ticket card for other tickets
  ticketCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  ticketCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  ticketNumberBadge: {
    width: 60,
    height: 60,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  ticketNumber: {
    fontSize: 20,
    fontWeight: "700",
  },
  ticketDetails: {
    flex: 1,
  },
  ticketService: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  ticketQueueInfo: {
    fontSize: 12,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  // Quick actions
  quickActionsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop:12,
  },
  quickActionCircle: {
    flex: 1,
    alignItems: "center",
  },
  quickActionCircleGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  quickActionCircleLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  // Error
  errorContainer: {
    alignItems: "center",
    paddingVertical: 60,
  },
  errorText: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  // FAB
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  bottomSpace: {
    height: 20,
  },
  // Special status card
  specialStatusCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    marginBottom: 24,
  },
  specialStatusText: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 4,
  },
  specialStatusSubtext: {
    fontSize: 13,
    textAlign: "center",
  },
});

export default TicketsScreen;