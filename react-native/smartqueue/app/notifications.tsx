import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Platform,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { notificationsApi, Notification } from "../src/api/notificationsApi";
import { useCustomAlert } from "../src/hooks/useCustomAlert";
import { useThemeColors } from "../src/hooks/useThemeColors";

const { width } = Dimensions.get("window");

type FilterType = "all" | "info" | "warning" | "success";

// Format date relative
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "À l'instant";
  if (diffMins < 60) return `${diffMins} min`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) return `${diffDays}j`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function getNotificationStyle(type: string, colors: any): { icon: keyof typeof Ionicons.glyphMap; color: string; bgColor: string } {
  switch (type) {
    case "success":
      return { icon: "checkmark-circle", color: colors.success, bgColor: colors.success + "15" };
    case "warning":
      return { icon: "warning-outline", color: colors.warning, bgColor: colors.warning + "15" };
    case "error":
      return { icon: "alert-circle", color: colors.danger, bgColor: colors.danger + "15" };
    default:
      return { icon: "information-circle", color: colors.primary, bgColor: colors.primary + "15" };
  }
}

// Composant de filtre compact
const FilterChip = ({ label, active, onPress, color }: any) => (
  <TouchableOpacity
    style={[styles.filterChip, active && { backgroundColor: color, borderColor: color }]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text style={[styles.filterChipText, { color: active ? "#FFF" : color }]}>{label}</Text>
  </TouchableOpacity>
);

// Composant de notification
const NotificationItem = ({ notif, colors, onPress, onDelete }: any) => {
  const { icon, color, bgColor } = getNotificationStyle(notif.type, colors);
  const isUnread = !notif.read_at;

  return (
    <TouchableOpacity
      style={[styles.notifCard, { backgroundColor: colors.surface, borderBottomColor: colors.border }, isUnread && { backgroundColor: colors.primary + "05" }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.notifIcon, { backgroundColor: bgColor }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={styles.notifContent}>
        <View style={styles.notifHeader}>
          <Text style={[styles.notifTitle, { color: isUnread ? colors.textPrimary : colors.textSecondary }]} numberOfLines={1}>
            {notif.title}
          </Text>
          {isUnread && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
        </View>
        <Text style={[styles.notifMessage, { color: colors.textSecondary }]} numberOfLines={2}>
          {notif.message}
        </Text>
        <Text style={[styles.notifTime, { color: colors.textTertiary }]}>{formatRelativeTime(notif.created_at)}</Text>
      </View>
      <TouchableOpacity style={styles.notifDelete} onPress={onDelete}>
        <Ionicons name="close-outline" size={18} color={colors.textTertiary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

// Groupe de notifications par date
const NotificationGroup = ({ date, notifications, colors, onPress, onDelete }: any) => (
  <View style={styles.group}>
    <Text style={[styles.groupTitle, { color: colors.textTertiary }]}>{date}</Text>
    <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {notifications.map((notif: Notification, idx: number) => (
        <NotificationItem
          key={notif.id}
          notif={notif}
          colors={colors}
          onPress={() => onPress(notif)}
          onDelete={() => onDelete(notif.id)}
        />
      ))}
    </View>
  </View>
);

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { AlertComponent, showSuccess, showError } = useCustomAlert();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      setError(null);
      const [notifsResponse, countResponse] = await Promise.all([
        notificationsApi.getNotifications(),
        notificationsApi.getUnreadCount(),
      ]);
      setNotifications(Array.isArray(notifsResponse.data) ? notifsResponse.data : []);
      setUnreadCount(countResponse.count);
    } catch (err) {
      setError("Impossible de charger les notifications");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadNotifications(); }, []);

  const handleRefresh = () => { setRefreshing(true); loadNotifications(); };
  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { showError("Erreur", "Impossible de marquer comme lu"); }
  };
  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;
    try {
      await notificationsApi.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
      setUnreadCount(0);
      showSuccess("Succès", "Toutes les notifications sont lues");
    } catch { showError("Erreur", "Impossible de marquer tout comme lu"); }
  };
  const handleDelete = async (id: string) => {
    try {
      await notificationsApi.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch { showError("Erreur", "Impossible de supprimer"); }
  };

  const filteredNotifications = notifications.filter(n => filter === "all" ? true : n.type === filter);
  const grouped = filteredNotifications.reduce((acc, n) => {
    const date = new Date(n.created_at);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    let key = date.toDateString() === today.toDateString() ? "Aujourd'hui"
      : date.toDateString() === yesterday.toDateString() ? "Hier"
      : date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
    if (!acc[key]) acc[key] = [];
    acc[key].push(n);
    return acc;
  }, {} as Record<string, Notification[]>);

  const filterCounts = {
    all: notifications.length,
    info: notifications.filter(n => n.type === "info").length,
    warning: notifications.filter(n => n.type === "warning").length,
    success: notifications.filter(n => n.type === "success").length,
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Notifications</Text>
            <TouchableOpacity style={styles.headerRightPlaceholder} />
          </View>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity style={[styles.markAllBtn, unreadCount === 0 && styles.markAllBtnDisabled]} onPress={handleMarkAllAsRead} disabled={unreadCount === 0}>
              <Text style={[styles.markAllText, unreadCount === 0 && styles.markAllTextDisabled]}>Tout lire</Text>
            </TouchableOpacity>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </LinearGradient>

      {/* Filtres compacts */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.filtersRow} 
        contentContainerStyle={styles.filtersContent}
      >
        <FilterChip label="Toutes" active={filter === "all"} onPress={() => setFilter("all")} color={colors.primary} />
        <FilterChip label="Info" active={filter === "info"} onPress={() => setFilter("info")} color={colors.primary} />
        <FilterChip label="Attention" active={filter === "warning"} onPress={() => setFilter("warning")} color={colors.warning} />
        <FilterChip label="Succès" active={filter === "success"} onPress={() => setFilter("success")} color={colors.success} />
        <View style={styles.filterCountBadge}>
          <Text style={[styles.filterCountText, { color: colors.textTertiary }]}>{filterCounts[filter]}</Text>
        </View>
      </ScrollView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        {error ? (
          <View style={styles.errorContainer}>
            <View style={[styles.errorIcon, { backgroundColor: colors.danger + "10" }]}>
              <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
            </View>
            <Text style={[styles.errorText, { color: colors.textPrimary }]}>{error}</Text>
            <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={loadNotifications}>
              <Text style={styles.retryBtnText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : Object.keys(grouped).length === 0 ? (
          <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primary + "10" }]}>
              <Ionicons name="notifications-off-outline" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Aucune notification</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Les notifications apparaîtront ici</Text>
          </Animated.View>
        ) : (
          <Animated.View style={{ opacity: fadeAnim }}>
            {Object.entries(grouped).map(([date, notifs]) => (
              <NotificationGroup
                key={date}
                date={date}
                notifications={notifs}
                colors={colors}
                onPress={(n: Notification) => !n.read_at && handleMarkAsRead(n.id)}
                onDelete={handleDelete}
              />
            ))}
            <View style={{ height: 40 }} />
          </Animated.View>
        )}
      </ScrollView>
      {AlertComponent}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: Platform.OS === 'ios' ? 20 : 50, paddingBottom: 16, paddingHorizontal: 16 },
  headerContent: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFF" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerRightPlaceholder: { width: 36 },
  markAllBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)" },
  markAllBtnDisabled: { backgroundColor: "rgba(255,255,255,0.1)" },
  markAllText: { fontSize: 12, fontWeight: "600", color: "#FFF" },
  markAllTextDisabled: { color: "rgba(255,255,255,0.5)" },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: "#FF3B30", alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  unreadText: { color: "#FFF", fontSize: 11, fontWeight: "700" },
  filtersRow: { paddingVertical: 8, paddingHorizontal: 16, maxHeight: 44 },
  filtersContent: { flexDirection: "row", alignItems: "center", gap: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, borderWidth: 1, borderColor: "#CCC" },
  filterChipText: { fontSize: 12, fontWeight: "500" },
  filterCountBadge: { marginLeft: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.05)" },
  filterCountText: { fontSize: 11, fontWeight: "600" },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 30 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyContainer: { alignItems: "center", paddingVertical: 50 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginBottom: 6 },
  emptySub: { fontSize: 13, textAlign: "center" },
  errorContainer: { alignItems: "center", paddingVertical: 50 },
  errorIcon: { width: 70, height: 70, borderRadius: 35, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  errorText: { fontSize: 15, marginTop: 8, marginBottom: 20 },
  retryBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 12 },
  retryBtnText: { color: "#FFF", fontSize: 14, fontWeight: "600" },
  group: { marginBottom: 20 },
  groupTitle: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 },
  groupCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  notifCard: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 0.5, gap: 12 },
  notifIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  notifContent: { flex: 1 },
  notifHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  notifTitle: { fontSize: 13, fontWeight: "600", flex: 1 },
  unreadDot: { width: 6, height: 6, borderRadius: 3 },
  notifMessage: { fontSize: 12, lineHeight: 16, marginBottom: 4 },
  notifTime: { fontSize: 10 },
  notifDelete: { padding: 4 },
});