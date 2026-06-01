import React, { useState, useEffect, useCallback, ReactNode } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../theme';
import { useThemeColors } from '../../hooks/useThemeColors';
import { establishmentsApi, Establishment } from '../../api/establishmentsApi';
import { ticketsApi } from '../../api/ticketsApi';
import { useAuth } from '../../store/authStore';
import { useTicket } from '../../store/ticketStore';
import { useSimpleNotification } from '../../hooks/useSimpleNotification';
import { useDistanceTracking } from '../../hooks/useDistanceTracking';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import { formatDistance, formatTravelTime } from '../../utils/distance';
import { getApiErrorMessage } from '../../utils/errors';

interface ServiceData {
  description: ReactNode;
  id: number;
  name: string;
  status: string;
  avg_service_time_minutes: number;
  people_waiting: number;
}

interface EstablishmentData extends Omit<Establishment, 'services'> {
  total_people_waiting?: number;
  services?: ServiceData[];
}

export const ServiceDetailsScreen: React.FC = () => {
  const params = useLocalSearchParams();
  const colors = useThemeColors();

  const establishmentId = Number(params.establishmentId);
  const serviceId = params.serviceId ? Number(params.serviceId) : undefined;
  const fromQr = params.fromQr === 'true';
  const { isAuthenticated } = useAuth();
  const { hasActiveTicket, activeTicket, fetchActiveTicket, isInitialized } = useTicket();
  const { AlertComponent, showError, showInfo, showWarning } = useCustomAlert();

  // Fetch fresh ticket data on mount to avoid showing stale data from other users
  useEffect(() => {
    if (isAuthenticated) {
      fetchActiveTicket().catch(err => console.error('Error fetching active ticket:', err));
    }
  }, [fetchActiveTicket, isAuthenticated]);

  const [establishment, setEstablishment] = useState<EstablishmentData | null>(null);
  const [services, setServices] = useState<ServiceData[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(serviceId || null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  
  // Notifications
  const { notifyTicketCreated, notifyCrowdLevelChange } = useSimpleNotification();
  
  // Track crowd level changes for notifications
  const previousCrowdLevelRef = React.useRef<string | null>(null);
  const previousPeopleCountRef = React.useRef<number>(0);

  // Distance tracking
  const { distanceInfo, hasPermission: hasLocationPermission } = useDistanceTracking({
    targetCoordinates: establishment && establishment.lat != null && establishment.lng != null ? {
      latitude: establishment.lat,
      longitude: establishment.lng,
    } : null,
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
      // Services are now embedded in establishment response
      const servicesList = estData.services || servicesData || [];
      setServices(Array.isArray(servicesList) ? servicesList : (servicesList as any)?.data || []);
      // Only auto-select first open service if no service is pre-selected from params
      if (!serviceId && servicesList && (servicesList as unknown as ServiceData[]).length > 0) {
        const firstOpen = (servicesList as unknown as ServiceData[]).find(s => s.status === 'open');
        if (firstOpen) setSelectedServiceId(firstOpen.id);
      }
    } catch (error) {
      console.error('Error loading establishment:', error);
      showError('Erreur', 'Impossible de charger les détails de l\'établissement.');
    } finally {
      setIsLoading(false);
    }
  }, [establishmentId, serviceId, showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Monitor crowd level changes
  useEffect(() => {
    if (!establishment) return;
    
    const currentCrowdLevel = establishment.crowd_level || null;
    const currentPeopleCount = establishment.total_people_waiting || 0;
    
    if (previousCrowdLevelRef.current && 
        previousCrowdLevelRef.current !== currentCrowdLevel) {
      notifyCrowdLevelChange(
        establishment.name,
        previousCrowdLevelRef.current,
        currentCrowdLevel || 'moderate',
        currentPeopleCount
      );
    }
    
    previousCrowdLevelRef.current = currentCrowdLevel;
    previousPeopleCountRef.current = currentPeopleCount;
  }, [establishment?.crowd_level, establishment?.total_people_waiting, establishment?.name, notifyCrowdLevelChange]);

  const handleJoinQueue = async () => {
    if (!isAuthenticated) {
      showInfo(
        'Connexion requise',
        'Vous devez être connecté pour rejoindre une file d\'attente.',
        'Se connecter',
        () => router.push('/onboarding')
      );
      return;
    }

    // If still loading, wait
    if (!isInitialized) {
      showInfo('Chargement', 'Vérification de vos tickets en cours...', 'OK', () => {});
      return;
    }

    if (!selectedServiceId) {
      showError('Sélection requise', 'Veuillez choisir un service avant de rejoindre la file.');
      return;
    }

    // Only block if user has a ticket on THIS SPECIFIC service
    const hasTicketOnThisService = activeTicket?.service_id === selectedServiceId;
    
    if (isInitialized && hasTicketOnThisService && hasActiveTicket && activeTicket) {
      showWarning(
        'Ticket actif',
        'Vous avez déjà un ticket actif pour ce service. Voulez-vous le suivre ?',
        'Voir mon ticket',
        () => router.push({
          pathname: '/(tabs)/live-ticket',
          params: { ticketId: String(activeTicket.id) },
        }),
        'Annuler'
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
      
      // Extract ticket data (API wraps in {data: ...})
      const ticketData = (ticket as any)?.data || ticket;
      
      // Update store with ticket data so position is set correctly
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useTicketStore } = require('../../store/ticketStore');
      useTicketStore.getState().setActiveTicket(ticketData);

      // Send notification
      notifyTicketCreated(
        ticketData.number,
        ticketData.establishment?.name || establishment?.name || 'Établissement'
      );

      router.push({
        pathname: '/(tabs)/live-ticket',
        params: { ticketId: String(ticketData.id) },
      });
    } catch (error: any) {
      showError('Erreur', getApiErrorMessage(error, 'Impossible de rejoindre la file.'));
    } finally {
      setIsJoining(false);
    }
  };

  const handleGetDirections = () => {
    if (!establishment) return;
    const { lat, lng, address } = establishment;
    const url = Platform.OS === 'ios'
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
      console.error('Error sharing:', error);
    }
  };

  const isOpenNow = (establishment: Establishment) => {
    if (!establishment.open_at || !establishment.close_at) return null;
    const now = new Date();
    const [openH, openM] = establishment.open_at.split(':').map(Number);
    const [closeH, closeM] = establishment.close_at.split(':').map(Number);
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const openTime = openH * 60 + openM;
    const closeTime = closeH * 60 + closeM;
    return currentTime >= openTime && currentTime <= closeTime;
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!establishment) return null;

  //const isOpen = isOpenNow(establishment);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {AlertComponent}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} bounces>
        {/* Banner Image Section */}
        <View style={{ position: 'relative', height: 320, backgroundColor: colors.surfaceSecondary }}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=800&q=80' }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, paddingTop: 48, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', zIndex: 10 }}>
            <TouchableOpacity
              style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.3)' }}
              onPress={() => {
                // If coming from ExploreScreen (not from QR scan), go back to explore tab
                if (!fromQr && establishmentId) {
                  router.replace('/');
                } else {
                  router.back();
                }
              }}
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.3)' }}>
              <Ionicons name="heart-outline" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content Section with Rounded Corners */}
        <View style={{ backgroundColor: colors.surface, marginTop: -32, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 32 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.textPrimary }}>{establishment.name}</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 14, marginTop: 4 }}>{establishment.address}</Text>
            </View>
          </View>

          {/* Crowd level indicator row */}
          {/* <View style={{ flexDirection: 'row', marginTop: 24, marginBottom: 16, justifyContent: 'space-between' }}>
            {['low', 'moderate', 'high'].map((level) => {
              const isSelected = establishment.crowd_level === level;
              const levelColors = {
                low: { bg: colors.success + '10', border: colors.success + '30', dot: colors.success, text: colors.success },
                moderate: { bg: colors.warning + '10', border: colors.warning + '30', dot: colors.warning, text: colors.warning },
                high: { bg: colors.danger + '10', border: colors.danger + '30', dot: colors.danger, text: colors.danger },
              };
              const colors_for_level = levelColors[level as keyof typeof levelColors];
              const defaultColors = { bg: colors.surfaceSecondary, border: colors.border, dot: colors.textTertiary, text: colors.textTertiary };
              const activeColors = isSelected ? colors_for_level : defaultColors;
              
              return (
                <View 
                  key={level}
                  style={{
                    flex: 1,
                    marginHorizontal: 4,
                    padding: 12,
                    borderRadius: 16,
                    alignItems: 'center',
                    borderWidth: 1,
                    backgroundColor: activeColors.bg,
                    borderColor: activeColors.border,
                  }}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, marginBottom: 4, backgroundColor: activeColors.dot }} />
                  <Text style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5, color: activeColors.text }}>
                    {level}
                  </Text>
                </View>
              );
            })}
          </View> */}

          {/* Total People in Queue */}
          <View style={{ marginBottom: 24, backgroundColor: colors.warning + '10', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.warning + '30', marginTop:10, }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="people" size={20} color={colors.warning} />
              <Text style={{ color: colors.warning, fontWeight: 'bold', marginLeft: 8 }}>File d&apos;attente</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Ionicons name="people" size={18} color={colors.textSecondary} />
                <Text style={{ color: colors.textPrimary, fontWeight: 'bold', fontSize: 18, marginTop: 4 }}>
                  {establishment.total_people_waiting ?? 0}
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Total</Text>
              </View>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Ionicons name="business" size={18} color={colors.textSecondary} />
                <Text style={{ color: colors.textPrimary, fontWeight: 'bold', fontSize: 18, marginTop: 4 }}>
                  {services.length}
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Services</Text>
              </View>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
                <Text style={{ color: colors.textPrimary, fontWeight: 'bold', fontSize: 18, marginTop: 4 }}>
                  {services.filter(s => s.status === 'open').length}
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Actifs</Text>
              </View>
            </View>
          </View>

          {/* Distance Info */}
          {distanceInfo && hasLocationPermission && (
            <View style={{ marginBottom: 24, backgroundColor: colors.primary + '10', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.primary + '30' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons name="location" size={20} color={colors.primary} />
                <Text style={{ color: colors.primary, fontWeight: 'bold', marginLeft: 8 }}>Distance</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Ionicons name="navigate" size={18} color={colors.textSecondary} />
                  <Text style={{ color: colors.textPrimary, fontWeight: 'bold', fontSize: 18, marginTop: 4 }}>
                    {formatDistance(distanceInfo.kilometers)}
                  </Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Distance</Text>
                </View>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Ionicons name="walk" size={18} color={colors.textSecondary} />
                  <Text style={{ color: colors.textPrimary, fontWeight: 'bold', fontSize: 18, marginTop: 4 }}>
                    {formatTravelTime(distanceInfo.travelTimes.walking)}
                  </Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>À pied</Text>
                </View>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Ionicons name="car" size={18} color={colors.textSecondary} />
                  <Text style={{ color: colors.textPrimary, fontWeight: 'bold', fontSize: 18, marginTop: 4 }}>
                    {formatTravelTime(distanceInfo.travelTimes.car)}
                  </Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Voiture</Text>
                </View>
              </View>
            </View>
          )}

          {/* Service Selection */}
          {services.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 12 }}>Choisissez un service</Text>
              {services.map((service) => (
                <TouchableOpacity
                  key={service.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    borderRadius: 12,
                    marginBottom: 8,
                    borderWidth: 1,
                    backgroundColor: selectedServiceId === service.id ? colors.primary + '10' : colors.surfaceSecondary,
                    borderColor: selectedServiceId === service.id ? colors.primary + '40' : colors.border,
                  }}
                  onPress={() => setSelectedServiceId(service.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontWeight: '600',
                      color: selectedServiceId === service.id ? colors.primary : colors.textPrimary,
                    }}>
                      {service.name}
                    </Text>
                    {service.description && (
                      <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 4 }}>{service.description}</Text>
                    )}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                      <Ionicons name="people-outline" size={14} color={colors.textTertiary} />
                      <Text style={{ color: colors.textTertiary, fontSize: 12, marginLeft: 4 }}>
                        {service.people_waiting ?? 0} dans la file d&apos;attente
                      </Text>
                      {service.avg_service_time_minutes && (
                        <>
                          <Ionicons name="time-outline" size={14} color={colors.textTertiary} style={{ marginLeft: 12 }} />
                          <Text style={{ color: colors.textTertiary, fontSize: 12, marginLeft: 4 }}>~{service.avg_service_time_minutes} min/service</Text>
                        </>
                      )}
                    </View>
                  </View>
                  {selectedServiceId === service.id && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Join Queue Button */}
          <TouchableOpacity 
            style={{
              width: '100%',
              height: 64,
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 32,
              backgroundColor: isJoining ? colors.primary + '80' : colors.primary,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
            }}
            onPress={handleJoinQueue}
            disabled={isJoining}
          >
            {isJoining ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="enter-outline" size={24} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 18 }}>Joindre la file</Text>
              </>
            )}
          </TouchableOpacity>

          {/* General Information Section */}
          <View style={{ marginBottom: 40 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 16 }}>Information Generale</Text>
            
            <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 16 }}>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: colors.border, paddingBottom: 16, marginBottom: 16 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                  <Ionicons name="call-outline" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Telephone</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{(establishment as any).phone || '+229 9723456789'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </TouchableOpacity>

              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                  <Ionicons name="globe-outline" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Site web</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{(establishment as any).website || 'www.smartqueue.com'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default ServiceDetailsScreen;
