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
      <Ionicons name={config.icon as any} size={12} color={config.color} />
      <Text style={[styles.statusBadgeText, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
};

// Carte de progression compacte
const ProgressCard: React.FC<{
  position: number;
  etaMinutes: number;
  colors: any;
}> = ({ position, etaMinutes, colors }) => {
  const progress = position > 0 ? Math.min(100, (1 / position) * 100) : 0;
  const isSoon = position <= 3 && position > 0;

  return (
    <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.progressStats}>
        <View style={styles.progressStat}>
          <Text style={[styles.progressStatLabel, { color: colors.textTertiary }]}>Position</Text>
          <Text style={[styles.progressStatValue, { color: isSoon ? colors.warning : colors.primary }]}>
            {position > 0 ? `${position}e` : "—"}
          </Text>
        </View>
        <View style={styles.progressStat}>
          <Text style={[styles.progressStatLabel, { color: colors.textTertiary }]}>Estimation</Text>
          <Text style={[styles.progressStatValue, { color: colors.primary }]}>
            {etaMinutes > 0 ? `${etaMinutes} min` : "—"}
          </Text>
        </View>
      </View>
      <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
        <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: isSoon ? colors.warning : colors.primary }]} />
      </View>
      {isSoon && <Text style={[styles.progressSoon, { color: colors.warning }]}>⚡ Bientôt votre tour !</Text>}
    </View>
  );
};

