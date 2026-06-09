import React, { useState, useEffect, useCallback, useRef } from "react";
import * as Location from "expo-location";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Modal,
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
} from "react-native";
import MapView, {
  Marker,
  Polyline,
  PROVIDER_DEFAULT,
  Region,
} from "react-native-maps";
import { useGeolocation } from "../../hooks/useGeolocation";
import { useCustomAlert } from "../../hooks/useCustomAlert";
import { establishmentsApi, Establishment } from "../../api/establishmentsApi";
import { Colors, Theme } from "../../theme";
import { useThemeColors } from "../../hooks/useThemeColors";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import "../../../global.css";
import { useTicket } from "../../store/ticketStore";
import type { Ticket } from "../../api/ticketsApi";
import { useDistanceTracking } from "../../hooks/useDistanceTracking";
import { useSimpleNotification } from "../../hooks/useSimpleNotification";
import { Coordinates } from "../../utils/distance";
import useExploreCacheStore, {
  useExploreCache,
} from "../../store/exploreCacheStore";
import { useUnreadNotifications } from "../../hooks/useUnreadNotifications";
import { CustomActionSheet } from "../../components/ui/CustomActionSheet";
import {ActiveTicketCard} from "../../components/ActiveTicketCard";

const { width, height } = Dimensions.get("window");

type FilterType = "all" | "banks" | "clinics" | "pharmacies" | "gov";
type SortOption = "default" | "distance" | "name" | "crowd_level";

