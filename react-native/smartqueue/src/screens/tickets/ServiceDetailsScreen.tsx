import React, { useState, useEffect, useCallback, useRef, ReactNode } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  Image,
  Share,
  Animated,
  Dimensions,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Theme } from "../../theme";
import { useThemeColors } from "../../hooks/useThemeColors";
import { establishmentsApi, Establishment } from "../../api/establishmentsApi";
import { ticketsApi } from "../../api/ticketsApi";
import { useAuth } from "../../store/authStore";
import { useTicket } from "../../store/ticketStore";
import { useSimpleNotification } from "../../hooks/useSimpleNotification";
import { useDistanceTracking } from "../../hooks/useDistanceTracking";
import { useCustomAlert } from "../../hooks/useCustomAlert";
import { formatDistance, formatTravelTime } from "../../utils/distance";
import { getApiErrorMessage } from "../../utils/errors";

const { width, height } = Dimensions.get("window");

interface ServiceData {
  description: ReactNode;
  id: number;
  name: string;
  status: string;
  avg_service_time_minutes: number;
  people_waiting: number;
}

interface EstablishmentData extends Omit<Establishment, "services"> {
  total_people_waiting?: number;
  services?: ServiceData[];
}

// Composant Stat Card
const StatCard: React.FC<{
  icon: string;
  value: string | number;
  label: string;
  color: string;
  colors: any;
}> = ({ icon, value, label, color, colors }) => (
  <View style={[styles.statCard, { backgroundColor: color + "10", borderColor: color + "30" }]}>
    <Ionicons name={icon as any} size={22} color={color} />
    <Text style={[styles.statValue, { color: colors.textPrimary }]}>{value}</Text>
    <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{label}</Text>
  </View>
);

// Composant Service Item
const ServiceItem: React.FC<{
  service: ServiceData;
  isSelected: boolean;
  colors: any;
  onSelect: () => void;
}> = ({ service, isSelected, colors, onSelect }) => (
  <TouchableOpacity
    style={[
      styles.serviceItem,
      {
        backgroundColor: isSelected ? colors.primary + "10" : colors.surfaceSecondary,
        borderColor: isSelected ? colors.primary + "40" : colors.border,
      },
    ]}
    onPress={onSelect}
    activeOpacity={0.7}
  >
    <View style={styles.serviceContent}>
      <View style={styles.serviceHeader}>
        <Text style={[styles.serviceName, { color: isSelected ? colors.primary : colors.textPrimary }]}>
          {service.name}
        </Text>
        {service.status === "open" && (
          <View style={[styles.openBadge, { backgroundColor: colors.success + "15" }]}>
            <Text style={[styles.openBadgeText, { color: colors.success }]}>Ouvert</Text>
          </View>
        )}
      </View>
      
      {service.description && (
        <Text style={[styles.serviceDescription, { color: colors.textSecondary }]} numberOfLines={2}>
          {service.description}
        </Text>
      )}
      
      <View style={styles.serviceStats}>
        <View style={styles.serviceStat}>
          <Ionicons name="people-outline" size={12} color={colors.textTertiary} />
          <Text style={[styles.serviceStatText, { color: colors.textTertiary }]}>
            {service.people_waiting ?? 0} en attente
          </Text>
        </View>
        {service.avg_service_time_minutes > 0 && (
          <View style={styles.serviceStat}>
            <Ionicons name="time-outline" size={12} color={colors.textTertiary} />
            <Text style={[styles.serviceStatText, { color: colors.textTertiary }]}>
              ~{service.avg_service_time_minutes} min
            </Text>
          </View>
        )}
      </View>
    </View>
    
    {isSelected && (
      <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
    )}
  </TouchableOpacity>
);

// Composant Info Row
const InfoRow: React.FC<{
  icon: string;
  label: string;
  value: string;
  color: string;
  colors: any;
  onPress?: () => void;
}> = ({ icon, label, value, color, colors, onPress }) => (
  <TouchableOpacity
    style={[styles.infoRow, { borderBottomColor: colors.border }]}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={0.7}
  >
    <View style={[styles.infoIcon, { backgroundColor: color + "15" }]}>
      <Ionicons name={icon as any} size={20} color={color} />
    </View>
    <View style={styles.infoContent}>
      <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{value}</Text>
    </View>
    {onPress && <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />}
  </TouchableOpacity>
);

