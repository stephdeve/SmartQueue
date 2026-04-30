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
  Modal
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, Region } from "react-native-maps";
import { useGeolocation } from "../../hooks/useGeolocation";
import { useCustomAlert } from "../../hooks/useCustomAlert";
import { establishmentsApi, Establishment } from "../../api/establishmentsApi";
import {  Theme } from "../../theme";
import { useThemeColors } from "../../hooks/useThemeColors";
import { Badge } from "../../components/ui/Badge";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import "../../../global.css";
import { useTicket } from "../../store/ticketStore";
import { useDistanceTracking } from "../../hooks/useDistanceTracking";
import { useSimpleNotification } from "../../hooks/useSimpleNotification";
import { Coordinates } from "../../utils/distance";
import { ActiveTicketCard } from "../../components/ActiveTicketCard";
import { useExploreCache } from "../../store/exploreCacheStore";
// Types pour les filtres
type FilterType = "all" | "banks" | "clinics" | "pharmacies" | "gov";
type SortOption = "default" | "distance" | "name" | "crowd_level";



// Composant ExploreScreen
export const ExploreScreen: React.FC = () => {

  const colors = useThemeColors();
  const { location, getCurrentPosition } = useGeolocation();
  const [placeName, setPlaceName] = useState<string | null>(null);
  const { hasActiveTicket, activeTicket, fetchActiveTicket, isInitialized } = useTicket();
  const { AlertComponent, showError } = useCustomAlert();

  // Debug log
  useEffect(() => {
    console.log('[ExploreScreen] State:', { hasActiveTicket, isInitialized, activeTicketId: activeTicket?.id });
  }, [hasActiveTicket, isInitialized, activeTicket]);

  // Fetch fresh ticket data on mount to avoid showing stale data from other users
  useEffect(() => {
    console.log('[ExploreScreen] Fetching active ticket...');
    fetchActiveTicket().catch(err => console.error('Error fetching active ticket:', err));
  }, [fetchActiveTicket]);

  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [filteredEstablishments, setFilteredEstablishments] = useState<
    Establishment[]
  >([]);
    const [selectedFilter, setSelectedFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [selectedEstablishment, setSelectedEstablishment] =
    useState<Establishment | null>(null);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinates[]>([]);
  const mapRef = useRef<MapView>(null);
  const [sortOption, setSortOption] = useState<SortOption>("default");
  const [showSortModal, setShowSortModal] = useState(false);
  const { setCachedData, shouldUseCache, cachedEstablishments, forceRefresh } = useExploreCache();

  // Simple notifications
  const { notifyCrowdLevelChange, notifyEstablishmentOpen } = useSimpleNotification();
  const notifiedEstablishmentsRef = useRef<Set<string>>(new Set());

  // Get establishment coordinates from active ticket for navigation
  const establishmentCoords = React.useMemo(() => {
    if (!activeTicket?.establishment) return null;
    const est = activeTicket.establishment as any;
    if (est?.lat == null || est?.lng == null) return null;
    return {
      latitude: Number(est.lat),
      longitude: Number(est.lng),
    };
  }, [activeTicket]);

  // Distance tracking for active ticket navigation
  const { distanceInfo } = useDistanceTracking({
    targetCoordinates: establishmentCoords,
    enabled: hasActiveTicket && !!establishmentCoords,
    autoRefreshInterval: 30000,
  });

  // Recenter on user
  const recenter = useCallback(() => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000,
      );
    }
  }, [location]);

  //Effet recuperer region par defaut
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

  // Generate route coordinates when user location and establishment coords available
  useEffect(() => {
    if (!location || !establishmentCoords || !hasActiveTicket) {
      setRouteCoordinates([]);
      return;
    }

    const start: Coordinates = {
      latitude: location.latitude,
      longitude: location.longitude,
    };
    const end: Coordinates = {
      latitude: establishmentCoords.latitude,
      longitude: establishmentCoords.longitude,
    };

    // Create intermediate points for route line
    const numPoints = 20;
    const points: Coordinates[] = [start];

    for (let i = 1; i < numPoints; i++) {
      const t = i / numPoints;
      const lat = start.latitude + (end.latitude - start.latitude) * t;
      const lng = start.longitude + (end.longitude - start.longitude) * t;
      points.push({ latitude: lat, longitude: lng });
    }

    points.push(end);
    setRouteCoordinates(points);
  }, [location, establishmentCoords, hasActiveTicket]);

