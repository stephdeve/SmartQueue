import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
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

const { width } = Dimensions.get('window');

type HistoryNavigationProp = NativeStackNavigationProp<TabParamList, 'History'>;
type FilterType = 'weekly' | 'monthly' | 'custom';
type StatusFilter = 'all' | 'active' | 'waiting' | 'called' | 'completed' | 'cancelled' | 'expired' | 'served' | 'closed' | 'absent' | 'created';

// Composant Header compact
const HistoryHeader: React.FC<{
  selectedFilter: FilterType;
  selectedStatus: StatusFilter;
  colors: any;
  onFilterPress: (filter: FilterType) => void;
  onStatusPress: (status: StatusFilter) => void;
}> = ({ selectedFilter, selectedStatus, colors, onFilterPress, onStatusPress }) => {
  const filters = [
    { id: 'weekly', label: 'Semaine', icon: 'calendar-outline' },
    { id: 'monthly', label: 'Mois', icon: 'calendar-number-outline' },
    { id: 'custom', label: 'Personnalisé', icon: 'options-outline' },
  ];

  const statusOptions = [
    { id: 'all', label: 'Tous' },
    { id: 'waiting', label: 'Attente' },
    { id: 'called', label: 'Appelés' },
    { id: 'served', label: 'Servis' },
    { id: 'cancelled', label: 'Annulés' },
  ];

  return (
    <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <View style={styles.headerTop}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Historique</Text>
        <View style={[styles.headerBadge, { backgroundColor: colors.primary + '10' }]}>
          <Ionicons name="time-outline" size={14} color={colors.primary} />
          <Text style={[styles.headerBadgeText, { color: colors.primary }]}>90 jours</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={[
              styles.filterChip,
              {
                backgroundColor: selectedFilter === filter.id ? colors.primary : colors.surfaceSecondary,
                borderColor: selectedFilter === filter.id ? colors.primary : colors.border,
              },
            ]}
            onPress={() => onFilterPress(filter.id as FilterType)}
          >
            <Ionicons name={filter.icon as any} size={14} color={selectedFilter === filter.id ? '#FFF' : colors.textSecondary} />
            <Text style={[styles.filterChipText, { color: selectedFilter === filter.id ? '#FFF' : colors.textSecondary }]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusScroll}>
        {statusOptions.map((status) => (
          <TouchableOpacity
            key={status.id}
            style={[
              styles.statusChip,
              {
                backgroundColor: selectedStatus === status.id ? colors.textPrimary : colors.surfaceSecondary,
              },
            ]}
            onPress={() => onStatusPress(status.id as StatusFilter)}
          >
            <Text style={[styles.statusChipText, { color: selectedStatus === status.id ? colors.surface : colors.textSecondary }]}>
              {status.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

// Carte Ticket compacte
const TicketHistoryCard: React.FC<{
  ticket: Ticket;
  colors: any;
  isExpanded: boolean;
  onPress: () => void;
  onRejoin: () => void;
}> = ({ ticket, colors, isExpanded, onPress, onRejoin }) => {
  const getStatusConfig = () => {
    const status = ticket.status;
    if (status === 'served' || status === 'completed')
      return { label: 'Servi', icon: 'checkmark-circle', color: colors.success, bg: colors.success + '15' };
    if (status === 'cancelled' || status === 'expired' || status === 'absent')
      return { label: 'Annulé', icon: 'close-circle', color: colors.danger, bg: colors.danger + '15' };
    if (status === 'called')
      return { label: 'Appelé', icon: 'notifications', color: colors.primary, bg: colors.primary + '15' };
    if (status === 'waiting' || status === 'created')
      return { label: 'En attente', icon: 'time', color: colors.warning, bg: colors.warning + '15' };
    return { label: status, icon: 'help-circle', color: colors.textTertiary, bg: colors.border };
  };

  const statusConfig = getStatusConfig();
  const date = new Date(ticket.created_at);
  const formattedDate = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const formattedTime = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <TouchableOpacity
      style={[styles.ticketCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.ticketCardHeader}>
        <View style={styles.ticketInfo}>
          <View style={[styles.ticketNumberBadge, { backgroundColor: colors.primary + '10' }]}>
            <Text style={[styles.ticketNumber, { color: colors.primary }]}>#{ticket.number}</Text>
          </View>
          <View style={styles.ticketMeta}>
            <Text style={[styles.ticketName, { color: colors.textPrimary }]} numberOfLines={1}>
              {ticket.establishment?.name || 'Établissement'}
            </Text>
            <Text style={[styles.ticketService, { color: colors.textSecondary }]} numberOfLines={1}>
              {ticket.service?.name || 'Service'}
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
          <Ionicons name={statusConfig.icon as any} size={12} color={statusConfig.color} />
          <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
        </View>
      </View>

      <View style={styles.ticketCardFooter}>
        <View style={styles.dateInfo}>
          <Ionicons name="calendar-outline" size={12} color={colors.textTertiary} />
          <Text style={[styles.dateText, { color: colors.textSecondary }]}>{formattedDate}</Text>
          <Text style={[styles.timeText, { color: colors.textTertiary }]}>{formattedTime}</Text>
        </View>
        <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textTertiary} />
      </View>

      {isExpanded && (
        <View style={[styles.expandedContent, { borderTopColor: colors.border }]}>
          <View style={styles.expandedRow}>
            <Text style={[styles.expandedLabel, { color: colors.textTertiary }]}>Temps d'attente</Text>
            <Text style={[styles.expandedValue, { color: colors.textPrimary }]}>
              {getWaitTime(ticket) || 'N/A'}
            </Text>
          </View>
          {ticket.counter_id && (
            <View style={styles.expandedRow}>
              <Text style={[styles.expandedLabel, { color: colors.textTertiary }]}>Guichet</Text>
              <Text style={[styles.expandedValue, { color: colors.textPrimary }]}>{ticket.counter_id}</Text>
            </View>
          )}
          <TouchableOpacity style={[styles.rejoinButton, { backgroundColor: colors.primary + '10' }]} onPress={onRejoin}>
            <Ionicons name="refresh-outline" size={16} color={colors.primary} />
            <Text style={[styles.rejoinButtonText, { color: colors.primary }]}>Reprendre la file</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

// Carte Ticket actif avec affichage du statut correct
const ActiveTicketCardCompact: React.FC<{
  activeTicket: Ticket | null;
  isCalled: boolean;
  counterNumber: number | null;
  colors: any;
  onPress: () => void;
}> = ({ activeTicket, isCalled, counterNumber, colors, onPress }) => {
  if (!activeTicket) return null;

  // Déterminer le statut et l'affichage
  const ticketStatus = activeTicket.status;
  const isTicketPresent = ticketStatus === 'present';
  const isTicketEnRoute = ticketStatus === 'en_route';
  const isTicketCalled = ticketStatus === 'called';
  const isTicketWaiting = ticketStatus === 'waiting';

  const getStatusDisplay = () => {
    if (isTicketPresent) return { text: 'Présent', icon: 'checkmark-circle' };
    if (isTicketEnRoute) return { text: 'En route', icon: 'walk' };
    if (isTicketCalled) return { text: 'Appelé', icon: 'notifications' };
    return { text: 'En attente', icon: 'hourglass-outline' };
  };

  const statusDisplay = getStatusDisplay();
  const statusColor = isTicketPresent ? colors.success : isTicketEnRoute ? colors.warning : isTicketCalled ? colors.danger : colors.primary;

  // Message supplémentaire selon le statut
  const getStatusMessage = () => {
    if (isTicketPresent) return 'Présent au point de service';
    if (isTicketEnRoute) return 'En route vers l\'établissement';
    if (isTicketCalled) return `Guichet ${counterNumber || 'N/A'}`;
    return `${activeTicket.position || '?'}e position`;
  };

  return (
    <TouchableOpacity style={[styles.activeCard, { backgroundColor: colors.primary }]} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.activeCardHeader}>
        <View>
          <Text style={styles.activeCardLabel}>Ticket actif</Text>
          <Text style={styles.activeCardName}>{activeTicket.establishment?.name || 'Établissement'}</Text>
          <Text style={[styles.activeCardService, { color: 'rgba(255,255,255,0.85)' }]}>
            {activeTicket.service?.name || 'Service'}
          </Text>
        </View>
        <View style={styles.activeCardNumber}>
          <Text style={styles.activeCardNumberText}>{activeTicket.number}</Text>
        </View>
      </View>
      
      <View style={styles.activeCardStats}>
        <View style={styles.activeStat}>
          <Ionicons name={statusDisplay.icon as any} size={16} color="#FFF" />
          <Text style={styles.activeStatValue}>{statusDisplay.text}</Text>
          <Text style={styles.activeStatLabel}>Statut</Text>
        </View>
        <View style={styles.activeStatDivider} />
        <View style={styles.activeStat}>
          <Ionicons name="time-outline" size={16} color="#FFF" />
          <Text style={styles.activeStatValue}>{getStatusMessage()}</Text>
          <Text style={styles.activeStatLabel}>Info</Text>
        </View>
        <View style={styles.activeStatDivider} />
        <View style={styles.activeStat}>
          <Ionicons name="arrow-forward" size={16} color="#FFF" />
          <Text style={styles.activeStatValue}>Voir</Text>
          <Text style={styles.activeStatLabel}>Détails</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// États vides
const EmptyState: React.FC<{ colors: any; onScanPress: () => void }> = ({ colors, onScanPress }) => (
  <View style={styles.emptyContainer}>
    <View style={[styles.emptyIconContainer, { backgroundColor: colors.primary + '10' }]}>
      <Ionicons name="time-outline" size={56} color={colors.primary} />
    </View>
    <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Aucun ticket</Text>
    <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
      Vos tickets apparaîtront ici une fois servis ou annulés
    </Text>
    <TouchableOpacity style={[styles.emptyButton, { backgroundColor: colors.primary }]} onPress={onScanPress}>
      <Ionicons name="qr-code-outline" size={18} color="#FFF" />
      <Text style={styles.emptyButtonText}>Scanner un QR code</Text>
    </TouchableOpacity>
  </View>
);

const ErrorState: React.FC<{ colors: any; error: string; onRetry: () => void }> = ({ colors, error, onRetry }) => (
  <View style={styles.emptyContainer}>
    <View style={[styles.errorIconContainer, { backgroundColor: colors.danger + '10' }]}>
      <Ionicons name="alert-circle-outline" size={56} color={colors.danger} />
    </View>
    <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Erreur de chargement</Text>
    <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>{error}</Text>
    <TouchableOpacity style={[styles.emptyButton, { backgroundColor: colors.primary }]} onPress={onRetry}>
      <Ionicons name="refresh-outline" size={18} color="#FFF" />
      <Text style={styles.emptyButtonText}>Réessayer</Text>
    </TouchableOpacity>
  </View>
);

// Helper functions
const getWaitTime = (ticket: Ticket): string | null => {
  if (!ticket.created_at || !ticket.closed_at) return null;
  const created = new Date(ticket.created_at);
  const closed = new Date(ticket.closed_at);
  const diffMins = Math.round((closed.getTime() - created.getTime()) / (1000 * 60));
  return `${diffMins} min`;
};

// Composant principal
export const HistoryScreen: React.FC = () => {
  const colors = useThemeColors();
  const { hasActiveTicket, activeTicket, isCalled, counterNumber, fetchActiveTicket, isInitialized } = useTicket();
  const { AlertComponent, showSuccess, showError } = useCustomAlert();
  
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('weekly');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedTickets, setExpandedTickets] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const isLoadingRef = useRef(false);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    fetchActiveTicket().catch(err => console.error('Error fetching active ticket:', err));
  }, []);

  const getFilterDates = useCallback(() => {
    const now = new Date();
    const endDate = now.toISOString().split('T')[0];
    let startDate: string;
    switch (selectedFilter) {
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case 'monthly':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      default:
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }
    return { startDate, endDate };
  }, [selectedFilter]);

  const loadTickets = useCallback(async (reset: boolean = false) => {
    if (isLoadingRef.current) return;
    if (!reset && !hasMoreRef.current) return;

    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);
    
    try {
      const { startDate, endDate } = getFilterDates();
      const currentPage = reset ? 1 : pageRef.current;
      
      const response = await ticketsApi.getTicketHistory({
        from: startDate,
        to: endDate,
        page: currentPage,
        per_page: 15,
        status: selectedStatus === 'all' ? undefined : selectedStatus,
      });

      const newTickets = response.data || [];
      
      if (reset) {
        setTickets(newTickets);
        pageRef.current = 2;
      } else {
        setTickets(prev => [...prev, ...newTickets]);
        pageRef.current = currentPage + 1;
      }
      
      const pagination = response.meta || (response as any).pagination;
      hasMoreRef.current = pagination ? pagination.current_page < pagination.last_page : false;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Impossible de charger l\'historique.';
      setError(errorMessage);
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [getFilterDates, selectedStatus]);

  useEffect(() => {
    pageRef.current = 1;
    hasMoreRef.current = true;
    isLoadingRef.current = false;
    loadTickets(true);
  }, [selectedFilter, selectedStatus]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTickets(true);
    setRefreshing(false);
  };

  const handleLoadMore = () => {
    if (!isLoadingRef.current && hasMoreRef.current) {
      loadTickets(false);
    }
  };

  const toggleTicketExpansion = (ticketId: number) => {
    const newExpanded = new Set(expandedTickets);
    if (newExpanded.has(ticketId)) {
      newExpanded.delete(ticketId);
    } else {
      newExpanded.add(ticketId);
    }
    setExpandedTickets(newExpanded);
  };

  const handleRejoinQueue = async (ticket: Ticket) => {
    if (!ticket.service_id) return;
    try {
      const newTicket = await ticketsApi.rejoinQueue(ticket.service_id);
      showSuccess('Ticket créé', `Votre ticket ${newTicket.number} a été créé.`, 'OK');
      router.push('/(tabs)/tickets');
    } catch (error) {
      showError('Erreur', 'Impossible de rejoindre la file.');
    }
  };

  const renderFooter = () => {
    if (!hasMoreRef.current) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.footerText, { color: colors.textTertiary }]}>Chargement...</Text>
      </View>
    );
  };

  const showActiveTicketHeader = selectedStatus === 'all' && isInitialized && hasActiveTicket && activeTicket;
  const hasTickets = tickets.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <HistoryHeader
        selectedFilter={selectedFilter}
        selectedStatus={selectedStatus}
        colors={colors}
        onFilterPress={setSelectedFilter}
        onStatusPress={setSelectedStatus}
      />

      <Animated.FlatList
        data={tickets}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <Animated.View style={{ opacity: fadeAnim }}>
            {showActiveTicketHeader && (
              <ActiveTicketCardCompact
                activeTicket={activeTicket}
                isCalled={isCalled}
                counterNumber={counterNumber}
                colors={colors}
                onPress={() => router.push('/(tabs)/live-ticket')}
              />
            )}
            {showActiveTicketHeader && hasTickets && (
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Tickets passés</Text>
            )}
          </Animated.View>
        }
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : error ? (
            <ErrorState colors={colors} error={error} onRetry={() => loadTickets(true)} />
          ) : (
            <EmptyState colors={colors} onScanPress={() => router.push('/(tabs)/scan')} />
          )
        }
        renderItem={({ item }) => (
          <TicketHistoryCard
            ticket={item}
            colors={colors}
            isExpanded={expandedTickets.has(item.id)}
            onPress={() => toggleTicketExpansion(item.id)}
            onRejoin={() => handleRejoinQueue(item)}
          />
        )}
      />
      {AlertComponent}
    </View>
  );
};

const styles = {
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 50 : 40, paddingBottom: 12, borderBottomWidth: 1 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: '800' },
  headerBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  headerBadgeText: { fontSize: 11, fontWeight: '600' },
  filterScroll: { paddingRight: 16, gap: 8, marginBottom: 12 },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, gap: 6 },
  filterChipText: { fontSize: 13, fontWeight: '500' },
  statusScroll: { paddingRight: 16, gap: 8, marginBottom: 4 },
  statusChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  statusChipText: { fontSize: 13, fontWeight: '500' },
  listContent: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, marginTop: 8 },
  activeCard: { borderRadius: 20, padding: 16, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  activeCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 4 },
  activeCardLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  activeCardName: { fontSize: 15, fontWeight: '700', color: '#FFF',flexWrap: 'wrap',flexShrink: 1,width: '100%', },
  activeCardService: { fontSize: 12, marginTop: 2 },
  activeCardNumber: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12},
  activeCardNumberText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  activeCardStats: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 12 },
  activeStat: { flex: 1, alignItems: 'center', gap: 4 },
  activeStatValue: { fontSize: 14, fontWeight: '700', color: '#FFF', alignItems: 'center',textAlign:"center" },
  activeStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)' },
  activeStatDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },
  ticketCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  ticketCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  ticketInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 12 },
  ticketNumberBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  ticketNumber: { fontSize: 14, fontWeight: '800' },
  ticketMeta: { flex: 1 },
  ticketName: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  ticketService: { fontSize: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  ticketCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateText: { fontSize: 12 },
  timeText: { fontSize: 11 },
  expandedContent: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, gap: 10 },
  expandedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  expandedLabel: { fontSize: 13 },
  expandedValue: { fontSize: 14, fontWeight: '600' },
  rejoinButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, gap: 6, marginTop: 4 },
  rejoinButtonText: { fontSize: 13, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyIconContainer: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  errorIconContainer: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 32 },
  emptyButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16, gap: 8 },
  emptyButtonText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  loaderContainer: { alignItems: 'center', paddingVertical: 60 },
  footerLoader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20, gap: 8 },
  footerText: { fontSize: 12 },
};

export default HistoryScreen;