import React, { useState, useEffect, useCallback, useRef, ReactNode } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  Share,
  Animated,
  Dimensions,
  StyleSheet,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Theme } from "../../theme";
import { useThemeColors } from "../../hooks/useThemeColors";
import { establishmentsApi, Establishment, AffluenceData, ServiceReviewsResponse, ServiceReview } from "../../api/establishmentsApi";
import { ticketsApi } from "../../api/ticketsApi";
import { useAuth } from "../../store/authStore";
import { useTicket } from "../../store/ticketStore";
import { useSimpleNotification } from "../../hooks/useSimpleNotification";
import { useDistanceTracking } from "../../hooks/useDistanceTracking";
import { useCustomAlert } from "../../hooks/useCustomAlert";
import { formatDistance, formatTravelTime } from "../../utils/distance";
import { getApiErrorMessage } from "../../utils/errors";
import { CustomActionSheet } from "../../components/ui/CustomActionSheet";
import { CustomAlert } from "../../components/ui/CustomAlert";

const { width, height } = Dimensions.get("window");

interface WorkingDay {
  day_of_week: number;  // 1=Lundi … 7=Dimanche (ISO)
  is_open: boolean;
  opening_time?: string | null;
  closing_time?: string | null;
}

interface ServiceData {
  description: ReactNode;
  id: number;
  name: string;
  status: string;
  avg_service_time_minutes: number;
  people_waiting: number;
  opening_time?: string;
  closing_time?: string;
  working_days?: WorkingDay[];
}

interface EstablishmentData extends Omit<Establishment, "services"> {
  total_people_waiting?: number;
  services?: ServiceData[];
  opening_time?: string;
  closing_time?: string;
}