//Ajouter le reverse geocoding
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

        const normalize = (str?: string) =>
          str
            ? str.toLowerCase().replace(/[-\s]+/g, "").trim()
            : "";

        const city = place.city?.trim();
        const subregion = place.subregion?.trim();
        const district = place.district?.trim();
        const region = place.region?.trim();
        const primary = district || subregion || city;
        const secondary = city || region;

        let name = "";

        if (
          primary &&
          secondary &&
          normalize(primary) !== normalize(secondary)
        ) {
          name = `${primary}, ${secondary}`;
        } else {
          name = primary || secondary || place.country || "Ma position";
        }

        setPlaceName(name);
      }
    } catch (error) {
      console.log("Reverse geocode error", error);
      setPlaceName("Ma position");
    }
  };

  fetchPlaceName();
}, [location]);


  // Charger les établissements
  const loadEstablishments = useCallback(async (forceReload = false) => {
    let currentLocation = location;

    if (!currentLocation) {
      currentLocation = await getCurrentPosition();
    }

    if (!currentLocation) {
      showError(
        "Localisation requise",
        "Veuillez autoriser la localisation pour trouver les établissements proches.",
      );
      return;
    }

    const currentLat = currentLocation.latitude;
    const currentLng = currentLocation.longitude;

    // Vérifier si on peut utiliser le cache (sauf si force reload)
    if (!forceReload && !searchQuery && shouldUseCache({ latitude: currentLat, longitude: currentLng }) && cachedEstablishments) {
      console.log('[ExploreScreen] Using cached establishments');
      setEstablishments(cachedEstablishments);
      setFilteredEstablishments(cachedEstablishments);
      setMapRegion({
        latitude: currentLat,
        longitude: currentLng,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
      return;
    }

    setIsLoading(true);

    try {
      const data = await establishmentsApi.getEstablishments({
        lat: currentLat,
        lng: currentLng,
        q: searchQuery || undefined,
      });

      if (data && data.length > 0) {
        setEstablishments(data);
        setFilteredEstablishments(data);
        // Sauvegarder dans le cache seulement si pas de recherche
        if (!searchQuery) {
          setCachedData({
            establishments: data,
            location: { latitude: currentLat, longitude: currentLng },
          });
        }
      } else {
        // Empty response - still set empty arrays
        setEstablishments([]);
        setFilteredEstablishments([]);
      }

      // Mettre à jour la région de la carte
      if (data.length > 0 || location) { // Update map region if data is available or location is known
        setMapRegion({
          latitude: currentLat,
          longitude: currentLng,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        });
      }
    } catch (error: any) {
      console.error("Error loading establishments:", error?.response?.status, error?.message);
      // Only show alert if it's a network/auth error, not if it's a backend issue
      if (error?.response?.status === 401 || error?.code === 'NETWORK_ERROR' || !error?.response) {
        showError(
          "Erreur",
          "Impossible de charger les établissements. Vérifiez votre connexion.",
        );
      } else {
        // For other errors (500, 404, etc), just log and show empty state
        setEstablishments([]);
        setFilteredEstablishments([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [location, getCurrentPosition, showError, searchQuery, shouldUseCache, cachedEstablishments, setCachedData]);

  // Effet initial pour charger la position si non disponible
  useEffect(() => {
    if (!location) {
      getCurrentPosition();
    }
  }, [location, getCurrentPosition]);

  // Effet pour charger les établissements quand la position ou les filtres changent
  useEffect(() => {
    loadEstablishments(false); // false = permettre l'utilisation du cache
  }, [location?.latitude, location?.longitude, searchQuery, loadEstablishments]);

  // Calculer la distance depuis la position de l'utilisateur
  const calculateDistance = useCallback((est: Establishment) => {
    if (!location) return Infinity;
    // Check for null/undefined/invalid coordinates
    if (est.lat == null || est.lng == null) return Infinity;
    const estLat = Number(est.lat);
    const estLng = Number(est.lng);
    if (isNaN(estLat) || isNaN(estLng) || estLat === 0 && estLng === 0) return Infinity;

    const R = 6371; // Rayon de la Terre en km
    const dLat = (estLat - location.latitude) * (Math.PI / 180);
    const dLng = (estLng - location.longitude) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(location.latitude * (Math.PI / 180)) *
        Math.cos(estLat * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, [location]);

  // Notify for nearby low crowd establishments
  useEffect(() => {
    if (!location || establishments.length === 0) return;

    // Find nearby establishments with low crowd level
    const nearbyLowCrowd = establishments.filter(est => {
      if (est.crowd_level !== 'low') return false;
      if (notifiedEstablishmentsRef.current.has(`crowd_${est.id}`)) return false;
      
      const dist = calculateDistance(est);
      return dist < 1; // Within 1km
    });

    // Notify for first nearby low crowd establishment
    if (nearbyLowCrowd.length > 0) {
      const est = nearbyLowCrowd[0];
      notifyCrowdLevelChange(est.name, 'high', 'low', est.people_waiting ?? 0);
      notifiedEstablishmentsRef.current.add(`crowd_${est.id}`);
    }

    // Find newly opened establishments
    const newlyOpened = establishments.filter(est => {
      if (est.open_now !== true) return false;
      if (notifiedEstablishmentsRef.current.has(`open_${est.id}`)) return false;
      
      const dist = calculateDistance(est);
      return dist < 2; // Within 2km
    });

    // Notify for first newly opened establishment
    if (newlyOpened.length > 0) {
      const est = newlyOpened[0];
      notifyEstablishmentOpen(est.name);
      notifiedEstablishmentsRef.current.add(`open_${est.id}`);
    }
  }, [establishments, location, calculateDistance, notifyCrowdLevelChange, notifyEstablishmentOpen]);

  // Fonction de tri
  const sortEstablishments = useCallback((estList: Establishment[]) => {
    const sorted = [...estList];
    switch (sortOption) {
      case "distance":
        return sorted.sort((a, b) => {
          const distA = calculateDistance(a);
          const distB = calculateDistance(b);
          // Put establishments with invalid coordinates at the end
          if (distA === Infinity && distB === Infinity) return 0;
          if (distA === Infinity) return 1;
          if (distB === Infinity) return -1;
          return distA - distB;
        });
      case "name":
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case "crowd_level":
        // Sort by crowd level: low first, then moderate, then high, undefined last
        const crowdOrder: Record<string, number> = { low: 0, moderate: 1, high: 2 };
        return sorted.sort((a, b) => {
          const levelA = a.crowd_level ? crowdOrder[a.crowd_level] ?? 3 : 3;
          const levelB = b.crowd_level ? crowdOrder[b.crowd_level] ?? 3 : 3;
          return levelA - levelB;
        });
      default:
        return sorted;
    }
  }, [sortOption, calculateDistance]);

  // Effet pour filtrer et trier les établissements
  useEffect(() => {
    let filtered = establishments;

    // Filtrer par recherche
    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (est) =>
          est.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          est.address.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    // Appliquer le tri
    const sorted = sortEstablishments(filtered);
    setFilteredEstablishments(sorted);
  }, [establishments, searchQuery, sortEstablishments]);

  // Obtenir la couleur du marqueur selon le niveau d'affluence
  const getMarkerColor = (crowdLevel?: string) => {
    switch (crowdLevel) {
      case "low":
        return Theme.colors.crowdLow;
      case "moderate":
        return Theme.colors.crowdModerate;
      case "high":
        return Theme.colors.crowdBusy;
      default:
        return colors.primary;
    }
  };

  // Obtenir l'icône et la couleur de tendance
  const getTrendIndicator = (establishment: Establishment) => {
    const trend = establishment.crowd_trend || 'stable';
    const peopleWaiting = establishment.people_waiting ?? 0;
    
    // Simulation: si plus de 10 personnes, tendance à la hausse probable
    // Si 0-3 personnes, tendance à la baisse probable
    // Sinon stable
    let effectiveTrend = trend;
    if (!establishment.crowd_trend) {
      if (peopleWaiting > 10) effectiveTrend = 'up';
      else if (peopleWaiting <= 3) effectiveTrend = 'down';
      else effectiveTrend = 'stable';
    }

    switch (effectiveTrend) {
      case 'up':
        return { icon: 'trending-up', color: colors.danger, bg: colors.danger + '20' };
      case 'down':
        return { icon: 'trending-down', color: colors.success, bg: colors.success + '20' };
      default:
        return { icon: 'remove', color: colors.textTertiary, bg: colors.border };
    }
  };

  // Gérer le tap sur un marqueur
  const handleMarkerPress = (establishment: Establishment) => {
    setSelectedEstablishment(establishment);
    setShowBottomSheet(true);
  };

  // Gérer le tap sur une carte
  const handleEstablishmentPress = (establishment: Establishment) => {
    router.push({
      pathname: "/service-details",
      params: {
        establishmentId: String(establishment.id),
        serviceId: "",
        fromQr: "false",
      },
    });
  };

  // Rendu d'un marqueur
  const renderMarker = (establishment: Establishment) => {
    const lat = Number(establishment.lat);
    const lng = Number(establishment.lng);

    if (isNaN(lat) || isNaN(lng)) return null;

    const trend = getTrendIndicator(establishment);

    return (
      <Marker
        key={establishment.id}
        coordinate={{
          latitude: lat,
          longitude: lng,
        }}
        onPress={() => handleMarkerPress(establishment)}
      >
        <View style={{ position: 'relative' }}>
          <View
            className="w-10 h-10 rounded-full items-center justify-center border-2 border-white shadow-md"
            style={{ backgroundColor: getMarkerColor(establishment.crowd_level) }}
          >
            <Ionicons name="location" size={18} color="#FFFFFF" />
          </View>
          {/* Badge tendance */}
          <View
            style={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: trend.bg,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1.5,
              borderColor: '#FFFFFF',
            }}
          >
            <Ionicons name={trend.icon as any} size={10} color={trend.color} />
          </View>
        </View>
      </Marker>
    );
  };

  // Rendu d'un établissement dans la liste
  const renderEstablishment = ({ item }: { item: Establishment }) => {
    const distance = location ? calculateDistance(item) : null;
    const isOpen = item.open_now ?? true;
    const servicesCount = item.services_count ?? 0;

    return (
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.surface, borderRadius: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 }}
        onPress={() => handleEstablishmentPress(item)}
        activeOpacity={0.7}
      >
        <View
          className="w-12 h-12 rounded-xl items-center justify-center mr-4"
          style={{ backgroundColor: getMarkerColor(item.crowd_level) + "20" }}
        >
          <Ionicons
            name="business"
            size={20}
            color={getMarkerColor(item.crowd_level)}
          />
        </View>

        <View className="flex-1">
          {/* Ligne titre + badge ouvert/fermé */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, flex: 1 }} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={{ backgroundColor: isOpen ? colors.success + '20' : colors.textTertiary + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginLeft: 8 }}>
              <Text style={{ fontSize: 10, color: isOpen ? colors.success : colors.textTertiary, fontWeight: '600' }}>
                {isOpen ? 'Ouvert' : 'Fermé'}
              </Text>
            </View>
          </View>

          {/* Adresse + Distance */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginLeft: 4, flex: 1 }} numberOfLines={1}>
              {item.address}
            </Text>
            {distance !== null && distance !== Infinity && (
              <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600', marginLeft: 4 }}>
                {distance < 1 ? `${(distance * 1000).toFixed(0)}m` : `${distance.toFixed(1)}km`}
              </Text>
            )}
          </View>

          {/* Infos services et file */}
          <View className="flex-row items-center mt-2">
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.warning + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginRight: 8 }}>
              <Ionicons name="grid-outline" size={12} color={colors.warning} />
              <Text style={{ fontSize: 11, color: colors.warning, marginLeft: 4, fontWeight: '500' }}>
                {servicesCount} service{servicesCount > 1 ? 's' : ''}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginRight: 8 }}>
              <Ionicons name="people-outline" size={12} color={colors.primary} />
              <Text style={{ fontSize: 11, color: colors.primary, marginLeft: 4, fontWeight: '500' }}>
                {item.people_waiting ?? 0} personne(s) en attente
              </Text>
            </View>
          </View>
        </View>

        <View className="items-end ml-2">
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Badge variant={(item.crowd_level as any) || "moderate"} size="small">
              {item.crowd_level || "moderate"}
            </Badge>
            {/* Indicateur tendance */}
            {(() => {
              const trend = getTrendIndicator(item);
              return (
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: trend.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: 6,
                  }}
                >
                  <Ionicons name={trend.icon as any} size={10} color={trend.color} />
                </View>
              );
            })()}
          </View>
          <Ionicons
            name="chevron-forward"
            size={16}
            color="#9CA3AF"
            className="mt-2"
          />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Search Header - iOS Style */}
      <View style={{ paddingHorizontal: 20, paddingTop: 43, paddingBottom: 16, backgroundColor: colors.surface, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <TouchableOpacity 
            onPress={()=>getCurrentPosition()} 
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary + '20', borderColor: colors.primary + '30', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }}
          >
            <Ionicons name="location-sharp" size={16} color={colors.primary} />
            <Text style={{ marginLeft: 4, fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
              {placeName || "Localisation en cours..."}
            </Text>
            <Ionicons name="chevron-down" size={12} color={colors.textSecondary} style={{ marginLeft: 4 }} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: 'red' , borderColor: colors.danger + '30', borderWidth: 1, borderRadius: 999,  }}
            onPress={() => router.push('/notifications' as any)}
          >
            <Ionicons name="notifications-outline" size={20} color={'white'} />
            {/* <View style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, backgroundColor: colors.background, borderRadius: 99, }} /> */}
          </TouchableOpacity>
        </View>

        {/* Search Input Container */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSecondary, borderRadius: 16, paddingHorizontal: 16 }}>
          <Ionicons name="search-outline" size={20} color={colors.textTertiary} />
          <TextInput
            style={{ flex: 1, marginLeft: 8, fontSize: 16, color: colors.textPrimary }}
            placeholder="Rechercher un etablissement ..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Categories / Filters - Shows actual establishment names */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 16 }}
          contentContainerStyle={{ paddingRight: 20 }}
        >
          {/* Filtre "Tous" */}
          <TouchableOpacity
            onPress={() => setSelectedFilter("all")}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 999,
              marginRight: 8,
              borderWidth: 1,
              backgroundColor: selectedFilter === "all" ? colors.primary : colors.surface,
              borderColor: selectedFilter === "all" ? colors.primary : colors.border,
            }}
          >
            <Ionicons name="grid-outline" size={16} color={selectedFilter === "all" ? '#FFFFFF' : colors.textSecondary} />
            <Text style={{
              marginLeft: 4,
              fontWeight: '500',
              color: selectedFilter === "all" ? '#FFFFFF' : colors.textSecondary,
            }}>
              Tous
            </Text>
          </TouchableOpacity>

          {/* Filtre dynamique : établissements proches */}
          {filteredEstablishments.slice(0, 3).map((est) => (
            <TouchableOpacity
              key={est.id}
              onPress={() => router.push({
                pathname: "/service-details",
                params: { establishmentId: String(est.id), serviceId: "", fromQr: "false" },
              })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 999,
                marginRight: 8,
                borderWidth: 1,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              }}
            >
              <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
              <Text style={{ marginLeft: 4, fontWeight: '500', color: colors.textSecondary }} numberOfLines={1}>
                {est.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary, marginTop: 1 }}>
        {mapRegion && (
          <MapView
            provider={PROVIDER_DEFAULT}
            ref={mapRef}
            style={{ flex: 1 }}
            region={mapRegion}
            showsUserLocation={true}
            showsMyLocationButton={true}
            followsUserLocation={!!location}
          >
            {filteredEstablishments.map(renderMarker)}

            {/* Active Ticket Route Line */}
            {hasActiveTicket && routeCoordinates.length > 0 && (
              <Polyline
                coordinates={routeCoordinates}
                strokeColor={colors.primary}
                strokeWidth={4}
                lineCap="round"
                lineJoin="round"
              />
            )}

            {/* Active Ticket Destination Marker */}
            {hasActiveTicket && establishmentCoords && (
              <Marker
                coordinate={establishmentCoords}
                title={activeTicket?.establishment?.name || "Destination"}
                description={activeTicket?.service?.name || ""}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: colors.danger,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 3,
                    borderColor: '#FFFFFF',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.3,
                    shadowRadius: 4,
                    elevation: 4,
                  }}
                >
                  <Ionicons name="business" size={20} color="#FFFFFF" />
                </View>
              </Marker>
            )}

            {!location ||
            isNaN(Number(location.latitude)) ||
            isNaN(Number(location.longitude)) ? null : (
              <Marker
                coordinate={{
                  latitude: Number(location.latitude),
                  longitude: Number(location.longitude),
                }}
                pinColor={colors.primary}
              />
            )}
          </MapView>
        )}

        {/* Floating actions on map */}
        <View style={{ position: "absolute", right: 20, top: 20 }}>
          {/* Navigation Button - Shows when active ticket with coordinates */}
          {hasActiveTicket && establishmentCoords && (
            <TouchableOpacity
              onPress={() => router.push('/navigation')}
              style={{
                width: 56,
                height: 56,
                backgroundColor: colors.primary,
                borderRadius: 28,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4,
                shadowRadius: 12,
                elevation: 8,
                marginBottom: 12,
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="navigate" size={28} color="#FFFFFF" />
              {distanceInfo && (
                <View
                  style={{
                    position: 'absolute',
                    bottom: -4,
                    backgroundColor: colors.surface,
                    borderRadius: 8,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary }}>
                    {Math.round(distanceInfo.kilometers * 10) / 10}km
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={recenter}
            style={{ width: 48, height: 48, backgroundColor: colors.surface, borderRadius: 999, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8, marginBottom: 12 }}
          >
            <Ionicons name="locate" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Indicateur de chargement */}
        {isLoading && (
          <View style={{ position: 'absolute', inset: 0, backgroundColor: colors.surface + '99', alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}
      </View>
      {/* Liste des établissements (always visible below map) */}
      <View
        style={{
          flex: 1,
          backgroundColor: colors.surface,
          paddingTop: 16,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          marginTop: -150,
          elevation: 15,
          shadowColor: "#000",
          borderWidth: 1,
          borderColor: colors.border,
          shadowOffset: { width: 0, height: -5 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
        }}
      >
        <View style={{ paddingHorizontal: 20, paddingVertical: 12, paddingBottom: 15, marginBottom: 8, backgroundColor: colors.surfaceSecondary, borderRadius: 20, overflow: 'hidden', width: '92%', alignSelf: 'center' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, flex: 1, marginRight: 12 }} numberOfLines={1}>
              Établissements
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 0 }}>
              <TouchableOpacity
                onPress={() => { forceRefresh(); loadEstablishments(true); }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 50,
                  backgroundColor: 'red',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 8,
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh" size={18} color={'white'} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowSortModal(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: colors.primary,
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="funnel-outline" size={14} color={'white'} style={{ marginRight: 4 }} />
                <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>Trier</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={{ fontSize: 14, color: colors.textTertiary,marginTop:-8, }}>
            {filteredEstablishments.length} résultats trouvés
          </Text>
        </View>

        <FlatList
          data={filteredEstablishments}
          renderItem={renderEstablishment}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          ItemSeparatorComponent={() => (
            <View style={{ height: 1, backgroundColor: colors.border, width: '80%' ,alignSelf:"center", }} />
          )}
          ListHeaderComponent={
            isInitialized && hasActiveTicket && activeTicket ? (
              <View className="mb-4">
                <ActiveTicketCard
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/live-ticket",
                      params: { ticketId: String(activeTicket.id) },
                    })
                  }
                />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View className="py-10 items-center px-10">
              <Ionicons
                name="search-outline"
                size={48}
                color={colors.textTertiary}
              />
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, marginTop: 16, textAlign: 'center' }}>
                Aucun établissement
              </Text>
              <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 8, paddingHorizontal: 20 }}>
                Essayez de modifier votre recherche
              </Text>
            </View>
          }
        />
      </View>

      {/* Sort Modal */}
      <Modal
        visible={showSortModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSortModal(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          activeOpacity={1}
          onPress={() => setShowSortModal(false)}
        >
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.textPrimary }}>Trier par</Text>
              <TouchableOpacity onPress={() => setShowSortModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: colors.border }}
              onPress={() => { setSortOption("default"); setShowSortModal(false); }}
            >
              <Ionicons name="list-outline" size={20} color={sortOption === "default" ? colors.primary : colors.textSecondary} />
              <Text style={{ marginLeft: 12, fontSize: 16, color: sortOption === "default" ? colors.primary : colors.textPrimary, fontWeight: sortOption === "default" ? '600' : '400' }}>
                Par défaut
              </Text>
              {sortOption === "default" && <Ionicons name="checkmark" size={20} color={colors.primary} style={{ marginLeft: 'auto' }} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: colors.border }}
              onPress={() => { setSortOption("distance"); setShowSortModal(false); }}
            >
              <Ionicons name="navigate-outline" size={20} color={sortOption === "distance" ? colors.primary : colors.textSecondary} />
              <Text style={{ marginLeft: 12, fontSize: 16, color: sortOption === "distance" ? colors.primary : colors.textPrimary, fontWeight: sortOption === "distance" ? '600' : '400' }}>
                Distance
              </Text>
              {sortOption === "distance" && <Ionicons name="checkmark" size={20} color={colors.primary} style={{ marginLeft: 'auto' }} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: colors.border }}
              onPress={() => { setSortOption("name"); setShowSortModal(false); }}
            >
              <Ionicons name="text-outline" size={20} color={sortOption === "name" ? colors.primary : colors.textSecondary} />
              <Text style={{ marginLeft: 12, fontSize: 16, color: sortOption === "name" ? colors.primary : colors.textPrimary, fontWeight: sortOption === "name" ? '600' : '400' }}>
                Nom (A-Z)
              </Text>
              {sortOption === "name" && <Ionicons name="checkmark" size={20} color={colors.primary} style={{ marginLeft: 'auto' }} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16 }}
              onPress={() => { setSortOption("crowd_level"); setShowSortModal(false); }}
            >
              <Ionicons name="people-outline" size={20} color={sortOption === "crowd_level" ? colors.primary : colors.textSecondary} />
              <Text style={{ marginLeft: 12, fontSize: 16, color: sortOption === "crowd_level" ? colors.primary : colors.textPrimary, fontWeight: sortOption === "crowd_level" ? '600' : '400' }}>
                Niveau d&apos;affluence
              </Text>
              {sortOption === "crowd_level" && <Ionicons name="checkmark" size={20} color={colors.primary} style={{ marginLeft: 'auto' }} />}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {AlertComponent}
    </View>
  );
};

// Styles
export default ExploreScreen;
