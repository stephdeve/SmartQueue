import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useCallback } from 'react';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import axiosClient from '../../src/api/axiosClient';
import { useFocusEffect } from '@react-navigation/native';

type Ticket = {
  id: number;
  number: string;
  status: string;
  priority: string;
  position: number;
  created_at: string;
};

export default function PriorityTickets() {
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ serviceId: string }>();
  const serviceId = params.serviceId;

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    if (!serviceId) return;
    try {
      const response = await axiosClient.get('/agent/tickets', {
        params: {
          service_id: parseInt(serviceId),
          per_page: 50,
        },
      });
      // Tickets prioritaires encore en file (les tickets clos/annulés du jour n'ont rien à faire ici)
      const allTickets = response.data?.data || [];
      const priorityFiltered = allTickets.filter((t: Ticket) =>
        t.status === 'waiting' &&
        (t.priority === 'urgence' || t.priority === 'high' || t.priority === 'vip')
      );
      setTickets(priorityFiltered);
    } catch (error) {
      console.error('Error fetching priority tickets:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [serviceId])
  );

  const callTicket = async (ticketId: number) => {
    try {
      // Pas d'endpoint « call » dédié : recall appelle n'importe quel ticket actif
      await axiosClient.post(`/tickets/${ticketId}/recall`);
      fetchData();
    } catch (error: any) {
      console.error('Error calling ticket:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    if (priority === 'urgence') return '#FF3B30';
    if (priority === 'vip') return '#FFD60A';
    if (priority === 'high') return '#FF9500';
    return colors.textSecondary;
  };

  const getPriorityIcon = (priority: string) => {
    if (priority === 'urgence') return 'alert-circle';
    if (priority === 'vip') return 'star';
    if (priority === 'high') return 'star-half';
    return 'star-outline';
  };

  const renderTicket = ({ item }: { item: Ticket }) => (
    <View style={[styles.ticketCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.ticketHeader}>
        <View style={[styles.priorityIcon, { backgroundColor: getPriorityColor(item.priority) + '20' }]}>
          <Ionicons name={getPriorityIcon(item.priority) as any} size={24} color={getPriorityColor(item.priority)} />
        </View>
        <View style={styles.ticketInfo}>
          <Text style={[styles.ticketNumber, { color: colors.textPrimary }]}>{item.number}</Text>
          <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) }]}>
            <Text style={styles.priorityText}>{item.priority?.toUpperCase()}</Text>
          </View>
        </View>
        <View style={styles.ticketMeta}>
          <Text style={[styles.positionText, { color: colors.textSecondary }]}>Pos. {item.position}</Text>
        </View>
      </View>
      
      {item.status === 'waiting' && (
        <TouchableOpacity 
          style={[styles.callBtn, { backgroundColor: colors.primary }]}
          onPress={() => callTicket(item.id)}
        >
          <Ionicons name="megaphone" size={18} color="white" />
          <Text style={styles.callBtnText}>Appeler</Text>
        </TouchableOpacity>
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
          <Ionicons name="star" size={24} color="#FFD60A" />
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Tickets priorité</Text>
        </View>
        <View style={[styles.countBadge, { backgroundColor: '#FFD60A' }]}>
          <Text style={[styles.countText, { color: '#000' }]}>{tickets.length}</Text>
        </View>
      </View>

      {/* Legend */}
      <View style={[styles.legendRow, { backgroundColor: colors.surface }]}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FF3B30' }]} />
          <Text style={[styles.legendText, { color: colors.textPrimary }]}>Urgence</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FFD60A' }]} />
          <Text style={[styles.legendText, { color: colors.textPrimary }]}>VIP</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FF9500' }]} />
          <Text style={[styles.legendText, { color: colors.textPrimary }]}>High</Text>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={tickets}
        renderItem={renderTicket}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="star-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Aucun ticket prioritaire</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Les tickets VIP et haute priorité apparaîtront ici
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
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
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  countBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    fontWeight: '700',
    fontSize: 14,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    padding: 12,
    margin: 16,
    borderRadius: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  ticketCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  ticketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ticketInfo: {
    flex: 1,
    marginLeft: 12,
  },
  ticketNumber: {
    fontSize: 18,
    fontWeight: '700',
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 4,
  },
  priorityText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
  ticketMeta: {
    alignItems: 'flex-end',
  },
  positionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  callBtnText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