// Fonction pour calculer le temps en moto (environ 30% plus rapide que voiture)
const getMotorcycleTime = (carMinutes: number): number => {
  return Math.round(carMinutes * 0.7);
};

export const ServiceDetailsScreen: React.FC = () => {
  const params = useLocalSearchParams();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const establishmentId = Number(params.establishmentId);
  const serviceId = params.serviceId ? Number(params.serviceId) : undefined;
  const fromQr = params.fromQr === "true";
  const { isAuthenticated } = useAuth();
  const { hasActiveTicket, activeTicket, fetchActiveTicket, isInitialized } = useTicket();
  const { AlertComponent, showError, showInfo, showWarning } = useCustomAlert();
  const { notifyTicketCreated, notifyCrowdLevelChange } = useSimpleNotification();

  const [establishment, setEstablishment] = useState<EstablishmentData | null>(null);
  const [services, setServices] = useState<ServiceData[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(serviceId || null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 7, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchActiveTicket().catch(err => console.error("Error fetching active ticket:", err));
    }
  }, [fetchActiveTicket, isAuthenticated]);

  const { distanceInfo, hasPermission: hasLocationPermission } = useDistanceTracking({
    targetCoordinates: establishment && establishment.lat != null && establishment.lng != null
      ? { latitude: establishment.lat, longitude: establishment.lng }
      : null,
    enabled: !!establishment && establishment.lat != null && establishment.lng != null,
  });

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [estData, servicesData] = await Promise.all([
        establishmentsApi.getEstablishment(establishmentId),
        establishmentsApi.getEstablishmentServices(establishmentId),
      ]);
      setEstablishment(estData as EstablishmentData);
      const servicesList = estData.services || servicesData || [];
      setServices(Array.isArray(servicesList) ? servicesList : (servicesList as any)?.data || []);
      
      if (!serviceId && servicesList && (servicesList as unknown as ServiceData[]).length > 0) {
        const firstOpen = (servicesList as unknown as ServiceData[]).find(s => s.status === "open");
        if (firstOpen) setSelectedServiceId(firstOpen.id);
      }
    } catch (error) {
      console.error("Error loading establishment:", error);
      showError("Erreur", "Impossible de charger les détails de l'établissement.");
    } finally {
      setIsLoading(false);
    }
  }, [establishmentId, serviceId, showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleJoinQueue = async () => {
    if (!isAuthenticated) {
      showInfo("Connexion requise", "Vous devez être connecté pour rejoindre une file.", "Se connecter", () => router.push("/onboarding"));
      return;
    }

    if (!isInitialized) {
      showInfo("Chargement", "Vérification de vos tickets en cours...", "OK", () => {});
      return;
    }

    if (!selectedServiceId) {
      showError("Sélection requise", "Veuillez choisir un service avant de rejoindre la file.");
      return;
    }

    const hasTicketOnThisService = activeTicket?.service_id === selectedServiceId;

    if (isInitialized && hasTicketOnThisService && hasActiveTicket && activeTicket) {
      showWarning(
        "Ticket actif",
        "Vous avez déjà un ticket actif pour ce service.",
        "Voir mon ticket",
        () => router.push({ pathname: "/(tabs)/live-ticket", params: { ticketId: String(activeTicket.id) } }),
        "Annuler",
      );
      return;
    }

    setIsJoining(true);
    try {
      const ticket = await ticketsApi.createTicket({
        establishment_id: establishmentId,
        service_id: selectedServiceId,
        from_qr: fromQr,
        lat: establishment?.lat ? Number(establishment.lat) : undefined,
        lng: establishment?.lng ? Number(establishment.lng) : undefined,
      });

      const ticketData = (ticket as any)?.data || ticket;
      await fetchActiveTicket();
      notifyTicketCreated(ticketData.number, ticketData.establishment?.name || establishment?.name || "Établissement");

      router.push({ pathname: "/(tabs)/live-ticket", params: { ticketId: String(ticketData.id) } });
    } catch (error: any) {
      showError("Erreur", getApiErrorMessage(error, "Impossible de rejoindre la file."));
    } finally {
      setIsJoining(false);
    }
  };

  const handleGetDirections = () => {
    if (!establishment) return;
    const { lat, lng, address } = establishment;
    const url = Platform.OS === "ios"
      ? `maps:0,0?q=${address}&ll=${lat},${lng}`
      : `geo:${lat},${lng}?q=${address}`;
    Linking.openURL(url);
  };

  const handleShare = async () => {
    if (!establishment) return;
    try {
      await Share.share({
        title: establishment.name,
        message: `Rejoignez la file d'attente virtuelle de ${establishment.name} sur SmartQueue!`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  // Calcul du temps moto
  const getMotorcycleTravelTime = () => {
    if (!distanceInfo?.travelTimes?.car) return null;
    const motorcycleMinutes = getMotorcycleTime(distanceInfo.travelTimes.car);
    return formatTravelTime(motorcycleMinutes);
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!establishment) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Image avec overlay */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=800&q=80" }}
          style={styles.headerImage}
          resizeMode="cover"
        />
        <LinearGradient
          colors={["rgba(0,0,0,0.4)", "rgba(0,0,0,0.2)", "transparent"]}
          style={styles.imageOverlay}
        />
        
        {/* Boutons header */}
        <View style={[styles.headerButtons, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: "rgba(0,0,0,0.5)" }]}
            onPress={() => fromQr ? router.replace("/") : router.back()}
          >
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: "rgba(0,0,0,0.5)" }]}
            onPress={handleShare}
          >
            <Ionicons name="share-outline" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content Container avec coins du haut arrondis */}
      <View style={[styles.contentContainer, { backgroundColor: colors.background }]}>
        <Animated.ScrollView
          style={[styles.scrollContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContentContainer}
        >
          {/* Header Info */}
          <View style={styles.infoHeader}>
            <Text style={[styles.establishmentName, { color: colors.textPrimary }]}>
              {establishment.name}
            </Text>
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={14} color={colors.textTertiary} />
              <Text style={[styles.addressText, { color: colors.textSecondary }]}>
                {establishment.address}
              </Text>
            </View>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <StatCard
              icon="people-outline"
              value={establishment.total_people_waiting ?? 0}
              label="En file"
              color={colors.warning}
              colors={colors}
            />
            <StatCard
              icon="business-outline"
              value={services.length}
              label="Services"
              color={colors.primary}
              colors={colors}
            />
            <StatCard
              icon="checkmark-circle-outline"
              value={services.filter(s => s.status === "open").length}
              label="Actifs"
              color={colors.success}
              colors={colors}
            />
          </View>

          {/* Distance Section - AVEC MOTO */}
          {distanceInfo && hasLocationPermission && (
            <View style={styles.distanceSectionWrapper}>
              <View style={[styles.distanceSection, { backgroundColor: colors.primary + "08" }]}>
                <View style={styles.distanceSectionHeader}>
                  <Ionicons name="navigate-circle" size={20} color={colors.primary} />
                  <Text style={[styles.distanceSectionTitle, { color: colors.textPrimary }]}>Distance & trajet</Text>
                </View>
                
                <View style={styles.distanceItemsContainer}>
                  {/* Distance */}
                  <View style={styles.distanceItemCentered}>
                    <View style={[styles.distanceIconCircle, { backgroundColor: colors.primary + "15" }]}>
                      <Ionicons name="location" size={22} color={colors.primary} />
                    </View>
                    <Text style={[styles.distanceValueCentered, { color: colors.textPrimary }]}>
                      {formatDistance(distanceInfo.kilometers)}
                    </Text>
                    <Text style={[styles.distanceLabelCentered, { color: colors.textTertiary }]}>Distance</Text>
                  </View>

                  {/* Séparateur */}
                  <View style={[styles.distanceSeparator, { backgroundColor: colors.border }]} />

                  {/* À pied */}
                  <View style={styles.distanceItemCentered}>
                    <View style={[styles.distanceIconCircle, { backgroundColor: colors.success + "15" }]}>
                      <Ionicons name="walk" size={22} color={colors.success} />
                    </View>
                    <Text style={[styles.distanceValueCentered, { color: colors.textPrimary }]}>
                      {formatTravelTime(distanceInfo.travelTimes.walking)}
                    </Text>
                    <Text style={[styles.distanceLabelCentered, { color: colors.textTertiary }]}>À pied</Text>
                  </View>

                  {/* Séparateur */}
                  <View style={[styles.distanceSeparator, { backgroundColor: colors.border }]} />

                  {/* Voiture */}
                  <View style={styles.distanceItemCentered}>
                    <View style={[styles.distanceIconCircle, { backgroundColor: colors.warning + "15" }]}>
                      <Ionicons name="car" size={22} color={colors.warning} />
                    </View>
                    <Text style={[styles.distanceValueCentered, { color: colors.textPrimary }]}>
                      {formatTravelTime(distanceInfo.travelTimes.car)}
                    </Text>
                    <Text style={[styles.distanceLabelCentered, { color: colors.textTertiary }]}>Voiture</Text>
                  </View>

                  {/* Séparateur */}
                  <View style={[styles.distanceSeparator, { backgroundColor: colors.border }]} />

                  {/* Moto */}
                  <View style={styles.distanceItemCentered}>
                    <View style={[styles.distanceIconCircle, { backgroundColor: colors.secondary + "15" }]}>
                      <Ionicons name="bicycle" size={22} color={colors.secondary} />
                    </View>
                    <Text style={[styles.distanceValueCentered, { color: colors.textPrimary }]}>
                      {getMotorcycleTravelTime() || "—"}
                    </Text>
                    <Text style={[styles.distanceLabelCentered, { color: colors.textTertiary }]}>Moto</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Services Section */}
          {services.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Services disponibles</Text>
              {services.map((service) => (
                <ServiceItem
                  key={service.id}
                  service={service}
                  isSelected={selectedServiceId === service.id}
                  colors={colors}
                  onSelect={() => setSelectedServiceId(service.id)}
                />
              ))}
            </View>
          )}

          {/* Join Button */}
          <TouchableOpacity
            style={[
              styles.joinButton,
              { backgroundColor: isJoining ? colors.primary + "80" : colors.primary },
            ]}
            onPress={handleJoinQueue}
            disabled={isJoining}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              style={styles.joinButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {isJoining ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="enter-outline" size={22} color="#FFF" />
                  <Text style={styles.joinButtonText}>Rejoindre la file</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Informations */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Informations</Text>
            <View style={[styles.infoCard, { backgroundColor: colors.surfaceSecondary }]}>
              <InfoRow
                icon="call-outline"
                label="Téléphone"
                value={(establishment as any).phone || "+229 XX XXX XXXX"}
                color={colors.primary}
                colors={colors}
                onPress={() => Linking.openURL(`tel:${(establishment as any).phone || ""}`)}
              />
              <InfoRow
                icon="globe-outline"
                label="Site web"
                value={(establishment as any).website || "www.smartqueue.com"}
                color={colors.secondary}
                colors={colors}
                onPress={() => (establishment as any).website && Linking.openURL((establishment as any).website)}
              />
              <InfoRow
                icon="time-outline"
                label="Horaires"
                value={`${establishment.open_at || "08:00"} - ${establishment.close_at || "18:00"}`}
                color={colors.warning}
                colors={colors}
              />
            </View>
          </View>

          <View style={styles.bottomSpace} />
        </Animated.ScrollView>
      </View>

      {AlertComponent}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  imageContainer: {
    height: height * 0.3,
    position: "relative",
  },
  headerImage: {
    width: "100%",
    height: "100%",
  },
  imageOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  headerButtons: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  // Conteneur avec coins du haut arrondis
  contentContainer: {
    flex: 1,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    marginTop: -20,
    overflow: "hidden",
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 40,
  },
  infoHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  establishmentName: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 6,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  addressText: {
    fontSize: 13,
    flex: 1,
  },
  statsGrid: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    marginTop: 6,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  distanceSectionWrapper: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  distanceSection: {
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  distanceSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  distanceSectionTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  distanceItemsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    flexWrap: "wrap",
  },
  distanceItemCentered: {
    alignItems: "center",
    flex: 1,
    minWidth: 70,
  },
  distanceIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  distanceValueCentered: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  distanceLabelCentered: {
    fontSize: 10,
    fontWeight: "500",
  },
  distanceSeparator: {
    width: 1,
    height: 40,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  serviceItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  serviceContent: {
    flex: 1,
  },
  serviceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  serviceName: {
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },
  openBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  openBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  serviceDescription: {
    fontSize: 13,
    marginBottom: 8,
  },
  serviceStats: {
    flexDirection: "row",
    gap: 12,
  },
  serviceStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  serviceStatText: {
    fontSize: 11,
  },
  joinButton: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  joinButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  joinButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  infoCard: {
    borderRadius: 16,
    overflow: "hidden",
    marginHorizontal: 1,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 0.5,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  bottomSpace: {
    height: 20,
  },
});

export default ServiceDetailsScreen;