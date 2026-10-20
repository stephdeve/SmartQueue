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
  priority_reason?: string | null;
  source?: string | null;
  display_name?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  is_senior?: boolean;
  is_handicap?: boolean;
  is_pregnant?: boolean;
  service_name: string;
  user_name: string;
  user_email: string;
  user_phone: string;
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
    if (minutes < 60) return `${Math.round(minutes)}min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h${mins}` : `${hours}h`;
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
      case 'en_route': return '#F59E0B';
      case 'present': return '#8B5CF6';
      default: return '#6B7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'closed': return 'Terminé';
      case 'called': return 'Appelé';
      case 'absent': return 'Absent';
      case 'waiting': return 'Attente';
      case 'en_route': return 'En route';
      case 'present': return 'Présent';
      default: return status;
    }
  };

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'urgence': return { color: '#FF3B30', label: 'Urgence', icon: 'alert-circle' as const };
      case 'vip':     return { color: '#8B5CF6', label: 'VIP',     icon: 'star' as const };
      case 'high':    return { color: '#FF9500', label: 'Prioritaire', icon: 'flame' as const };
      default:        return { color: '#8E8E93', label: 'Normal',   icon: 'list' as const };
    }
  };

  const getSourceConfig = (source?: string | null) => {
    switch (source) {
      case 'qr_scan': return { icon: 'qr-code-outline' as const, label: 'QR Code' };
      case 'agent':   return { icon: 'person-circle-outline' as const, label: 'Agent' };
      case 'kiosk':   return { icon: 'desktop-outline' as const, label: 'Kiosk' };
      default:        return { icon: 'phone-portrait-outline' as const, label: 'App' };
    }
  };

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

  const renderOverview = () => {
    const absenteeismRate = stats?.today_total ? (stats.today_absent / stats.today_total) * 100 : 0;

    const renderInsight = () => {
      if ((stats?.today_absent ?? 0) > 3 && absenteeismRate > 20) {
        return (
          <View style={[styles.insightCard, { backgroundColor: '#FF3B3015', borderColor: '#FF3B30' }]}>
            <Text style={[styles.insightText, { color: '#FF3B30' }]}>⚠️ Taux d’absentéisme élevé aujourd’hui ({Math.round(absenteeismRate)}%)</Text>
          </View>
        );
      }
      if ((stats?.today_closed ?? 0) > (stats?.today_total ?? 0) * 0.8) {
        const rate = stats?.today_total ? Math.round((stats.today_closed / stats.today_total) * 100) : 0;
        return (
          <View style={[styles.insightCard, { backgroundColor: '#22C55E15', borderColor: '#22C55E' }]}>
            <Text style={[styles.insightText, { color: '#22C55E' }]}>✅ Bon taux de réalisation : {rate}%</Text>
          </View>
        );
      }
      if ((stats?.avg_wait_time ?? 0) > 15) {
        return (
          <View style={[styles.insightCard, { backgroundColor: '#FF950015', borderColor: '#FF9500' }]}>
            <Text style={[styles.insightText, { color: '#FF9500' }]}>⏱ Temps d’attente moyen élevé ({Math.round(stats?.avg_wait_time ?? 0)} min)</Text>
          </View>
        );
      }
      return (
        <View style={[styles.insightCard, { backgroundColor: '#3B82F615', borderColor: '#3B82F6' }]}>
          <Text style={[styles.insightText, { color: '#3B82F6' }]}>ℹ️ Activité normale aujourd’hui</Text>
        </View>
      );
    };

    return (
      <View style={styles.tabContent}>
        <View style={styles.statsGrid}>
          <StatCard icon="ticket-outline" value={stats?.today_total || 0} label="Total" color="#3B82F6" colors={colors} />
          <StatCard icon="checkmark-circle-outline" value={stats?.today_closed || 0} label="Traités" color="#22C55E" colors={colors} />
          <StatCard icon="megaphone-outline" value={stats?.today_called || 0} label="Appelés" color="#FF9500" colors={colors} />
          <StatCard icon="person-remove-outline" value={stats?.today_absent || 0} label="Absents" color="#FF3B30" colors={colors} />
        </View>

        {renderInsight()}

        <View style={[styles.timeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Temps moyens</Text>
          <View style={styles.timeRow}>
            <View style={styles.timeItem}>
              <Ionicons name="timer-outline" size={22} color={colors.primary} />
              <Text style={[styles.timeValue, { color: colors.textPrimary }]}>{formatTime(stats?.avg_service_time ?? null)}</Text>
              <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>Service</Text>
            </View>
            <View style={[styles.timeDivider, { backgroundColor: colors.border }]} />
            <View style={styles.timeItem}>
              <Ionicons name="hourglass-outline" size={22} color={colors.primary} />
              <Text style={[styles.timeValue, { color: colors.textPrimary }]}>{formatTime(stats?.avg_wait_time ?? null)}</Text>
              <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>Attente</Text>
            </View>
          </View>
        </View>

        <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>État actuel</Text>
          <View style={styles.statusRow}>
            <StatusItem value={stats?.active_services || 0} label="Services ouverts" color="#22C55E" colors={colors} dotColor={(stats?.active_services ?? 0) > 0 ? '#22C55E' : '#6B7280'} />
            <StatusItem value={stats?.current_queue_size || 0} label="En file" color="#F59E0B" colors={colors} dotColor={(stats?.current_queue_size ?? 0) > 15 ? '#FF3B30' : (stats?.current_queue_size ?? 0) > 5 ? '#FF9500' : '#22C55E'} />
            <StatusItem value={stats?.tickets_per_day || 0} label="Moy/jour (7j)" color="#8B5CF6" colors={colors} dotColor="#8B5CF6" />
          </View>
        </View>
      </View>
    );
  };

  const renderPerformance = () => {
    const daily = performance?.daily;
    let trendSection = null;
    if (daily && daily.length >= 2) {
      const mid = Math.floor(daily.length / 2);
      const firstHalf = daily.slice(0, mid);
      const secondHalf = daily.slice(mid);

      const firstClosed = firstHalf.reduce((s, d) => s + d.closed, 0);
      const secondClosed = secondHalf.reduce((s, d) => s + d.closed, 0);
      const firstAbsent = firstHalf.reduce((s, d) => s + d.absent, 0);
      const secondAbsent = secondHalf.reduce((s, d) => s + d.absent, 0);

      const closedTrend = firstClosed > 0 ? ((secondClosed - firstClosed) / firstClosed) * 100 : 0;
      const absentTrend = firstAbsent > 0 ? ((secondAbsent - firstAbsent) / firstAbsent) * 100 : 0;

      const closedArrow = closedTrend > 0 ? '↑' : closedTrend < 0 ? '↓' : '→';
      const absentArrow = absentTrend > 0 ? '↑' : absentTrend < 0 ? '↓' : '→';

      trendSection = (
        <View style={[styles.trendCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.trendLabel, { color: colors.textSecondary }]}>Tendance</Text>
          <View style={styles.trendRow}>
            <View style={styles.trendItem}>
              <Text style={[styles.trendValue, { color: closedTrend >= 0 ? '#22C55E' : '#FF3B30' }]}>
                {closedArrow} {Math.abs(Math.round(closedTrend))}%
              </Text>
              <Text style={[styles.trendSubLabel, { color: colors.textSecondary }]}>Traités</Text>
            </View>
            <View style={styles.trendItem}>
              <Text style={[styles.trendValue, { color: absentTrend > 0 ? '#FF3B30' : '#22C55E' }]}>
                {absentArrow} {Math.abs(Math.round(absentTrend))}%
              </Text>
              <Text style={[styles.trendSubLabel, { color: colors.textSecondary }]}>Absents</Text>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.summaryRow}>
            <SummaryItem value={performance?.total_closed || 0} label="Traités (7j)" color="#22C55E" colors={colors} />
            <SummaryItem value={performance?.total_absent || 0} label="Absents (7j)" color="#FF3B30" colors={colors} />
            <SummaryItem value={formatTime(performance?.avg_service_time ?? null)} label="Temps moyen" color={colors.primary} colors={colors} />
          </View>
        </View>

        {trendSection}

        {chartData && (
          <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Performance sur 7 jours</Text>
            <LineChart
              data={chartData}
              width={width - 32}
              height={180}
              chartConfig={{
                backgroundColor: colors.surface,
                backgroundGradientFrom: colors.surface,
                backgroundGradientTo: colors.surface,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                labelColor: () => colors.textSecondary,
                style: { borderRadius: 12 },
                propsForDots: { r: '3', strokeWidth: '2' },
              }}
              bezier
              style={styles.chart}
            />
          </View>
        )}

        <View style={[styles.dailyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Détail par jour</Text>
          {performance?.daily.slice().reverse().map((day, index) => (
            <View key={day.date} style={[styles.dailyRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: 0.5 }]}>
              <Text style={[styles.dailyDate, { color: colors.textPrimary }]}>
                {new Date(day.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}
              </Text>
              <View style={styles.dailyStats}>
                <DailyStat value={day.total} label="Total" color="#3B82F6" />
                <DailyStat value={day.closed} label="Traités" color="#22C55E" />
                <DailyStat value={day.absent} label="Absents" color="#FF3B30" />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderTickets = () => (
    <View style={styles.tabContent}>
      {stats && (
        <View style={[styles.ticketSummary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.ticketSummaryText, { color: colors.textSecondary }]}>
            {stats.today_total} tickets aujourd’hui — {stats.today_waiting} en attente, {stats.today_closed} clôturés, {stats.today_absent} absents
          </Text>
        </View>
      )}
      {todayTickets.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="ticket-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Aucun ticket aujourd’hui</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>Les tickets traités apparaîtront ici</Text>
        </View>
      ) : (
        todayTickets.map((ticket) => {
          const prio = getPriorityConfig(ticket.priority);
          const src = getSourceConfig(ticket.source);
          const name = ticket.display_name || ticket.user_name || null;
          const phone = ticket.customer_phone || ticket.user_phone || null;
          const hasAttrs = ticket.is_senior || ticket.is_handicap || ticket.is_pregnant;

          return (
            <View key={ticket.id} style={[styles.ticketCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {/* Header: numéro + statut */}
              <View style={styles.ticketHeader}>
                <View style={[styles.ticketNumberBadge, { backgroundColor: getStatusColor(ticket.status) }]}>
                  <Text style={styles.ticketNumberText}>{ticket.number}</Text>
                </View>
                <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginLeft: 8 }}>
                  <View style={[styles.badge, { backgroundColor: getStatusColor(ticket.status) + '18' }]}>
                    <Text style={[styles.badgeText, { color: getStatusColor(ticket.status) }]}>{getStatusLabel(ticket.status)}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: prio.color + '18' }]}>
                    <Ionicons name={prio.icon} size={10} color={prio.color} />
                    <Text style={[styles.badgeText, { color: prio.color }]}>{prio.label}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: colors.border + '60' }]}>
                    <Ionicons name={src.icon} size={10} color={colors.textSecondary} />
                    <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{src.label}</Text>
                  </View>
                </View>
              </View>

              {/* Infos client */}
              <View style={styles.ticketInfo}>
                <View style={styles.ticketInfoRow}>
                  <Ionicons name="business-outline" size={13} color={colors.textSecondary} />
                  <Text style={[styles.ticketInfoText, { color: colors.textPrimary, fontWeight: '600' }]}>{ticket.service_name}</Text>
                </View>
                {name && (
                  <View style={styles.ticketInfoRow}>
                    <Ionicons name="person-outline" size={13} color={colors.textSecondary} />
                    <Text style={[styles.ticketInfoText, { color: colors.textSecondary }]}>{name}</Text>
                  </View>
                )}
                {phone && (
                  <View style={styles.ticketInfoRow}>
                    <Ionicons name="call-outline" size={13} color={colors.textSecondary} />
                    <Text style={[styles.ticketInfoText, { color: colors.textSecondary }]}>{phone}</Text>
                  </View>
                )}
                {ticket.counter_name && (
                  <View style={styles.ticketInfoRow}>
                    <Ionicons name="desktop-outline" size={13} color={colors.textSecondary} />
                    <Text style={[styles.ticketInfoText, { color: colors.textSecondary }]}>{ticket.counter_name}</Text>
                  </View>
                )}
                {ticket.priority_reason && (
                  <View style={styles.ticketInfoRow}>
                    <Ionicons name="information-circle-outline" size={13} color={prio.color} />
                    <Text style={[styles.ticketInfoText, { color: prio.color }]}>{ticket.priority_reason}</Text>
                  </View>
                )}
                {hasAttrs && (
                  <View style={[styles.ticketInfoRow, { flexWrap: 'wrap', gap: 4 }]}>
                    {ticket.is_senior && (
                      <View style={[styles.attrBadge, { backgroundColor: '#007AFF18' }]}>
                        <Ionicons name="accessibility-outline" size={11} color="#007AFF" />
                        <Text style={[styles.attrText, { color: '#007AFF' }]}>Senior</Text>
                      </View>
                    )}
                    {ticket.is_handicap && (
                      <View style={[styles.attrBadge, { backgroundColor: '#8B5CF618' }]}>
                        <Ionicons name="heart-outline" size={11} color="#8B5CF6" />
                        <Text style={[styles.attrText, { color: '#8B5CF6' }]}>Handicap</Text>
                      </View>
                    )}
                    {ticket.is_pregnant && (
                      <View style={[styles.attrBadge, { backgroundColor: '#FF6B9D18' }]}>
                        <Ionicons name="body-outline" size={11} color="#FF6B9D" />
                        <Text style={[styles.attrText, { color: '#FF6B9D' }]}>Enceinte</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Horodatage */}
              <View style={styles.ticketFooter}>
                <Text style={[styles.ticketTime, { color: colors.textSecondary }]}>
                  Créé {formatTicketTime(ticket.created_at)}
                </Text>
                {ticket.called_at && (
                  <Text style={[styles.ticketTime, { color: colors.textSecondary }]}>
                    Appelé {formatTicketTime(ticket.called_at)}
                  </Text>
                )}
                {ticket.closed_at && (
                  <Text style={[styles.ticketTime, { color: '#22C55E' }]}>
                    Terminé {formatTicketTime(ticket.closed_at)}
                  </Text>
                )}
              </View>
            </View>
          );
        })
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Ionicons name="stats-chart" size={22} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Statistiques</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        <TabButton label="Vue d'ensemble" active={activeTab === 'overview'} onPress={() => setActiveTab('overview')} colors={colors} />
        <TabButton label="Performance" active={activeTab === 'performance'} onPress={() => setActiveTab('performance')} colors={colors} />
        <TabButton label="Tickets" active={activeTab === 'tickets'} onPress={() => setActiveTab('tickets')} colors={colors} />
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'performance' && renderPerformance()}
        {activeTab === 'tickets' && renderTickets()}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// Composants réutilisables
const StatCard = ({ icon, value, label, color, colors }: any) => (
  <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <View style={[styles.statIcon, { backgroundColor: color + '15' }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <Text style={[styles.statValue, { color: colors.textPrimary }]}>{value}</Text>
    <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{label}</Text>
  </View>
);

const StatusItem = ({ value, label, color, colors, dotColor }: any) => (
  <View style={styles.statusItem}>
    {dotColor !== undefined && (
      <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
    )}
    <View style={[styles.statusBadge, { backgroundColor: color + '15' }]}>
      <Text style={[styles.statusBadgeText, { color }]}>{value}</Text>
    </View>
    <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>{label}</Text>
  </View>
);

const SummaryItem = ({ value, label, color, colors }: any) => (
  <View style={styles.summaryItem}>
    <Text style={[styles.summaryValue, { color }]}>{value}</Text>
    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{label}</Text>
  </View>
);

const DailyStat = ({ value, label, color }: any) => (
  <View style={styles.dailyStat}>
    <View style={[styles.dailyDot, { backgroundColor: color }]} />
    <Text style={styles.dailyStatText}>{value}</Text>
  </View>
);

const TabButton = ({ label, active, onPress, colors }: any) => (
  <TouchableOpacity style={[styles.tab, active && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]} onPress={onPress}>
    <Text style={[styles.tabText, { color: active ? colors.primary : colors.textSecondary }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1 , paddingBottom:100 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 55, paddingBottom: 12, borderBottomWidth: 1 },
  backButton: { padding: 6, width: 36 },
  headerContent: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText: { fontSize: 13, fontWeight: '600' },
  content: { flex: 1, padding: 16 },
  tabContent: { gap: 16, paddingBottom:100 },
  
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: (width - 52) / 2, padding: 14, borderRadius: 14, borderWidth: 1, alignItems: 'center' },
  statIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { fontSize: 24, fontWeight: '800', marginBottom: 2 },
  statLabel: { fontSize: 11, fontWeight: '500' },
  
  timeCard: { padding: 16, borderRadius: 14, borderWidth: 1 },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  timeItem: { flex: 1, alignItems: 'center' },
  timeDivider: { width: 1, height: 40 },
  timeValue: { fontSize: 18, fontWeight: '700', marginTop: 6, marginBottom: 2 },
  timeLabel: { fontSize: 11, fontWeight: '500' },
  
  statusCard: { padding: 16, borderRadius: 14, borderWidth: 1 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statusItem: { alignItems: 'center' },
  statusBadge: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statusBadgeText: { fontSize: 18, fontWeight: '700' },
  statusLabel: { fontSize: 11, fontWeight: '500' },
  
  summaryCard: { padding: 16, borderRadius: 14, borderWidth: 1 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  summaryLabel: { fontSize: 11, fontWeight: '500' },
  
  chartCard: { padding: 14, borderRadius: 14, borderWidth: 1, alignItems: 'center' },
  chart: { marginVertical: 6, borderRadius: 12 },
  
  dailyCard: { padding: 14, borderRadius: 14, borderWidth: 1 },
  dailyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  dailyDate: { fontSize: 12, fontWeight: '500', flex: 1 },
  dailyStats: { flexDirection: 'row', gap: 12 },
  dailyStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dailyDot: { width: 6, height: 6, borderRadius: 3 },
  dailyStatText: { fontSize: 12, fontWeight: '600' },
  
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptySubtitle: { fontSize: 13, marginTop: 6, textAlign: 'center' },
  
  ticketCard: { padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  ticketHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  ticketNumberBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  ticketNumberText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 },
  badgeText: { fontSize: 10, fontWeight: '600' },
  ticketInfo: { gap: 5, marginBottom: 10 },
  ticketInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  ticketInfoText: { fontSize: 12, fontWeight: '500', flex: 1 },
  attrBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  attrText: { fontSize: 10, fontWeight: '600' },
  ticketFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#E5E7EB' },
  ticketTime: { fontSize: 10 },

  insightCard: { padding: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  insightText: { fontSize: 13, fontWeight: '600' },

  statusDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },

  trendCard: { padding: 16, borderRadius: 14, borderWidth: 1 },
  trendLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  trendRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
  trendItem: { alignItems: 'center' },
  trendValue: { fontSize: 18, fontWeight: '800' },
  trendSubLabel: { fontSize: 11, fontWeight: '500', marginTop: 2 },

  ticketSummary: { padding: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center', marginBottom: 4 },
  ticketSummaryText: { fontSize: 12, fontWeight: '500' },
});