interface Option {
  label: string;
  value: string | number;
  icon?: keyof typeof Ionicons.glyphMap;
  description?: string;
  section?: string;
  type?: 'status' | 'hours' | 'day' | 'info';
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
  onAffluence?: () => void;
}> = ({ service, isSelected, colors, onSelect, onAffluence }) => (
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
        <View style={styles.serviceHeaderRight}>
          {service.status === "open" && (
            <View style={[styles.openBadge, { backgroundColor: colors.success + "15" }]}>
              <Text style={[styles.openBadgeText, { color: colors.success }]}>Ouvert</Text>
            </View>
          )}
          {service.status === "closed" && (
            <View style={[styles.openBadge, { backgroundColor: colors.danger + "15" }]}>
              <Text style={[styles.openBadgeText, { color: colors.danger }]}>Fermé</Text>
            </View>
          )}
        </View>
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
        {onAffluence && (
          <TouchableOpacity style={[styles.affluenceChip, { backgroundColor: colors.warning + "15" }]} onPress={(e) => { e.stopPropagation?.(); onAffluence(); }}>
            <Ionicons name="pulse-outline" size={11} color={colors.warning} />
            <Text style={[styles.affluenceChipText, { color: colors.warning }]}>Voir l’affluence</Text>
          </TouchableOpacity>
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

// Fonction pour formater l'heure (ex: "08:00:00" -> "08:00")
const formatTimeDisplay = (timeStr?: string | null): string => {
  if (!timeStr) return "--:--";
  return timeStr.substring(0, 5);
};

// Traduction des jours
const getDayName = (dayOfWeek: number): string => {
  const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  return days[dayOfWeek - 1];
};

const getEstablishmentIcon = (name: string): keyof typeof Ionicons.glyphMap => {
  const n = name.toLowerCase();
  if (n.includes("banque") || n.includes("boa") || n.includes("finan") || n.includes("caisse") || n.includes("crédit")) return "business-outline";
  if (n.includes("hopital") || n.includes("clinique") || n.includes("santé") || n.includes("medical") || n.includes("cabinet")) return "medical-outline";
  if (n.includes("mtn") || n.includes("orange") || n.includes("telecom") || n.includes("mobile")) return "phone-portrait-outline";
  if (n.includes("école") || n.includes("université") || n.includes("lycee") || n.includes("formation") || n.includes("fac")) return "school-outline";
  if (n.includes("mairie") || n.includes("préfecture") || n.includes("municipal")) return "business-outline";
  if (n.includes("marché") || n.includes("commer") || n.includes("boutique") || n.includes("shop") || n.includes("magasin")) return "cart-outline";
  if (n.includes("restau") || n.includes("café") || n.includes("bar") || n.includes("snack") || n.includes("fast")) return "restaurant-outline";
  return "business-outline";
};

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
  const { hasActiveTicket, activeTicket, activeTickets, fetchActiveTicket, isInitialized } = useTicket();
  const { AlertComponent, showError, showInfo, showWarning, showSuccess } = useCustomAlert();
  const { notifyTicketCreated, notifyCrowdLevelChange } = useSimpleNotification();

  const [establishment, setEstablishment] = useState<EstablishmentData | null>(null);
  const [services, setServices] = useState<ServiceData[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(serviceId || null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [showScheduleSheet, setShowScheduleSheet] = useState(false);
  const [showConfirmAlert, setShowConfirmAlert] = useState(false);
  const [selectedServiceForSchedule, setSelectedServiceForSchedule] = useState<ServiceData | null>(null);

  const [affluenceData, setAffluenceData] = useState<AffluenceData | null>(null);
  const [affluenceLoading, setAffluenceLoading] = useState(false);
  const [showAffluenceSheet, setShowAffluenceSheet] = useState(false);

  const [reviewsData, setReviewsData] = useState<ServiceReviewsResponse | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);

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

  const loadAffluence = useCallback(async (serviceId: number) => {
    setAffluenceLoading(true);
    try {
      const data = await establishmentsApi.getServiceAffluence(serviceId);
      setAffluenceData(data);
      setShowAffluenceSheet(true);
    } catch (err) {
      showError("Erreur", "Impossible de charger l'affluence.");
    } finally {
      setAffluenceLoading(false);
    }
  }, [showError]);

  const loadReviews = useCallback(async () => {
    const sid = selectedServiceId || services[0]?.id;
    if (!sid) return;
    setReviewsLoading(true);
    try {
      const data = await establishmentsApi.getServiceReviews(sid);
      setReviewsData(data);
    } catch (err) {
      console.warn("[ServiceDetails] Erreur chargement avis:", err);
    } finally {
      setReviewsLoading(false);
    }
  }, [selectedServiceId, services]);

  useEffect(() => {
    if (services.length > 0) loadReviews();
  }, [loadReviews, services.length, selectedServiceId]);

  // Récupérer le service sélectionné pour afficher ses horaires
  useEffect(() => {
    if (selectedServiceId) {
      const service = services.find(s => s.id === selectedServiceId);
      setSelectedServiceForSchedule(service || null);
    }
  }, [selectedServiceId, services]);

  // Fonction pour rejoindre la file avec confirmation
  const confirmJoinQueue = () => {
    setShowConfirmAlert(true);
  };

  // Exécution réelle de la rejointe de file
  const executeJoinQueue = async () => {
    setShowConfirmAlert(false);
    
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

    const ACTIVE_STATUSES = ['waiting', 'called', 'en_route', 'present'];
    const existingTicket = activeTickets.find(
      t => t.service_id === selectedServiceId && ACTIVE_STATUSES.includes(t.status)
    );

    if (isInitialized && existingTicket) {
      showWarning(
        "Ticket déjà actif",
        `Vous avez déjà un ticket actif pour ce service (N° ${existingTicket.number}). Vous ne pouvez pas en créer un nouveau.`,
        "Voir mon ticket",
        () => router.push({ pathname: "/(tabs)/live-ticket", params: { ticketId: String(existingTicket.id) } }),
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
      notifyTicketCreated(ticketData.number, ticketData.establishment?.name || establishment?.name || "Établissement", ticketData.id);

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

  // Construction des options pour l'action sheet des horaires
  const getScheduleOptions = (): Option[] => {
    const options: Option[] = [];

    const target = selectedServiceForSchedule || establishment;
    if (!target) return [];

    // Horaires généraux du service — défaut 08:00-18:00 si non configuré
    const generalOpen  = (target as any).opening_time || (target as any).open_at  || '08:00:00';
    const generalClose = (target as any).closing_time || (target as any).close_at || '18:00:00';

    // Statut actuel : un service a un statut ; un établissement n'en a pas
    // (il était toujours affiché « Fermé ») → déduit de ses horaires du jour.
    const nowHHMM = new Date().toTimeString().slice(0, 5);
    const isOpen = "status" in target && target.status
      ? target.status === "open"
      : nowHHMM >= String(generalOpen).slice(0, 5) && nowHHMM < String(generalClose).slice(0, 5);
    options.push({
      label: isOpen ? "Ouvert maintenant" : "Fermé maintenant",
      value: 'status',
      icon: isOpen ? 'checkmark-circle' : 'close-circle',
      type: 'status',
      section: 'status',
    });

    // Horaires généraux
    options.push({
      label: `Horaire général : ${formatTimeDisplay(generalOpen)} - ${formatTimeDisplay(generalClose)}`,
      value: 'hours',
      icon: 'time-outline',
      type: 'hours',
      section: 'hours',
    });

    // Temps de service moyen
    if ((target as any).avg_service_time_minutes) {
      options.push({
        label: `Temps moyen : ~${(target as any).avg_service_time_minutes} min par ticket`,
        value: 'avg_time',
        icon: 'timer-outline',
        type: 'hours',
        section: 'hours',
      });
    }

    // File d'attente
    if ((target as any).people_waiting !== undefined) {
      options.push({
        label: `${(target as any).people_waiting || 0} personne(s) en attente pour ce service`,
        value: 'waiting',
        icon: 'people-outline',
        type: 'info',
        section: 'info',
      });
    }
    if (establishment?.total_people_waiting !== undefined) {
      options.push({
        label: `${establishment.total_people_waiting || 0} personne(s) au total dans l'établissement`,
        value: 'total_waiting',
        icon: 'business-outline',
        type: 'info',
        section: 'info',
      });
    }

    // Index des working_days par numéro de jour (1-7)
    const workingDays: WorkingDay[] = (selectedServiceForSchedule as any)?.working_days || [];
    const wdMap: Record<number, WorkingDay> = {};
    workingDays.forEach(wd => { wdMap[wd.day_of_week] = wd; });

    const weekDays = [
      { day: 1, name: 'Lundi' },
      { day: 2, name: 'Mardi' },
      { day: 3, name: 'Mercredi' },
      { day: 4, name: 'Jeudi' },
      { day: 5, name: 'Vendredi' },
      { day: 6, name: 'Samedi' },
      { day: 7, name: 'Dimanche' },
    ];

    weekDays.forEach(({ day, name }) => {
      const wd = wdMap[day];

      if (wd) {
        // Entrée configurée pour ce jour
        if (!wd.is_open) {
          options.push({
            label: `${name} : Fermé`,
            value: `day_${day}`,
            icon: 'close-circle-outline',
            type: 'day',
            section: 'days',
          });
        } else {
          // Horaire du jour ou fallback général (garanti non-null)
          const open  = wd.opening_time  || generalOpen;
          const close = wd.closing_time || generalClose;
          options.push({
            label: `${name} : ${formatTimeDisplay(open)} - ${formatTimeDisplay(close)}`,
            value: `day_${day}`,
            icon: 'calendar-outline',
            type: 'day',
            section: 'days',
          });
        }
      } else if (workingDays.length > 0) {
        // working_days définis mais ce jour absent → fermé
        options.push({
          label: `${name} : Fermé`,
          value: `day_${day}`,
          icon: 'close-circle-outline',
          type: 'day',
          section: 'days',
        });
      } else {
        // Aucun working_day configuré → horaire général (toujours défini)
        options.push({
          label: `${name} : ${formatTimeDisplay(generalOpen)} - ${formatTimeDisplay(generalClose)}`,
          value: `day_${day}`,
          icon: 'calendar-outline',
          type: 'day',
          section: 'days',
        });
      }
    });

    return options;
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
      {/* Header avec gradient et icône */}
      <View style={styles.imageContainer}>
        <LinearGradient
          colors={[colors.primary, colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        >
          <Ionicons
            name={getEstablishmentIcon(establishment.name)}
            size={120}
            color="rgba(255,255,255,0.08)"
            style={styles.headerBgIcon}
          />
        </LinearGradient>

        <View style={styles.headerContent}>
          <Text style={styles.headerEstablishmentName} numberOfLines={2}>
            {establishment.name}
          </Text>
          {establishment.address && (
            <View style={styles.headerAddressRow}>
              <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.7)" />
              <Text style={styles.headerAddress} numberOfLines={1}>{establishment.address}</Text>
            </View>
          )}
        </View>

        {/* Boutons header */}
        <View style={[styles.headerButtons, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: "rgba(255,255,255,0.2)" }]}
            onPress={() => fromQr ? router.replace("/") : router.push("/(tabs)")}
          >
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: "rgba(255,255,255,0.2)" }]}
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
                  onAffluence={() => loadAffluence(service.id)}
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
            onPress={confirmJoinQueue}
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
                label="Horaires & disponibilités"
                value="Voir les détails"
                color={colors.warning}
                colors={colors}
                onPress={() => setShowScheduleSheet(true)}
              />
            </View>
          </View>

          {/* Avis des usagers */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Avis des usagers</Text>
              {reviewsData && (
                <View style={styles.avgRatingBadge}>
                  <Ionicons name="star" size={14} color={colors.warning} />
                  <Text style={[styles.avgRatingText, { color: colors.textPrimary }]}>{reviewsData.avg_rating}</Text>
                  <Text style={[styles.avgRatingTotal, { color: colors.textTertiary }]}> ({reviewsData.total})</Text>
                </View>
              )}
            </View>

            {reviewsLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
            ) : reviewsData && reviewsData.reviews.length > 0 ? (
              <>
                {/* Distribution des notes */}
                <View style={[styles.ratingDistContainer, { backgroundColor: colors.surfaceSecondary }]}>
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = reviewsData.distribution[star] ?? 0;
                    const pct = reviewsData.total > 0 ? (count / reviewsData.total) * 100 : 0;
                    return (
                      <View key={star} style={styles.ratingDistRow}>
                        <Text style={[styles.ratingDistLabel, { color: colors.textSecondary }]}>{star}</Text>
                        <Ionicons name="star" size={12} color={colors.warning} />
                        <View style={[styles.ratingDistBar, { backgroundColor: colors.border }]}>
                          <View style={[styles.ratingDistFill, { width: `${pct}%`, backgroundColor: colors.warning }]} />
                        </View>
                        <Text style={[styles.ratingDistCount, { color: colors.textTertiary }]}>{count}</Text>
                      </View>
                    );
                  })}
                </View>

                {/* Liste des avis */}
                {reviewsData.reviews.slice(0, 5).map((review) => (
                  <View key={review.id} style={[styles.reviewItem, { borderBottomColor: colors.border }]}>
                    <View style={styles.reviewHeader}>
                      <View style={[styles.reviewAvatar, { backgroundColor: colors.primary + "20" }]}>
                        <Ionicons name="person" size={14} color={colors.primary} />
                      </View>
                      <View style={styles.reviewUserInfo}>
                        <Text style={[styles.reviewUserName, { color: colors.textPrimary }]}>
                          {review.user?.name || "Anonyme"}
                        </Text>
                        <Text style={[styles.reviewDate, { color: colors.textTertiary }]}>
                          {new Date(review.created_at).toLocaleDateString("fr-FR")}
                        </Text>
                      </View>
                      <View style={styles.reviewStars}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Ionicons
                            key={s}
                            name={s <= review.rating ? "star" : "star-outline"}
                            size={12}
                            color={s <= review.rating ? colors.warning : colors.textTertiary}
                          />
                        ))}
                      </View>
                    </View>
                    {review.comment && (
                      <Text style={[styles.reviewComment, { color: colors.textSecondary }]} numberOfLines={3}>
                        {review.comment}
                      </Text>
                    )}
                  </View>
                ))}
              </>
            ) : (
              <View style={styles.emptyReviews}>
                <Ionicons name="chatbubble-ellipses-outline" size={32} color={colors.textTertiary} />
                <Text style={[styles.emptyReviewsText, { color: colors.textSecondary }]}>
                  Aucun avis pour le moment
                </Text>
              </View>
            )}
          </View>

          <View style={styles.bottomSpace} />
        </Animated.ScrollView>
      </View>

      {/* Action Sheet pour les horaires */}
      <CustomActionSheet
        visible={showScheduleSheet}
        title={`Horaires - ${selectedServiceForSchedule?.name || establishment?.name || "Service"}`}
        message="Consultez les disponibilités"
        options={getScheduleOptions()}
        selectedValue={undefined}
        onSelect={() => {}}
        onClose={() => setShowScheduleSheet(false)}
        type="info"
        showCancel={true}
        cancelText="Fermer"
      />

      {/* Modal Affluence — graphique et créneaux */}
      <Modal visible={showAffluenceSheet} transparent animationType="slide" onRequestClose={() => setShowAffluenceSheet(false)}>
        <View style={styles.affluenceOverlay}>
          <TouchableOpacity style={styles.affluenceBackdrop} activeOpacity={1} onPress={() => setShowAffluenceSheet(false)} />
          <Animated.View style={[styles.affluenceModal, { backgroundColor: colors.surface }]}>
            <View style={styles.affluenceHandle}>
              <View style={[styles.affluenceHandleBar, { backgroundColor: colors.border }]} />
            </View>

            <View style={styles.affluenceHeader}>
              <Ionicons name="pulse-outline" size={22} color={colors.warning} />
              <Text style={[styles.affluenceTitle, { color: colors.textPrimary }]}>Affluence en temps réel</Text>
              <TouchableOpacity onPress={() => setShowAffluenceSheet(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {affluenceLoading || !affluenceData ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 40 }} />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Stats rapides */}
                <View style={styles.affluenceStatsRow}>
                  <View style={[styles.affluenceStat, { backgroundColor: colors.surfaceSecondary }]}>
                    <Text style={[styles.affluenceStatValue, { color: affluenceData.level === 'high' ? colors.danger : affluenceData.level === 'medium' ? colors.warning : colors.success }]}>
                      {affluenceData.people ?? 0}
                    </Text>
                    <Text style={[styles.affluenceStatLabel, { color: colors.textTertiary }]}>En attente</Text>
                  </View>
                  <View style={[styles.affluenceStat, { backgroundColor: colors.surfaceSecondary }]}>
                    <Text style={[styles.affluenceStatValue, { color: colors.primary }]}>~{affluenceData.eta_avg ?? '--'} min</Text>
                    <Text style={[styles.affluenceStatLabel, { color: colors.textTertiary }]}>Attente moyenne</Text>
                  </View>
                  <View style={[styles.affluenceStat, { backgroundColor: colors.surfaceSecondary }]}>
                    <View style={[styles.affluenceLevelDot, { backgroundColor: affluenceData.level === 'high' ? colors.danger : affluenceData.level === 'medium' ? colors.warning : colors.success }]} />
                    <Text style={[styles.affluenceStatLabel, { color: colors.textTertiary }]}>
                      {affluenceData.level === 'high' ? 'Élevée' : affluenceData.level === 'medium' ? 'Modérée' : 'Faible'}
                    </Text>
                  </View>
                </View>

                {/* Graphique barres — Créneaux horaires */}
                {affluenceData.hourly_data && affluenceData.hourly_data.length > 0 && (
                  <>
                    <Text style={[styles.affluenceChartTitle, { color: colors.textPrimary }]}>Créneaux d’affluence (30 jours)</Text>
                    <View style={[styles.affluenceChart, { backgroundColor: colors.surfaceSecondary }]}>
                      <View style={styles.affluenceChartBars}>
                        {affluenceData.hourly_data.map((pt) => {
                          const maxCount = Math.max(...affluenceData.hourly_data.map(d => d.count), 1);
                          const heightPct = (pt.count / maxCount) * 100;
                          const barColor = affluenceData.peak_hours?.high?.includes(pt.hour) ? colors.danger
                            : affluenceData.peak_hours?.medium?.includes(pt.hour) ? colors.warning
                            : colors.success + "60";
                          return (
                            <View key={pt.hour} style={styles.affluenceBarCol}>
                              <View style={styles.affluenceBarWrapper}>
                                <View style={[styles.affluenceBar, { height: `${Math.max(heightPct, 2)}%`, backgroundColor: barColor }]} />
                              </View>
                              <Text style={[styles.affluenceBarLabel, { color: colors.textTertiary }]}>
                                {String(pt.hour).padStart(2, '0')}h
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                      <View style={styles.affluenceLegend}>
                        <View style={styles.affluenceLegendItem}>
                          <View style={[styles.affluenceLegendDot, { backgroundColor: colors.danger }]} />
                          <Text style={[styles.affluenceLegendText, { color: colors.textTertiary }]}>Peak</Text>
                        </View>
                        <View style={styles.affluenceLegendItem}>
                          <View style={[styles.affluenceLegendDot, { backgroundColor: colors.warning }]} />
                          <Text style={[styles.affluenceLegendText, { color: colors.textTertiary }]}>Moyen</Text>
                        </View>
                        <View style={styles.affluenceLegendItem}>
                          <View style={[styles.affluenceLegendDot, { backgroundColor: colors.success + "60" }]} />
                          <Text style={[styles.affluenceLegendText, { color: colors.textTertiary }]}>Calme</Text>
                        </View>
                      </View>
                    </View>
                  </>
                )}

                {/* Conseils */}
                {affluenceData.peak_hours?.high?.length > 0 && (
                  <View style={[styles.affluenceTip, { backgroundColor: colors.warning + "12" }]}>
                    <Ionicons name="bulb-outline" size={16} color={colors.warning} />
                    <Text style={[styles.affluenceTipText, { color: colors.textSecondary }]}>
                      Heures d’affluence : {affluenceData.peak_hours.high.map((h: number) => `${String(h).padStart(2,'0')}h`).join(', ')}.
                      Essayez de venir en dehors de ces créneaux pour une attente réduite.
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </Animated.View>
        </View>
      </Modal>

      {/* Custom Alert pour confirmation avant de rejoindre la file */}
      <CustomAlert
        visible={showConfirmAlert}
        type="warning"
        title="Confirmation"
        message="Voulez-vous vraiment rejoindre cette file d'attente ? Vous recevrez une notification quand ce sera votre tour."
        primaryButton={{
          text: "Oui, rejoindre",
          onPress: executeJoinQueue,
        }}
        secondaryButton={{
          text: "Annuler",
          onPress: () => setShowConfirmAlert(false),
        }}
        onClose={() => setShowConfirmAlert(false)}
      />

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
  headerBgIcon: {
    position: "absolute",
    right: -20,
    bottom: -20,
  },
  headerContent: {
    position: "absolute",
    bottom: 60,
    left: 16,
    right: 16,
  },
  headerEstablishmentName: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "800",
  },
  headerAddressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  headerAddress: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    flex: 1,
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
    marginTop: 15,
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
    paddingVertical: 12,
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

  // ─── Affluence Chip ───
  serviceHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  affluenceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  affluenceChipText: {
    fontSize: 9,
    fontWeight: "600",
  },

  // ─── Affluence Modal ───
  affluenceOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  affluenceBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  affluenceModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    paddingBottom: 30,
  },
  affluenceHandle: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  affluenceHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  affluenceHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  affluenceTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
  },
  affluenceStatsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  affluenceStat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 4,
  },
  affluenceStatValue: {
    fontSize: 16,
    fontWeight: "800",
  },
  affluenceStatLabel: {
    fontSize: 10,
    fontWeight: "500",
    textAlign: "center",
  },
  affluenceLevelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // ─── Graphique ───
  affluenceChartTitle: {
    fontSize: 13,
    fontWeight: "600",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  affluenceChart: {
    marginHorizontal: 20,
    borderRadius: 14,
    padding: 16,
  },
  affluenceChartBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 120,
    gap: 1,
  },
  affluenceBarCol: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  affluenceBarWrapper: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  affluenceBar: {
    width: "60%",
    borderRadius: 3,
    minHeight: 2,
  },
  affluenceBarLabel: {
    fontSize: 7,
    fontWeight: "500",
  },
  affluenceLegend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 12,
  },
  affluenceLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  affluenceLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  affluenceLegendText: {
    fontSize: 10,
  },
  affluenceTip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
  },
  affluenceTipText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },

  // ─── Reviews ───
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  avgRatingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  avgRatingText: {
    fontSize: 15,
    fontWeight: "700",
  },
  avgRatingTotal: {
    fontSize: 12,
  },
  ratingDistContainer: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    gap: 6,
  },
  ratingDistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingDistLabel: {
    fontSize: 11,
    fontWeight: "600",
    width: 12,
  },
  ratingDistBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 4,
    overflow: "hidden",
  },
  ratingDistFill: {
    height: "100%",
    borderRadius: 3,
  },
  ratingDistCount: {
    fontSize: 10,
    width: 20,
    textAlign: "right",
  },
  reviewItem: {
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reviewAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewUserInfo: {
    flex: 1,
  },
  reviewUserName: {
    fontSize: 12,
    fontWeight: "600",
  },
  reviewDate: {
    fontSize: 10,
  },
  reviewStars: {
    flexDirection: "row",
    gap: 1,
  },
  reviewComment: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 18,
  },
  emptyReviews: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  emptyReviewsText: {
    fontSize: 12,
  },
});

export default ServiceDetailsScreen;