// Carte compacte pour un ticket spécifique dans le carrousel — ne lit PAS le store global
const TicketCarouselCard: React.FC<{
  ticket: Ticket;
  colors: any;
  onPress: () => void;
}> = ({ ticket, colors, onPress }) => {
  const getStatusConfig = () => {
    switch (ticket.status) {
      case "called": return { label: "Appelé !", color: colors.danger, icon: "notifications" };
      case "present": return { label: "Présent", color: colors.success, icon: "checkmark-circle" };
      case "en_route": return { label: "En route", color: colors.warning, icon: "walk" };
      default: return { label: "En attente", color: colors.primary, icon: "time" };
    }
  };
  const cfg = getStatusConfig();
  const queueInfo = ticket.status === "called" ? "Appelé"
    : ticket.status === "present" ? "Présent"
      : ticket.status === "en_route" ? "En route"
        : ticket.position ? `${ticket.position}e place` : "En attente";

  return (
    <TouchableOpacity
      style={[carouselCardStyles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={carouselCardStyles.cardHeader}>
        <View style={carouselCardStyles.estabRow}>
          <View style={[carouselCardStyles.estabIcon, { backgroundColor: colors.primary + "15" }]}>
            <Ionicons name="business" size={14} color={colors.primary} />
          </View>
          <Text style={[carouselCardStyles.estabName, { color: colors.textPrimary }]} numberOfLines={1}>
            {ticket.establishment?.name || "Établissement"}
          </Text>
        </View>
        <View style={[carouselCardStyles.statusBadge, { backgroundColor: cfg.color + "15" }]}>
          <Ionicons name={cfg.icon as any} size={10} color={cfg.color} />
          <Text style={[carouselCardStyles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      <View style={carouselCardStyles.ticketRow}>
        <View style={[carouselCardStyles.ticketNumBox, { backgroundColor: cfg.color }]}>
          <Text style={carouselCardStyles.ticketNum}>{ticket.number}</Text>
        </View>
        <View style={carouselCardStyles.ticketInfo}>
          <Text style={[carouselCardStyles.serviceName, { color: colors.textPrimary }]} numberOfLines={1}>
            {ticket.service?.name || "Service"}
          </Text>
          <Text style={[carouselCardStyles.queueInfo, { color: colors.textTertiary }]}>{queueInfo}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[carouselCardStyles.followBtn, { backgroundColor: colors.primary }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Ionicons name="eye-outline" size={14} color="#FFF" />
        <Text style={carouselCardStyles.followBtnText}>Suivre ce ticket</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const carouselCardStyles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 14 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  estabRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  estabIcon: { width: 24, height: 24, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  estabName: { fontSize: 13, fontWeight: "600", flex: 1 },
  statusBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, gap: 4 },
  statusText: { fontSize: 10, fontWeight: "700" },
  ticketRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  ticketNumBox: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  ticketNum: { fontSize: 15, fontWeight: "800", color: "#FFF" },
  ticketInfo: { flex: 1 },
  serviceName: { fontSize: 13, fontWeight: "600", marginBottom: 2 },
  queueInfo: { fontSize: 11 },
  followBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 10 },
  followBtnText: { color: "#FFF", fontSize: 13, fontWeight: "600" },
});

// Composant Bottom Sheet pour les tickets actifs (carrousel)
const ActiveTicketBottomSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
  tickets: Ticket[];
  colors: any;
}> = ({ visible, onClose, tickets, colors }) => {
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<any>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Calculer la largeur disponible pour chaque carte
  const CARD_WIDTH = width - 40; // 40 = 20px padding de chaque côté (16 + 8)
  const SNAP_INTERVAL = CARD_WIDTH + 8; // 8px de gap entre les cartes

  useEffect(() => {
    if (visible) {
      setCurrentIndex(0);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: height, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const goTo = (index: number) => {
    const next = Math.max(0, Math.min(tickets.length - 1, index));
    setCurrentIndex(next);
    flatListRef.current?.scrollToIndex({ index: next, animated: true });
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[styles.bottomSheetOverlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={styles.bottomSheetBackdrop} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[styles.bottomSheetModal, { backgroundColor: colors.surface, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.bottomSheetHandle}>
            <View style={[styles.bottomSheetHandleBar, { backgroundColor: colors.border }]} />
          </View>

          <View style={styles.bottomSheetHeader}>
            <Text style={[styles.bottomSheetTitle, { color: colors.textPrimary }]}>
              {tickets.length > 1 ? `Tickets actifs (${tickets.length})` : "Ticket actif"}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.bottomSheetClose}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Carrousel - Chaque carte prend toute la largeur */}
          <View style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
            <FlatList
              ref={flatListRef}
              data={tickets}
              keyExtractor={(t) => String(t.id)}
              horizontal
              pagingEnabled={false}
              snapToInterval={SNAP_INTERVAL}
              snapToAlignment="center"
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 4 }}
              onMomentumScrollEnd={(e) => {
                const offsetX = e.nativeEvent.contentOffset.x;
                const newIndex = Math.round(offsetX / SNAP_INTERVAL);
                if (newIndex !== currentIndex && newIndex >= 0 && newIndex < tickets.length) {
                  setCurrentIndex(newIndex);
                }
              }}
              getItemLayout={(_, index) => ({
                length: SNAP_INTERVAL,
                offset: SNAP_INTERVAL * index,
                index,
              })}
              // Dans ActiveTicketBottomSheet, le renderItem devient :
              renderItem={({ item, index }) => (
                <View
                  key={item.id}
                  style={{
                    width: CARD_WIDTH,
                    marginRight: index === tickets.length - 1 ? 0 : 8,
                  }}
                >
                  <ActiveTicketCard
                    ticket={item}  // <-- PASSER LE TICKET EN PROP
                    compact={true}
                    onPress={() => {
                      onClose();
                      router.push({ pathname: "/(tabs)/live-ticket", params: { ticketId: String(item.id) } });
                    }}
                  />
                </View>
              )}
            />

            {/* Pagination dots + flèches - uniquement si plus d'un ticket */}
            {tickets.length > 1 && (
              <View style={carouselStyles.pagination}>
                <TouchableOpacity
                  onPress={() => goTo(currentIndex - 1)}
                  disabled={currentIndex === 0}
                  style={[carouselStyles.arrow, { opacity: currentIndex === 0 ? 0.3 : 1 }]}
                >
                  <Ionicons name="chevron-back" size={20} color={colors.primary} />
                </TouchableOpacity>

                <View style={carouselStyles.dots}>
                  {tickets.map((_, i) => (
                    <TouchableOpacity key={i} onPress={() => goTo(i)}>
                      <View style={[
                        carouselStyles.dot,
                        { backgroundColor: i === currentIndex ? colors.primary : colors.border },
                        i === currentIndex && carouselStyles.dotActive,
                      ]} />
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  onPress={() => goTo(currentIndex + 1)}
                  disabled={currentIndex === tickets.length - 1}
                  style={[carouselStyles.arrow, { opacity: currentIndex === tickets.length - 1 ? 0.3 : 1 }]}
                >
                  <Ionicons name="chevron-forward" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

// Styles du carrousel (à garder en dehors)
const carouselStyles = StyleSheet.create({
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 8,
    paddingBottom: 8
  },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center"
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  dotActive: {
    width: 20,
    height: 6,
    borderRadius: 3
  },
});



const getMarkerColor = (crowdLevel?: string, colors?: any) => {
  switch (crowdLevel) {
    case "low": return Theme.colors.crowdLow;
    case "moderate": return Theme.colors.crowdModerate;
    case "high": return Theme.colors.crowdBusy;
    default: return colors?.primary || Theme.colors.primary;
  }
};

export const ExploreScreen: React.FC = () => {
  const colors = useThemeColors();
  const { location, getCurrentPosition } = useGeolocation();
  const [placeName, setPlaceName] = useState<string | null>(null);
  const {
    hasActiveTicket,
    activeTicket,
    activeTickets,
    fetchActiveTicket,
    isInitialized,
  } = useTicket();
  const { AlertComponent, showError } = useCustomAlert();
  const { unreadCount, refresh: refreshUnread } = useUnreadNotifications();

  const [showActiveTicketSheet, setShowActiveTicketSheet] = useState(false);
  const [showSortSheet, setShowSortSheet] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchActiveTicket().catch(console.error);
      refreshUnread();
    }, [fetchActiveTicket, refreshUnread]),
  );

  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [filteredEstablishments, setFilteredEstablishments] = useState<Establishment[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [selectedEstablishment, setSelectedEstablishment] = useState<Establishment | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinates[]>([]);
  const mapRef = useRef<MapView>(null);
  const [sortOption, setSortOption] = useState<SortOption>("default");
  const { setCachedData, shouldUseCache, cachedEstablishments, forceRefresh } = useExploreCache();
  const { notifyCrowdLevelChange, notifyEstablishmentOpen } = useSimpleNotification();
  const notifiedEstablishmentsRef = useRef<Set<string>>(new Set());

  const establishmentCoords = React.useMemo(() => {
    if (!activeTicket?.establishment) return null;
    const est = activeTicket.establishment as any;
    if (est?.lat == null || est?.lng == null) return null;
    return { latitude: Number(est.lat), longitude: Number(est.lng) };
  }, [activeTicket]);

  const { distanceInfo } = useDistanceTracking({
    targetCoordinates: establishmentCoords,
    enabled: hasActiveTicket && !!establishmentCoords,
    autoRefreshInterval: 30000,
  });

  const recenter = useCallback(() => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion(
        { latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        1000,
      );
    }
  }, [location]);

  useEffect(() => {
    if (location) {
      setMapRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  }, [location]);

  useEffect(() => {
    if (!location || !establishmentCoords || !hasActiveTicket) {
      setRouteCoordinates([]);
      return;
    }
    const start: Coordinates = { latitude: location.latitude, longitude: location.longitude };
    const end: Coordinates = { latitude: establishmentCoords.latitude, longitude: establishmentCoords.longitude };
    const numPoints = 20;
    const points: Coordinates[] = [start];
    for (let i = 1; i < numPoints; i++) {
      const t = i / numPoints;
      points.push({
        latitude: start.latitude + (end.latitude - start.latitude) * t,
        longitude: start.longitude + (end.longitude - start.longitude) * t,
      });
    }
    points.push(end);
    setRouteCoordinates(points);
  }, [location, establishmentCoords, hasActiveTicket]);

  useEffect(() => {
    const fetchPlaceName = async () => {
      if (!location) return;
      try {
        const result = await Location.reverseGeocodeAsync({
          latitude: location.latitude,
          longitude: location.longitude,
        });
        if (result.length > 0) {
          const place = result[0];
          const city = place.city?.trim();
          const district = place.district?.trim();
          setPlaceName(district || city || "Ma position");
        }
      } catch (error) {
        setPlaceName("Ma position");
      }
    };
    fetchPlaceName();
  }, [location]);

  const loadEstablishments = useCallback(async (forceReload = false) => {
    let currentLocation = location;
    if (!currentLocation) currentLocation = await getCurrentPosition();
    if (!currentLocation) {
      if (cachedEstablishments && !forceReload && !searchQuery) {
        setEstablishments(cachedEstablishments);
        setFilteredEstablishments(cachedEstablishments);
        const cacheLocation = useExploreCacheStore.getState().cachedData?.location;
        if (cacheLocation) {
          setMapRegion({ latitude: cacheLocation.latitude, longitude: cacheLocation.longitude, latitudeDelta: 0.0922, longitudeDelta: 0.0421 });
        }
        return;
      }
      showError("Localisation requise", "Activez la localisation pour trouver des établissements.");
      return;
    }

    if (!forceReload && !searchQuery && shouldUseCache(currentLocation) && cachedEstablishments) {
      setEstablishments(cachedEstablishments);
      setFilteredEstablishments(cachedEstablishments);
      setMapRegion({ latitude: currentLocation.latitude, longitude: currentLocation.longitude, latitudeDelta: 0.0922, longitudeDelta: 0.0421 });
      return;
    }

    setIsLoading(true);
    try {
      const data = await establishmentsApi.getEstablishments({
        lat: currentLocation.latitude,
        lng: currentLocation.longitude,
        q: searchQuery || undefined,
      });
      if (data && data.length > 0) {
        setEstablishments(data);
        setFilteredEstablishments(data);
        if (!searchQuery) setCachedData({ establishments: data, location: currentLocation });
      } else {
        setEstablishments([]);
        setFilteredEstablishments([]);
      }
      setMapRegion({ latitude: currentLocation.latitude, longitude: currentLocation.longitude, latitudeDelta: 0.0922, longitudeDelta: 0.0421 });
    } catch (error: any) {
      if (error?.response?.status === 401 || error?.code === "NETWORK_ERROR") {
        showError("Erreur", "Impossible de charger les établissements.");
      } else {
        setEstablishments([]);
        setFilteredEstablishments([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [location, getCurrentPosition, showError, searchQuery, shouldUseCache, cachedEstablishments, setCachedData]);

  useEffect(() => { if (!location) getCurrentPosition(); }, [location, getCurrentPosition]);
  useEffect(() => { if (cachedEstablishments && !location && !isLoading) { setEstablishments(cachedEstablishments); setFilteredEstablishments(cachedEstablishments); } }, []);
  useEffect(() => { loadEstablishments(false); }, [location?.latitude, location?.longitude, searchQuery, loadEstablishments]);

  const calculateDistance = useCallback((est: Establishment) => {
    if (!location) return Infinity;
    if (est.lat == null || est.lng == null) return Infinity;
    const estLat = Number(est.lat), estLng = Number(est.lng);
    if (isNaN(estLat) || isNaN(estLng)) return Infinity;
    const R = 6371;
    const dLat = (estLat - location.latitude) * Math.PI / 180;
    const dLng = (estLng - location.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(location.latitude * Math.PI / 180) * Math.cos(estLat * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, [location]);

  const sortEstablishments = useCallback((estList: Establishment[]) => {
    const sorted = [...estList];
    switch (sortOption) {
      case "distance":
        return sorted.sort((a, b) => {
          const distA = calculateDistance(a), distB = calculateDistance(b);
          if (distA === Infinity && distB === Infinity) return 0;
          if (distA === Infinity) return 1;
          if (distB === Infinity) return -1;
          return distA - distB;
        });
      case "name": return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case "crowd_level":
        const crowdOrder: Record<string, number> = { low: 0, moderate: 1, high: 2 };
        return sorted.sort((a, b) => (crowdOrder[a.crowd_level || "moderate"] ?? 3) - (crowdOrder[b.crowd_level || "moderate"] ?? 3));
      default: return sorted;
    }
  }, [sortOption, calculateDistance]);

  useEffect(() => {
    let filtered = establishments;
    if (searchQuery.trim()) {
      filtered = filtered.filter(est => est.name.toLowerCase().includes(searchQuery.toLowerCase()) || est.address.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    setFilteredEstablishments(sortEstablishments(filtered));
  }, [establishments, searchQuery, sortEstablishments]);

  const getTrendIndicator = (establishment: Establishment) => {
    const peopleWaiting = establishment.people_waiting ?? 0;
    let effectiveTrend = establishment.crowd_trend;
    if (!effectiveTrend) {
      if (peopleWaiting > 10) effectiveTrend = "up";
      else if (peopleWaiting <= 3) effectiveTrend = "down";
      else effectiveTrend = "stable";
    }
    switch (effectiveTrend) {
      case "up": return { icon: "trending-up", color: colors.danger, bg: colors.danger + "20" };
      case "down": return { icon: "trending-down", color: colors.success, bg: colors.success + "20" };
      default: return { icon: "remove", color: colors.textTertiary, bg: colors.border };
    }
  };

  const renderMarker = (establishment: Establishment) => {
    const lat = Number(establishment.lat), lng = Number(establishment.lng);
    if (isNaN(lat) || isNaN(lng)) return null;
    const trend = getTrendIndicator(establishment);
    return (
      <Marker key={establishment.id} coordinate={{ latitude: lat, longitude: lng }} onPress={() => setSelectedEstablishment(establishment)}>
        <View style={styles.markerContainer}>
          <View style={[styles.markerPin, { backgroundColor: getMarkerColor(establishment.crowd_level, colors) }]}>
            <Ionicons name="location" size={14} color="#FFF" />
          </View>
          <View style={[styles.markerTrend, { backgroundColor: trend.bg, borderColor: "#FFF" }]}>
            <Ionicons name={trend.icon as any} size={8} color={trend.color} />
          </View>
        </View>
      </Marker>
    );
  };

  const renderEstablishment = ({ item }: { item: Establishment }) => {
    const distance = location ? calculateDistance(item) : null;
    const isOpen = item.open_now ?? true;
    const servicesCount = item.services_count ?? 0;
    const markerColor = getMarkerColor(item.crowd_level, colors);

    return (
      <TouchableOpacity
        style={[styles.estCard, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
        onPress={() => router.push({ pathname: "/service-details", params: { establishmentId: String(item.id), serviceId: "", fromQr: "false" } })}
        activeOpacity={0.7}
      >
        <View style={styles.estCardLeft}>
          <View style={[styles.estIcon, { backgroundColor: markerColor + "15" }]}>
            <Ionicons name="business" size={20} color={markerColor} />
          </View>
        </View>
        <View style={styles.estCardContent}>
          <View style={styles.estCardHeader}>
            <Text style={[styles.estName, { color: colors.textPrimary }]} numberOfLines={1}>{item.name}</Text>
            <View style={[styles.openBadge, { backgroundColor: isOpen ? colors.success + "15" : colors.textTertiary + "15" }]}>
              <Text style={[styles.openBadgeText, { color: isOpen ? colors.success : colors.textTertiary }]}>{isOpen ? "Ouvert" : "Fermé"}</Text>
            </View>
          </View>
          <View style={styles.estAddress}>
            <Ionicons name="location-outline" size={12} color={colors.textTertiary} />
            <Text style={[styles.estAddressText, { color: colors.textSecondary }]} numberOfLines={1}>{item.address}</Text>
            {distance !== null && distance !== Infinity && (
              <Text style={[styles.estDistance, { color: colors.primary }]}>
                {distance < 1 ? `${(distance * 1000).toFixed(0)}m` : `${distance.toFixed(1)}km`}
              </Text>
            )}
          </View>
          <View style={styles.estStats}>
            <View style={[styles.statBadge, { backgroundColor: colors.warning + "10" }]}>
              <Ionicons name="grid-outline" size={10} color={colors.warning} />
              <Text style={[styles.statBadgeText, { color: colors.warning }]}>{servicesCount} services</Text>
            </View>
            <View style={[styles.statBadge, { backgroundColor: colors.primary + "10" }]}>
              <Ionicons name="people-outline" size={10} color={colors.primary} />
              <Text style={[styles.statBadgeText, { color: colors.primary }]}>{item.people_waiting ?? 0} en attente</Text>
            </View>
          </View>
        </View>
        <View style={styles.estCardRight}>
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Header fixe en haut */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={() => getCurrentPosition()}
            style={[styles.locationButton, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "20" }]}
          >
            <Ionicons name="location-sharp" size={14} color={colors.primary} />
            <Text style={[styles.locationButtonText, { color: colors.textPrimary }]} numberOfLines={1}>
              {placeName || "Localisation..."}
            </Text>
            <Ionicons name="chevron-down" size={10} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.notifButton, { backgroundColor: colors.primary }]}
              onPress={() => { refreshUnread(); router.push("/notifications"); }}
            >
              <Ionicons name="notifications-outline" size={18} color="#FFF" />
              {unreadCount > 0 && (
                <View style={[styles.notifBadge, { backgroundColor: colors.danger }]}>
                  <Text style={styles.notifBadgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.searchBar, { backgroundColor: colors.surfaceSecondary }]}>
          <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Rechercher..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterScrollContent}>
          <TouchableOpacity
            onPress={() => setSelectedFilter("all")}
            style={[styles.filterChip, { backgroundColor: selectedFilter === "all" ? colors.primary : colors.surface, borderColor: selectedFilter === "all" ? colors.primary : colors.border }]}
          >
            <Ionicons name="grid-outline" size={12} color={selectedFilter === "all" ? "#FFF" : colors.textSecondary} />
            <Text style={[styles.filterChipText, { color: selectedFilter === "all" ? "#FFF" : colors.textSecondary }]}>Tous</Text>
          </TouchableOpacity>
          {filteredEstablishments.slice(0, 4).map(est => (
            <TouchableOpacity key={est.id} style={[styles.estQuickChip, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push({ pathname: "/service-details", params: { establishmentId: String(est.id), serviceId: "", fromQr: "false" } })}>
              <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
              <Text style={[styles.estQuickChipText, { color: colors.textSecondary }]} numberOfLines={1}>{est.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Map Section */}
      <View style={styles.mapContainer}>
        {mapRegion && (
          <MapView ref={mapRef} style={styles.map} region={mapRegion} showsUserLocation followsUserLocation>
            {filteredEstablishments.map(renderMarker)}
            {hasActiveTicket && routeCoordinates.length > 0 && (<Polyline coordinates={routeCoordinates} strokeColor={colors.primary} strokeWidth={3} />)}
            {hasActiveTicket && establishmentCoords && (
              <Marker coordinate={establishmentCoords}>
                <View style={[styles.destMarker, { backgroundColor: colors.danger }]}>
                  <Ionicons name="flag" size={18} color="#FFF" />
                </View>
              </Marker>
            )}
          </MapView>
        )}
        <View style={styles.mapActions}>
          {hasActiveTicket && establishmentCoords && (
            <TouchableOpacity style={[styles.navFab, { backgroundColor: colors.warning }]} onPress={() => router.push("/navigation")}>
              <Ionicons name="navigate" size={24} color="#FFF" />
              {distanceInfo && <View style={[styles.navDistance, { backgroundColor: colors.surface }]}><Text style={[styles.navDistanceText, { color: colors.primary }]}>{Math.round(distanceInfo.kilometers * 10) / 10}km</Text></View>}
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.recenterBtn, { backgroundColor: colors.surface }]} onPress={recenter}>
            <Ionicons name="locate" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
        {isLoading && <View style={[styles.loadingOverlay, { backgroundColor: colors.surface + "CC" }]}><ActivityIndicator size="large" color={colors.primary} /></View>}
      </View>

      {/* Section Établissements */}
      <View style={styles.establishmentsSection}>
        <View style={[styles.sectionHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Établissements ({filteredEstablishments.length})</Text>
          <View style={styles.sectionActions}>
            <TouchableOpacity onPress={() => { forceRefresh(); loadEstablishments(true); }} style={styles.refreshBtn}>
              <Ionicons name="refresh-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowSortSheet(true)} style={[styles.sortBtn, { backgroundColor: colors.primary }]}>
              <Ionicons name="funnel-outline" size={14} color="#FFF" />
              <Text style={styles.sortBtnText}>Trier</Text>
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={filteredEstablishments}
          renderItem={renderEstablishment}
          keyExtractor={item => item.id.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.establishmentsList, { paddingBottom: 120 }]}
          ListFooterComponent={<View style={{ height: 80 }} />}
          style={styles.establishmentsFlatList}
          ListEmptyComponent={
            <View style={styles.emptyList}>
              <Ionicons name="search-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Aucun établissement</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Essayez de modifier votre recherche</Text>
            </View>
          }
        />
      </View>

      {/* FAB pour ouvrir le bottom sheet du ticket actif */}
      {isInitialized && hasActiveTicket && activeTickets.length > 0 && (
        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            styles.activeTicketFab,
            { backgroundColor: activeTickets.some(t => t.status === "called") ? colors.danger : colors.primary }
          ]}
          onPress={() => setShowActiveTicketSheet(true)}
        >
          <Ionicons name="ticket" size={24} color="#FFF" />
          <View style={[styles.fabBadge, { backgroundColor: "#FFF" }]}>
            <Text style={[styles.fabBadgeText, { color: activeTickets.some(t => t.status === "called") ? colors.danger : colors.primary }]}>
              {activeTickets.length}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Bottom Sheet pour les tickets actifs avec ActiveTicketCard */}
      <ActiveTicketBottomSheet
        visible={showActiveTicketSheet}
        onClose={() => setShowActiveTicketSheet(false)}
        tickets={activeTickets}
        colors={colors}
      />

      {/* CustomActionSheet pour le tri */}
      <CustomActionSheet
        visible={showSortSheet}
        title="Trier par"
        message="Choisissez votre critère de tri"
        options={[
          { label: 'Par défaut', value: 'default', icon: 'list-outline' },
          { label: 'Distance', value: 'distance', icon: 'navigate-outline' },
          { label: 'Nom (A-Z)', value: 'name', icon: 'text-outline' },
          { label: 'Affluence', value: 'crowd_level', icon: 'people-outline' },
        ]}
        selectedValue={sortOption}
        onSelect={(value) => {
          setSortOption(value as SortOption);
          setShowSortSheet(false);
        }}
        onClose={() => setShowSortSheet(false)}
        type="info"
        showCancel={true}
        cancelText="Annuler"
      />

      {AlertComponent}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: Platform.OS === 'ios' ? 50 : 40, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  locationButton: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, gap: 4, maxWidth: "65%" },
  locationButtonText: { fontSize: 12, fontWeight: "500", flexShrink: 1 },
  notifButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", position: "relative" },
  notifBadge: { position: "absolute", top: -2, right: -2, minWidth: 14, height: 14, borderRadius: 7, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  notifBadgeText: { color: "#FFF", fontSize: 8, fontWeight: "800" },
  searchBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 1, borderRadius: 12, gap: 6, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14 },
  filterScroll: { marginBottom: 4 },
  filterScrollContent: { paddingRight: 16, gap: 6 },
  filterChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, borderWidth: 1, gap: 4 },
  filterChipText: { fontSize: 12, fontWeight: "500" },
  estQuickChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1, gap: 4 },
  estQuickChipText: { fontSize: 11, fontWeight: "500", maxWidth: 100 },
  mapContainer: { height: height * 0.32, position: "relative" },
  map: { flex: 1 },
  mapActions: { position: "absolute", right: 12, top: 12, gap: 8 },
  navFab: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5, position: "relative" },
  navDistance: { position: "absolute", bottom: -6, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6 },
  navDistanceText: { fontSize: 8, fontWeight: "700" },
  recenterBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  loadingOverlay: { position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" },
  markerContainer: { position: "relative" },
  markerPin: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFF" },
  markerTrend: { position: "absolute", bottom: -2, right: -2, width: 12, height: 12, borderRadius: 6, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  destMarker: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFF" },

  // Section Établissements
  establishmentsSection: { flex: 1 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  sectionTitle: { fontSize: 17, fontWeight: "700" as const },
  sectionActions: { flexDirection: "row", gap: 8 },
  refreshBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  sortBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 4 },
  sortBtnText: { color: "#FFF", fontSize: 11, fontWeight: "600" },
  establishmentsFlatList: { flex: 1 },
  establishmentsList: { paddingBottom: 100 },

  estCard: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 0.5 },
  estCardLeft: { marginRight: 12 },
  estIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  estCardContent: { flex: 1, gap: 4 },
  estCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  estName: { fontSize: 14, fontWeight: "700", flex: 1, marginRight: 8 },
  openBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  openBadgeText: { fontSize: 9, fontWeight: "600" },
  estAddress: { flexDirection: "row", alignItems: "center", gap: 4 },
  estAddressText: { fontSize: 11, flex: 1 },
  estDistance: { fontSize: 10, fontWeight: "600" },
  estStats: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  statBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, gap: 3 },
  statBadgeText: { fontSize: 9, fontWeight: "500" },
  estCardRight: { alignItems: "flex-end", justifyContent: "center", marginLeft: 8 },
  emptyList: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginTop: 12, textAlign: "center" },
  emptySub: { fontSize: 12, textAlign: "center", marginTop: 6 },

  activeTicketFab: {
    position: "absolute",
    left: 16,
    top: "50%",
    marginTop: -28,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  fabBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: "#FFF",
  },
  fabBadgeText: {
    fontSize: 11,
    fontWeight: "800" as const,
  },

  // Bottom Sheet styles
  bottomSheetOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 1001,
  },
  bottomSheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  bottomSheetModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
    maxHeight: '85%',
  },
  bottomSheetHandle: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  bottomSheetHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 0.4,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
  },
  bottomSheetClose: {
    padding: 4,
  },
  bottomSheetScrollView: {
    maxHeight: '85%',
  },
  bottomSheetScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
});

export default ExploreScreen;