import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ticketsApi, Ticket } from '../../api/ticketsApi';
import { TabParamList } from '../../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { useTicket } from '../../store/ticketStore';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import { useThemeColors } from '../../hooks/useThemeColors';
import { router } from 'expo-router';

type HistoryNavigationProp = NativeStackNavigationProp<TabParamList, 'History'>;

// Types pour les filtres
type FilterType = 'weekly' | 'monthly' | 'custom';
type StatusFilter = 'all' | 'active' | 'waiting' | 'called' | 'completed' | 'cancelled' | 'expired' | 'served' | 'closed' | 'absent' | 'created';

interface FilterOption {
  id: FilterType;
  label: string;
  icon: React.ReactNode;
}

interface StatusOption {
  id: StatusFilter;
  label: string;
  color: string;
}

// Composant HistoryScreen
export const HistoryScreen: React.FC = () => {
  const navigation = useNavigation<HistoryNavigationProp>();
  const colors = useThemeColors();
  const { hasActiveTicket, activeTicket, setActiveTicket, isCalled, counterNumber, fetchActiveTicket, isInitialized } = useTicket();
  const { AlertComponent, showSuccess, showError } = useCustomAlert();
  
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('weekly');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedTickets, setExpandedTickets] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Fetch fresh ticket data on mount to avoid showing stale data from other users
  useEffect(() => {
    fetchActiveTicket().catch(err => console.error('Error fetching active ticket:', err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refs pour éviter les boucles de dépendances
  const pageRef = React.useRef(1);
  const hasMoreRef = React.useRef(true);
  const isLoadingRef = React.useRef(false);
  const onEndReachedCalledDuringMomentumRef = React.useRef(true);
  const lastEndReachedAtRef = React.useRef(0);

  // Filtres disponibles
  const filters: FilterOption[] = [
    {
      id: 'weekly',
      label: 'Semaine',
      icon: <Ionicons name="calendar-outline" size={16} />,
    },
    {
      id: 'monthly',
      label: 'Mois',
      icon: <Ionicons name="calendar-number-outline" size={16} />,
    },
    {
      id: 'custom',
      label: 'Custom',
      icon: <Ionicons name="options-outline" size={16} />,
    },
  ];

  // Status filter options - tous les statuts possibles
  const statusOptions: StatusOption[] = [
    { id: 'all', label: 'Tous', color: '#6B7280' },
    { id: 'active', label: 'Actifs', color: '#2563EB' },
    { id: 'created', label: 'Créés', color: '#8B5CF6' },
    { id: 'waiting', label: 'En attente', color: '#F59E0B' },
    { id: 'called', label: 'Appelés', color: '#10B981' },
    { id: 'served', label: 'Servis', color: '#059669' },
    { id: 'completed', label: 'Terminés', color: '#059669' },
    { id: 'closed', label: 'Fermés', color: '#6B7280' },
    { id: 'cancelled', label: 'Annulés', color: '#EF4444' },
    { id: 'expired', label: 'Expirés', color: '#9CA3AF' },
    { id: 'absent', label: 'Absents', color: '#DC2626' },
  ];

  // Obtenir les dates selon le filtre
  const getFilterDates = useCallback(() => {
    const now = new Date();
    const endDate = now.toISOString().split('T')[0];
    
    let startDate: string;
    
    switch (selectedFilter) {
      case 'weekly': {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDate = weekAgo.toISOString().split('T')[0];
        break;
      }
      case 'monthly': {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        startDate = monthAgo.toISOString().split('T')[0];
        break;
      }
      case 'custom': {
        const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        startDate = threeMonthsAgo.toISOString().split('T')[0];
        break;
      }
      default: {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        startDate = monthAgo.toISOString().split('T')[0];
      }
    }
    
    return { startDate, endDate };
  }, [selectedFilter]);

  // Charger les tickets - version stable sans dépendances changeantes
  const loadTickets = useCallback(async (reset: boolean = false) => {
    // Utiliser une ref pour vérifier l'état sans causer de re-render
    if (isLoadingRef.current) return;
    if (!reset && !hasMoreRef.current) return;

    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);
    
    try {
      const { startDate, endDate } = getFilterDates();
      const currentPage = reset ? 1 : pageRef.current;
      
      console.log('[HistoryScreen] Loading tickets:', { startDate, endDate, page: currentPage, status: selectedStatus });
      
      const response = await ticketsApi.getTicketHistory({
        from: startDate,
        to: endDate,
        page: currentPage,
        per_page: 20,
        status: selectedStatus === 'all' ? undefined : selectedStatus,
      });

      console.log('[HistoryScreen] Response:', JSON.stringify(response).substring(0, 500));

      // Laravel API wraps data in 'data' key
      const newTickets = response.data || [];
      
      console.log('[HistoryScreen] Tickets found:', newTickets.length);
      
      if (reset) {
        setTickets(newTickets);
        pageRef.current = 2;
      } else {
        setTickets(prev => [...prev, ...newTickets]);
        pageRef.current = currentPage + 1;
      }
      
      // Laravel pagination is in 'meta' key
      const pagination = response.meta || (response as any).pagination;
      hasMoreRef.current = pagination ? pagination.current_page < pagination.last_page : false;
    } catch (error: any) {
      console.error('[HistoryScreen] Error:', error.response?.status, error.response?.data, error.message);
      const errorMessage = error.response?.data?.message || 'Impossible de charger l\'historique des tickets.';
      setError(errorMessage);
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [getFilterDates, selectedStatus]);

  // Effet pour charger les tickets au montage et quand le filtre change
  useEffect(() => {
    // Réinitialiser les refs quand le filtre change
    pageRef.current = 1;
    hasMoreRef.current = true;
    isLoadingRef.current = false;
    onEndReachedCalledDuringMomentumRef.current = true;
    lastEndReachedAtRef.current = 0;
    loadTickets(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFilter, selectedStatus]);

  // Rafraîchir les données
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      onEndReachedCalledDuringMomentumRef.current = true;
      lastEndReachedAtRef.current = 0;
      await loadTickets(true);
    } catch (error) {
      console.error('Error refreshing tickets:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Charger plus de tickets (infinite scroll)
  const handleLoadMore = () => {
    if (onEndReachedCalledDuringMomentumRef.current) return;
    const now = Date.now();
    if (now - lastEndReachedAtRef.current < 800) return;
    lastEndReachedAtRef.current = now;

    if (!isLoadingRef.current && hasMoreRef.current) {
      onEndReachedCalledDuringMomentumRef.current = true;
      loadTickets(false);
    }
  };

  // Basculer l'expansion d'un ticket
  const toggleTicketExpansion = (ticketId: number) => {
    const newExpanded = new Set(expandedTickets);
    if (newExpanded.has(ticketId)) {
      newExpanded.delete(ticketId);
    } else {
      newExpanded.add(ticketId);
    }
    setExpandedTickets(newExpanded);
  };

  // Obtenir le texte du statut en français
  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'closed': 'Fermé',
      'served': 'Servi',
      'cancelled': 'Annulé',
      'canceled': 'Annulé',
      'expired': 'Expiré',
      'absent': 'Absent',
      'called': 'Appelé',
      'waiting': 'En attente',
      'created': 'Créé',
      'pending': 'En attente',
      'completed': 'Terminé',
    };
    return statusMap[status] || status;
  };

  // Obtenir la couleur selon le statut
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'served':
      case 'completed':
        return { bg: colors.success + '20', text: colors.success }; // Vert
      case 'cancelled':
      case 'canceled':
      case 'expired':
      case 'absent':
        return { bg: colors.danger + '20', text: colors.danger }; // Rouge
      case 'called':
        return { bg: colors.primary + '20', text: colors.primary }; // Bleu
      case 'waiting':
      case 'created':
      case 'pending':
        return { bg: colors.warning + '20', text: colors.warning }; // Orange
      case 'closed':
        return { bg: colors.textTertiary + '20', text: colors.textSecondary }; // Gris
      default:
        return { bg: colors.warning + '20', text: colors.warning };
    }
  };

  // Calculer la durée d'attente
  const getWaitTime = (ticket: Ticket) => {
    if (!ticket.created_at || !ticket.closed_at) return null;
    
    const created = new Date(ticket.created_at);
    const closed = new Date(ticket.closed_at);
    const diffMs = closed.getTime() - created.getTime();
    const diffMins = Math.round(diffMs / (1000 * 60));
    
    return `${diffMins} min`;
  };

  // Rejoindre à nouveau la file
  const handleRejoinQueue = async (ticket: Ticket) => {
    if (!ticket.service_id) return;
    
    try {
      const newTicket = await ticketsApi.rejoinQueue(ticket.service_id);
      showSuccess(
        'Ticket Created',
        `Your ticket ${newTicket.number} was created for ${ticket.service?.name || 'Service'}.`,
        'OK',
        () => navigation.navigate('tickets' as any)
      );
    } catch (error) {
      console.error('Error rejoining queue:', error);
      showError('Error', 'Impossible de rejoindre la file.');
    }
  };

  // Rendu du footer
  const renderFooter = () => {
    if (!hasMoreRef.current) return null;
    
    return (
      <View style={{ paddingVertical: 32, alignItems: 'center' }}>
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 2 }}>
            Load More...
          </Text>
        )}
      </View>
    );
  };

  // Rendu de l'état vide
  const renderEmptyState = () => (
    <View style={{ alignItems: 'center', paddingVertical: 80, paddingHorizontal: 40 }}>
      <Ionicons
        name="time-outline"
        size={80}
        color={colors.textQuaternary}
      />
      <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.textPrimary, marginTop: 24, marginBottom: 8, textAlign: 'center' }}>
        Aucun ticket terminé
      </Text>
      <Text style={{ color: colors.textSecondary, textAlign: 'center', marginBottom: 40 }}>
        Les tickets apparaissent ici une fois servis, annulés ou expirés.
      </Text>
      {isInitialized && hasActiveTicket && activeTicket ? (
        <TouchableOpacity 
          style={{ backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center' }}
          onPress={() => router.push('/(tabs)/live-ticket')}
        >
          <Ionicons name="ticket-outline" size={20} color="white" />
          <Text style={{ color: 'white', fontWeight: 'bold', marginLeft: 8 }}>Voir mon ticket actif</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity 
          style={{ backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center' }}
          onPress={() => router.push('/(tabs)/tickets')}
        >
          <Ionicons name="qr-code-outline" size={20} color="white" />
          <Text style={{ color: 'white', fontWeight: 'bold', marginLeft: 8 }}>Scanner un QR Code</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Active ticket card component
  const renderActiveTicketCard = () => {
    console.log('[HistoryScreen] renderActiveTicketCard - hasActiveTicket:', hasActiveTicket, 'activeTicket:', activeTicket?.id);
    if (!hasActiveTicket || !activeTicket) return null;
    
    return (
      <TouchableOpacity 
        style={{ 
          marginHorizontal: 20, 
          marginBottom: 16, 
          backgroundColor: colors.primary, 
          borderRadius: 24, 
          padding: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
        }}
        onPress={() => router.push('/(tabs)/live-ticket')}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'white', opacity: 0.8, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
              Ticket actif
            </Text>
            <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', marginTop: 4 }}>
              {activeTicket.establishment?.name || 'Établissement'}
            </Text>
            <Text style={{ color: 'white', opacity: 0.8, fontSize: 14, marginTop: 4 }}>
              {activeTicket.service?.name || 'Service'}
            </Text>
          </View>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 }}>
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>{activeTicket.number}</Text>
          </View>
        </View>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 12, marginTop: 8 }}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Ionicons name="people" size={18} color="white" />
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18, marginTop: 4 }}>{activeTicket.position || '-'}</Text>
            <Text style={{ color: 'white', opacity: 0.6, fontSize: 12 }}>Position</Text>
          </View>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Ionicons name={isCalled ? "notifications" : "hourglass"} size={18} color="white" />
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18, marginTop: 4 }}>
              {isCalled ? 'Appelé!' : 'En attente'}
            </Text>
            <Text style={{ color: 'white', opacity: 0.6, fontSize: 12 }}>
              {isCalled ? `Guichet ${counterNumber || ''}` : 'Statut'}
            </Text>
          </View>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Ionicons name="arrow-forward" size={18} color="white" />
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18, marginTop: 4 }}>Voir</Text>
            <Text style={{ color: 'white', opacity: 0.6, fontSize: 12 }}>Détails</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background,paddingBottom:30, }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 48, paddingBottom: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 20 }}>Historique de Ticket</Text>
        
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexDirection: 'row' }}
          contentContainerStyle={{ paddingRight: 20 }}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 999,
                marginRight: 8,
                borderWidth: 1,
                borderColor: selectedFilter === filter.id ? colors.primary : colors.border,
                backgroundColor: selectedFilter === filter.id ? colors.primary : colors.background,
              }}
              onPress={() => {
                setSelectedFilter(filter.id);
                setExpandedTickets(new Set());
              }}
            >
              {React.cloneElement(filter.icon as React.ReactElement<any>, { 
                color: selectedFilter === filter.id ? 'white' : colors.textSecondary 
              })}
              <Text style={{ 
                marginLeft: 8, 
                fontWeight: '600',
                color: selectedFilter === filter.id ? 'white' : colors.textSecondary 
              }}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Status Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 12 }}
          contentContainerStyle={{  paddingRight: 40 }}
        >
          {statusOptions.map((status) => (
            <TouchableOpacity
              key={status.id}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 999,
                marginRight: 8,
                backgroundColor: selectedStatus === status.id ? colors.textPrimary : colors.background,
              }}
              onPress={() => {
                setSelectedStatus(status.id);
                setExpandedTickets(new Set());
              }}
            >
              <Text style={{ 
                fontWeight: '600',
                color: selectedStatus === status.id ? colors.surface : colors.textSecondary
              }}>
                {status.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tickets List */}
      <FlatList
        data={tickets}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        onMomentumScrollBegin={() => {
          onEndReachedCalledDuringMomentumRef.current = false;
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          selectedStatus === 'all' && isInitialized && hasActiveTicket && activeTicket ? (
            <>
              {renderActiveTicketCard()}
              {tickets.length > 0 && (
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 12, marginHorizontal: 20, marginTop: 8 }}>Tous les tickets</Text>
              )}
            </>
          ) : tickets.length > 0 ? (
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 12, marginHorizontal: 20, marginTop: 16 }}>
              {selectedStatus === 'active' ? 'Tickets actifs' :
               selectedStatus === 'completed' ? 'Tickets terminés' :
               selectedStatus === 'waiting' ? 'En attente' :
               selectedStatus === 'called' ? 'Appelés' :
               selectedStatus === 'cancelled' ? 'Annulés' :
               selectedStatus === 'expired' ? 'Expirés' : 'Tickets'}
            </Text>
          ) : null
        }
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          isLoading ? () => (
            <View style={{ alignItems: 'center', paddingVertical: 80 }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : error ? (
            <View style={{ alignItems: 'center', paddingVertical: 80, paddingHorizontal: 40 }}>
              <Ionicons name="alert-circle-outline" size={80} color={colors.danger} />
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.textPrimary, marginTop: 24, marginBottom: 8, textAlign: 'center' }}>
                Oups ! Une erreur est survenue
              </Text>
              <Text style={{ color: colors.textSecondary, textAlign: 'center', marginBottom: 40 }}>
                {error.includes('401') ? 'Veuillez vous reconnecter pour voir votre historique.' : error}
              </Text>
              <TouchableOpacity 
                style={{ backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center' }}
                onPress={() => loadTickets(true)}
              >
                <Ionicons name="refresh-outline" size={20} color="white" />
                <Text style={{ color: 'white', fontWeight: 'bold', marginLeft: 8 }}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          ) : (selectedStatus === 'all' && isInitialized && hasActiveTicket && activeTicket) ? null : renderEmptyState
        }
        renderItem={({ item: ticket }) => {
          const isExpanded = expandedTickets.has(ticket.id);
          const waitTime = getWaitTime(ticket);
          
          return (
            <View style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 20, marginBottom: 16, marginHorizontal: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, borderWidth: 1, borderColor: colors.border }}>
              <TouchableOpacity
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}
                onPress={() => toggleTicketExpansion(ticket.id)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1, marginRight: 16 }}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.textPrimary }} numberOfLines={1}>
                    {ticket.establishment?.name || 'Establishment'}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontWeight: '500', marginBottom: 4 }}>
                    {ticket.service?.name || 'Service'}
                  </Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                    {new Date(ticket.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                
                <View style={{ alignItems: 'flex-end' }}>
                  <View style={{
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    borderRadius: 999,
                    marginBottom: 8,
                    backgroundColor: getStatusColor(ticket.status).bg,
                  }}>
                    <Text style={{
                      fontSize: 12,
                      fontWeight: 'bold',
                      color: getStatusColor(ticket.status).text,
                    }}>
                      {getStatusText(ticket.status)}
                    </Text>
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.textTertiary}
                  />
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.separator, gap: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: colors.textTertiary }}>Numéro du Ticket</Text>
                    <Text style={{ color: colors.textPrimary, fontWeight: 'bold' }}>{ticket.number}</Text>
                  </View>
                  {waitTime && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: colors.textTertiary }}>Durée d&apos;attente</Text>
                      <Text style={{ color: colors.textPrimary, fontWeight: 'bold' }}>{waitTime}</Text>
                    </View>
                  )}
                  {ticket.counter_id && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: colors.textTertiary }}>Guichet</Text>
                      <Text style={{ color: colors.textPrimary, fontWeight: 'bold' }}>{ticket.counter_id}</Text>
                    </View>
                  )}
                  
                  <TouchableOpacity 
                    style={{ marginTop: 8, backgroundColor: colors.primary + '10', paddingVertical: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                    onPress={() => handleRejoinQueue(ticket)}
                  >
                    <Ionicons name="refresh-outline" size={18} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontWeight: 'bold', marginLeft: 8 }}>Joindre la file</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
};

export default HistoryScreen;