// Carte de ticket secondaire compacte - CORRIGÉE
const TicketCard: React.FC<{
  ticket: Ticket;
  colors: any;
  onPress?: () => void;
}> = ({ ticket, colors, onPress }) => {
  const getQueueInfo = () => {
    if (ticket.status === "called") return "Appelé";
    if (ticket.status === "present") return "Présent";
    if (ticket.status === "en_route") return "En route";
    if (ticket.position && ticket.position > 0) return `${ticket.position}e place`;
    return "En attente";
  };

  return (
    <TouchableOpacity 
      style={[styles.ticketCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.ticketCardLeft}>
        <View style={[styles.ticketNumberBadge, { backgroundColor: colors.primary + "15" }]}>
          <Text style={[styles.ticketNumber, { color: colors.primary }]} numberOfLines={1}>
            {ticket.number}
          </Text>
        </View>
        <View style={styles.ticketDetails}>
          <Text style={[styles.ticketService, { color: colors.textPrimary }]} numberOfLines={1}>
            {ticket.service?.name || "Service"}
          </Text>
          <Text style={[styles.ticketQueueInfo, { color: colors.textTertiary }]} numberOfLines={1}>
            {getQueueInfo()}
          </Text>
        </View>
      </View>
      <StatusBadge status={ticket.status} colors={colors} />
    </TouchableOpacity>
  );
};

// Action rapide compacte
const QuickActionCircle: React.FC<{
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
}> = ({ icon, label, color, onPress }) => (
  <TouchableOpacity style={styles.quickActionCircle} onPress={onPress} activeOpacity={0.8}>
    <View style={[styles.quickActionCircleIcon, { backgroundColor: color + "15" }]}>
      <Ionicons name={icon as any} size={24} color={color} />
    </View>
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
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await fetchActiveTicket(); } finally { setRefreshing(false); }
  }, [fetchActiveTicket]);

  const handleCancelTicket = useCallback(() => {
    if (!activeTicket) return;
    showWarning("Annuler le ticket", "Vous perdrez votre place dans la file", "Annuler", async () => {
      try { await cancelTicket(activeTicket.id); } 
      catch (error: any) { showError("Erreur", error?.message || "Impossible d'annuler"); }
    }, "Retour");
  }, [activeTicket, cancelTicket, showWarning, showError]);

  const handleScanQR = useCallback(() => router.push("/(tabs)/scan"), []);
  const handleViewLiveTicket = useCallback(() => {
    if (!activeTicket) return;
    router.push({ pathname: "/(tabs)/live-ticket", params: { ticketId: String(activeTicket.id) } });
  }, [activeTicket]);
  const handleViewHistory = useCallback(() => router.push("/(tabs)/history"), []);
  const handleNotifications = useCallback(() => router.push("/notifications"), []);

  const renderHeader = () => (
    <LinearGradient colors={["#3B82F6", "#2563EB"]} style={styles.header}>
      <View style={styles.headerTop}>
        <View>
          <Text style={styles.welcomeText}>👋 Apercu de votre </Text>
          <Text style={styles.headerTitle}>File d'attente</Text>
        </View>
        <TouchableOpacity style={[styles.notificationIcon, { backgroundColor: "rgba(255,255,255,0.2)" }]} onPress={handleNotifications}>
          <Ionicons name="notifications-outline" size={22} color="#FFF" />
          {hasActiveTicket && <View style={styles.notificationDot} />}
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );

  const renderEmptyState = () => (
    <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
      <View style={[styles.emptyIconContainer, { backgroundColor: colors.primary + "15" }]}>
        <Ionicons name="ticket-outline" size={56} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Aucun ticket actif</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>Scannez un QR code pour rejoindre une file</Text>
      <TouchableOpacity style={styles.scanButton} onPress={handleScanQR}>
        <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.scanButtonGradient}>
          <Ionicons name="qr-code-outline" size={18} color="#FFF" />
          <Text style={styles.scanButtonText}>Scanner</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderActiveTicket = () => {
    // Déterminer si on affiche la position ou le statut
    const isSpecialStatus = activeTicket?.status === "called" || activeTicket?.status === "present" || activeTicket?.status === "en_route";
    const queueLength = (activeTicket as any)?.queue_length || position || 1;
    
    const displayText = isSpecialStatus 
      ? (activeTicket?.status === "called" ? "Appelé" : activeTicket?.status === "present" ? "Présent" : "En route")
      : `${position}e / ${queueLength}`;
    const displayLabel = isSpecialStatus ? "Statut" : "Position";

    return (
      <Animated.View style={{ opacity: fadeAnim }}>
        <View style={[styles.mainTicketCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.ticketHeader}>
            <View>
              <Text style={[styles.ticketLabel, { color: colors.textTertiary }]}>Votre ticket</Text>
              <Text style={[styles.ticketNumber, { color: colors.primary }]}>{activeTicket?.number}</Text>
            </View>
            <StatusBadge status={activeTicket?.status || "waiting"} colors={colors} />
          </View>

          <View style={styles.ticketInfoCompact}>
            <View style={styles.ticketInfoItem}>
              <Ionicons name="business-outline" size={14} color={colors.textTertiary} />
              <Text style={[styles.ticketInfoText, { color: colors.textSecondary }]} numberOfLines={1}>
                {activeTicket?.establishment?.name || "Établissement"}
              </Text>
            </View>
            <View style={styles.ticketInfoItem}>
              <Ionicons name="briefcase-outline" size={14} color={colors.textTertiary} />
              <Text style={[styles.ticketInfoText, { color: colors.textSecondary }]} numberOfLines={1}>
                {activeTicket?.service?.name || "Service"}
              </Text>
            </View>
          </View>

          <View style={styles.statsRowCompact}>
            <View style={styles.statItemCompact}>
              <Text style={[styles.statLabelCompact, { color: colors.textTertiary }]}>{displayLabel}</Text>
              <Text style={[styles.statValueCompact, { color: isSpecialStatus ? colors.primary : colors.primary }]}>{displayText}</Text>
            </View>
            <View style={[styles.statDividerCompact, { backgroundColor: colors.border }]} />
            <View style={styles.statItemCompact}>
              <Text style={[styles.statLabelCompact, { color: colors.textTertiary }]}>Estimation</Text>
              <Text style={[styles.statValueCompact, { color: colors.primary }]}>{etaMinutes > 0 ? `${etaMinutes} min` : "—"}</Text>
            </View>
          </View>

          <View style={styles.ticketActionsCompact}>
            <TouchableOpacity style={[styles.actionBtnCompact, { backgroundColor: colors.primary + "10" }]} onPress={handleViewLiveTicket}>
              <Ionicons name="eye-outline" size={18} color={colors.primary} />
              <Text style={[styles.actionBtnTextCompact, { color: colors.primary }]}>Suivre</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtnCompact, { backgroundColor: colors.danger + "10" }]} onPress={handleCancelTicket}>
              <Ionicons name="close-outline" size={18} color={colors.danger} />
              <Text style={[styles.actionBtnTextCompact, { color: colors.danger }]}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>

        {activeTicket?.status === "waiting" && <ProgressCard position={position} etaMinutes={etaMinutes} colors={colors} />}
        
        {activeTicket?.status === "called" && (
          <View style={[styles.specialStatusCard, { backgroundColor: colors.danger + "10", borderColor: colors.danger }]}>
            <Ionicons name="notifications" size={20} color={colors.danger} />
            <Text style={[styles.specialStatusText, { color: colors.danger }]}>Appelé au guichet !</Text>
          </View>
        )}
        {activeTicket?.status === "present" && (
          <View style={[styles.specialStatusCard, { backgroundColor: colors.success + "10", borderColor: colors.success }]}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={[styles.specialStatusText, { color: colors.success }]}>Présent - Priorité conservée</Text>
          </View>
        )}
        {activeTicket?.status === "en_route" && (
          <View style={[styles.specialStatusCard, { backgroundColor: colors.warning + "10", borderColor: colors.warning }]}>
            <Ionicons name="walk" size={20} color={colors.warning} />
            <Text style={[styles.specialStatusText, { color: colors.warning }]}>En route - Agent notifié</Text>
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
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Autres tickets</Text>
          <View style={[styles.sectionBadge, { backgroundColor: colors.primary + "15" }]}>
            <Text style={[styles.sectionBadgeText, { color: colors.primary }]}>{otherActiveTickets.length}</Text>
          </View>
        </View>
        {otherActiveTickets.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} colors={colors} onPress={handleViewLiveTicket} />
        ))}
      </View>
    );
  };

  const renderQuickActions = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Actions Rapides</Text>
      <View style={styles.quickActionsGrid}>
        <QuickActionCircle icon="qr-code-outline" label="Scanner" color={colors.primary} onPress={handleScanQR} />
        <QuickActionCircle icon="time-outline" label="Historique" color={colors.success} onPress={handleViewHistory} />
        <QuickActionCircle icon="map-outline" label="Carte" color={colors.warning} onPress={() => router.push("/navigation")} />
        <QuickActionCircle icon="call-outline" label="Support" color={colors.secondary} onPress={() => {}} />
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderHeader()}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={56} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.textPrimary }]}>Une erreur est survenue</Text>
            <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={handleRefresh}>
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
      {!hasActiveTicket && !error && (
        <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={handleScanQR}>
          <Ionicons name="qr-code" size={26} color="#FFF" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: Platform.OS === 'ios' ? 55 : 35, paddingBottom: 24, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  welcomeText: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginBottom: 2 },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#FFF" },
  notificationIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  notificationDot: { position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 30 },
  
  emptyContainer: { alignItems: "center", paddingVertical: 40 },
  emptyIconContainer: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: "700", marginBottom: 6 },
  emptySubtitle: { fontSize: 13, textAlign: "center", marginBottom: 28, paddingHorizontal: 30 },
  scanButton: { borderRadius: 14, overflow: "hidden" },
  scanButtonGradient: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 24, gap: 6 },
  scanButtonText: { fontSize: 14, fontWeight: "600", color: "#FFF" },
  
  mainTicketCard: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 16 },
  ticketHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  ticketLabel: { fontSize: 11, marginBottom: 2 },
  ticketNumber: { fontSize: 22, fontWeight: "800" },
  ticketInfoCompact: { gap: 8, marginBottom: 12 },
  ticketInfoItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  ticketInfoText: { fontSize: 13, flex: 1 },
  statsRowCompact: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  statItemCompact: { flex: 1, alignItems: "center" },
  statLabelCompact: { fontSize: 10, marginBottom: 2 },
  statValueCompact: { fontSize: 16, fontWeight: "700" },
  statDividerCompact: { width: 1, height: 30 },
  ticketActionsCompact: { flexDirection: "row", gap: 10 },
  actionBtnCompact: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12 },
  actionBtnTextCompact: { fontSize: 13, fontWeight: "600" },
  
  progressCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 16 },
  progressStats: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  progressStat: { alignItems: "center", flex: 1 },
  progressStatLabel: { fontSize: 11, marginBottom: 3 },
  progressStatValue: { fontSize: 18, fontWeight: "700" },
  progressBar: { height: 5, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  progressSoon: { fontSize: 11, textAlign: "center", marginTop: 10, fontWeight: "600" },
  
  specialStatusCard: { borderRadius: 14, borderWidth: 1, padding: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 16 },
  specialStatusText: { fontSize: 14, fontWeight: "600" },
  
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: "700" },
  sectionBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  sectionBadgeText: { fontSize: 13, fontWeight: "700" },
  
  ticketCard: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between", 
    borderWidth: 1, 
    borderRadius: 14, 
    padding: 12, 
    marginBottom: 10 
  },
  ticketCardLeft: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 10, 
    flex: 1 
  },
  ticketNumberBadge: { 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 10, 
    alignItems: "center", 
    justifyContent: "center",
    minWidth: 60
  },
  ticketNumber: { 
    fontSize: 16, 
    fontWeight: "800" as any,
    textAlign: "center"
  },
  ticketDetails: { 
    flex: 1 
  },
  ticketService: { 
    fontSize: 14, 
    fontWeight: "600", 
    marginBottom: 2 
  },
  ticketQueueInfo: { 
    fontSize: 11 
  },
  
  statusBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, gap: 5 },
  statusBadgeText: { fontSize: 11, fontWeight: "700" },
  
  quickActionsGrid: { flexDirection: "row", justifyContent: "space-between", gap: 10, marginTop: 10 },
  quickActionCircle: { flex: 1, alignItems: "center" },
  quickActionCircleIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  quickActionCircleLabel: { fontSize: 11, fontWeight: "500" },
  
  errorContainer: { alignItems: "center", paddingVertical: 50 },
  errorText: { fontSize: 15, marginTop: 14, marginBottom: 20 },
  retryButton: { paddingVertical: 10, paddingHorizontal: 22, borderRadius: 12 },
  retryButtonText: { color: "#FFF", fontSize: 13, fontWeight: "600" },
  
  fab: { position: "absolute", bottom: 24, right: 24, width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  bottomSpace: { height: 20 },
});

export default TicketsScreen;