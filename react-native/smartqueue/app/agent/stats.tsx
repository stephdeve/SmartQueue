import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, useCallback } from 'react';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { useAuth } from '../../src/store/authStore';
import axiosClient from '../../src/api/axiosClient';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';

const { width } = Dimensions.get('window');

type DashboardStats = {
  today_total: number;
  today_called: number;
  today_closed: number;
  today_waiting: number;
  today_absent: number;
  avg_service_time: number | null;
  avg_wait_time: number | null;
  tickets_per_day: number;
  active_services: number;
  current_queue_size: number;
};

type PerformanceData = {
  daily: {
    date: string;
    total: number;
    closed: number;
    absent: number;
  }[];
  total_closed: number;
  total_absent: number;
  avg_service_time: number | null;
};

type TodayTicket = {
  id: number;
  number: string;
  status: string;
  priority: string;
  service_name: string;
  user_name: string;
  counter_name: string | null;
  called_at: string | null;
  closed_at: string | null;
  created_at: string;
};

export default function AgentStats() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [todayTickets, setTodayTickets] = useState<TodayTicket[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'tickets'>('overview');

  const fetchData = async () => {
    try {
      const [statsRes, perfRes, ticketsRes] = await Promise.all([
        axiosClient.get('/agent/dashboard/stats'),
        axiosClient.get('/agent/dashboard/performance'),
        axiosClient.get('/agent/dashboard/today-tickets'),
      ]);
      setStats(statsRes.data);
      setPerformance(perfRes.data);
      setTodayTickets(ticketsRes.data || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const formatTime = (minutes: number | null) => {
    if (!minutes) return '--';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const formatTicketTime = (dateStr: string | null) => {
    if (!dateStr) return '--:--';
    return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'closed': return '#22C55E';
      case 'called': return '#FF9500';
      case 'absent': return '#FF3B30';
      case 'waiting': return '#3B82F6';
      default: return '#6B7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'closed': return 'Terminé';
      case 'called': return 'Appelé';
      case 'absent': return 'Absent';
      case 'waiting': return 'En attente';
      default: return status;
    }
  };

  // Chart data preparation
  const chartData = performance?.daily ? {
    labels: performance.daily.slice(-7).map(d => 
      new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3)
    ),
    datasets: [
      {
        data: performance.daily.slice(-7).map(d => d.closed),
        color: () => '#22C55E',
        strokeWidth: 2,
      },
      {
        data: performance.daily.slice(-7).map(d => d.total),
        color: () => '#3B82F6',
        strokeWidth: 2,
      },
    ],
    legend: ['Traités', 'Total'],
  } : null;

  const renderOverview = () => (
    <View style={styles.tabContent}>
      {/* Stats Cards Grid */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.statIcon, { backgroundColor: '#3B82F620' }]}>
            <Ionicons name="ticket-outline" size={24} color="#3B82F6" />
          </View>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats?.today_total || 0}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total aujourd&apos;hui</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.statIcon, { backgroundColor: '#22C55E20' }]}>
            <Ionicons name="checkmark-circle-outline" size={24} color="#22C55E" />
          </View>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats?.today_closed || 0}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Traités</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.statIcon, { backgroundColor: '#FF950020' }]}>
            <Ionicons name="megaphone-outline" size={24} color="#FF9500" />
          </View>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats?.today_called || 0}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Appelés</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.statIcon, { backgroundColor: '#FF3B3020' }]}>
            <Ionicons name="person-remove-outline" size={24} color="#FF3B30" />
          </View>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats?.today_absent || 0}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Absents</Text>
        </View>
      </View>

      {/* Time Metrics */}
      <View style={[styles.timeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Temps moyens</Text>
        <View style={styles.timeRow}>
          <View style={styles.timeItem}>
            <Ionicons name="timer-outline" size={28} color={colors.primary} />
            <Text style={[styles.timeValue, { color: colors.textPrimary }]}>
              {formatTime(stats?.avg_service_time ?? null)}
            </Text>
            <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>Temps de service</Text>
          </View>
          <View style={[styles.timeDivider, { backgroundColor: colors.border }]} />
          <View style={styles.timeItem}>
            <Ionicons name="hourglass-outline" size={28} color={colors.primary} />
            <Text style={[styles.timeValue, { color: colors.textPrimary }]}>
              {formatTime(stats?.avg_wait_time ?? null)}
            </Text>
            <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>Temps d&apos;attente</Text>
          </View>
        </View>
      </View>

      {/* Current Status */}
      <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>État actuel</Text>
        <View style={styles.statusRow}>
          <View style={styles.statusItem}>
            <View style={[styles.statusBadge, { backgroundColor: '#22C55E20' }]}>
              <Text style={[styles.statusBadgeText, { color: '#22C55E' }]}>{stats?.active_services || 0}</Text>
            </View>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Services ouverts</Text>
          </View>
          <View style={styles.statusItem}>
            <View style={[styles.statusBadge, { backgroundColor: '#F59E0B20' }]}>
              <Text style={[styles.statusBadgeText, { color: '#F59E0B' }]}>{stats?.current_queue_size || 0}</Text>
            </View>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>En file d&apos;attente</Text>
          </View>
          <View style={styles.statusItem}>
            <View style={[styles.statusBadge, { backgroundColor: '#8B5CF620' }]}>
              <Text style={[styles.statusBadgeText, { color: '#8B5CF6' }]}>{stats?.tickets_per_day || 0}</Text>
            </View>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Moy/jour (7j)</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderPerformance = () => (
    <View style={styles.tabContent}>
      {/* Performance Summary */}
      <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: '#22C55E' }]}>{performance?.total_closed || 0}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Traités (7j)</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: '#FF3B30' }]}>{performance?.total_absent || 0}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Absents (7j)</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.primary }]}>
              {formatTime(performance?.avg_service_time ?? null)}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Temps moyen</Text>
          </View>
        </View>
      </View>

      {/* Chart */}
      {chartData && (
        <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Performance sur 7 jours</Text>
          <LineChart
            data={chartData}
            width={width - 72}
            height={200}
            chartConfig={{
              backgroundColor: colors.surface,
              backgroundGradientFrom: colors.surface,
              backgroundGradientTo: colors.surface,
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
              labelColor: () => colors.textSecondary,
              style: {
                borderRadius: 16,
              },
              propsForDots: {
                r: '4',
                strokeWidth: '2',
              },
            }}
            bezier
            style={styles.chart}
          />
        </View>
      )}

      {/* Daily Breakdown */}
      <View style={[styles.dailyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Détail par jour</Text>
        {performance?.daily.slice().reverse().map((day, index) => (
          <View key={day.date} style={[styles.dailyRow, index < performance.daily.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
            <Text style={[styles.dailyDate, { color: colors.textPrimary }]}>
              {new Date(day.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}
            </Text>
            <View style={styles.dailyStats}>
              <View style={styles.dailyStat}>
                <View style={[styles.dailyDot, { backgroundColor: '#3B82F6' }]} />
                <Text style={[styles.dailyStatText, { color: colors.textSecondary }]}>{day.total}</Text>
              </View>
              <View style={styles.dailyStat}>
                <View style={[styles.dailyDot, { backgroundColor: '#22C55E' }]} />
                <Text style={[styles.dailyStatText, { color: colors.textSecondary }]}>{day.closed}</Text>
              </View>
              <View style={styles.dailyStat}>
                <View style={[styles.dailyDot, { backgroundColor: '#FF3B30' }]} />
                <Text style={[styles.dailyStatText, { color: colors.textSecondary }]}>{day.absent}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  const renderTickets = () => (
    <View style={styles.tabContent}>
      {todayTickets.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="ticket-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Aucun ticket aujourd&apos;hui</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Les tickets traités apparaîtront ici
          </Text>
        </View>
      ) : (
        todayTickets.map((ticket, index) => (
          <View 
            key={ticket.id} 
            style={[
              styles.ticketCard, 
              { backgroundColor: colors.surface, borderColor: colors.border },
              index === 0 && { marginTop: 0 }
            ]}
          >
            <View style={styles.ticketHeader}>
              <View style={[styles.ticketNumber, { backgroundColor: getStatusColor(ticket.status) }]}>
                <Text style={styles.ticketNumberText}>{ticket.number}</Text>
              </View>
              <View style={[styles.ticketStatusBadge, { backgroundColor: getStatusColor(ticket.status) + '20' }]}>
                <Text style={[styles.ticketStatusText, { color: getStatusColor(ticket.status) }]}>
                  {getStatusLabel(ticket.status)}
                </Text>
              </View>
            </View>
            
            <View style={styles.ticketInfo}>
              <View style={styles.ticketInfoRow}>
                <Ionicons name="business-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.ticketInfoText, { color: colors.textPrimary }]}>{ticket.service_name}</Text>
              </View>
              {ticket.user_name && (
                <View style={styles.ticketInfoRow}>
                  <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.ticketInfoText, { color: colors.textSecondary }]}>{ticket.user_name}</Text>
                </View>
              )}
              {ticket.counter_name && (
                <View style={styles.ticketInfoRow}>
                  <Ionicons name="desktop-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.ticketInfoText, { color: colors.textSecondary }]}>{ticket.counter_name}</Text>
                </View>
              )}
            </View>

            <View style={styles.ticketFooter}>
              <Text style={[styles.ticketTime, { color: colors.textSecondary }]}>
                Créé à {formatTicketTime(ticket.created_at)}
              </Text>
              {ticket.called_at && (
                <Text style={[styles.ticketTime, { color: colors.textSecondary }]}>
                  Appelé à {formatTicketTime(ticket.called_at)}
                </Text>
              )}
            </View>
          </View>
        ))
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Ionicons name="stats-chart" size={24} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Statistiques</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Tab Navigation */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'overview' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[
            styles.tabText, 
            { color: activeTab === 'overview' ? colors.primary : colors.textSecondary }
          ]}>
            Vue d&apos;ensemble
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'performance' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('performance')}
        >
          <Text style={[
            styles.tabText, 
            { color: activeTab === 'performance' ? colors.primary : colors.textSecondary }
          ]}>
            Performance
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'tickets' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('tickets')}
        >
          <Text style={[
            styles.tabText, 
            { color: activeTab === 'tickets' ? colors.primary : colors.textSecondary }
          ]}>
            Tickets
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'performance' && renderPerformance()}
        {activeTab === 'tickets' && renderTickets()}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    width: 40,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  tabContent: {
    gap: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: (width - 52) / 2,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  timeCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeItem: {
    flex: 1,
    alignItems: 'center',
  },
  timeDivider: {
    width: 1,
    height: 60,
  },
  timeValue: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statusItem: {
    alignItems: 'center',
  },
  statusBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadgeText: {
    fontSize: 20,
    fontWeight: '700',
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  summaryCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  chartCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  dailyCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  dailyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  dailyDate: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  dailyStats: {
    flexDirection: 'row',
    gap: 16,
  },
  dailyStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dailyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dailyStatText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  ticketCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ticketNumber: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  ticketNumberText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  ticketStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  ticketStatusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  ticketInfo: {
    gap: 8,
    marginBottom: 12,
  },
  ticketInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ticketInfoText: {
    fontSize: 14,
    fontWeight: '500',
  },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  ticketTime: {
    fontSize: 12,
  },
});
