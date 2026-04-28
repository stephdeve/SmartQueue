import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { useAuth } from '../../src/store/authStore';
import axiosClient from '../../src/api/axiosClient';
import { useFocusEffect } from '@react-navigation/native';

type Ticket = {
  id: number;
  number: string;
  status: string;
  called_at: string | null;
  created_at: string;
};

export default function CalledTickets() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ serviceId: string }>();
  
  // Get serviceId from URL params or fallback to first assigned service
  const assignedServices = (user as any)?.services || [];
  const serviceId = params.serviceId || (assignedServices.length > 0 ? assignedServices[0].id.toString() : undefined);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    if (!serviceId) {
      console.log('[CalledTickets] No serviceId available');
      setIsLoading(false);
      return;
    }
    try {
      const response = await axiosClient.get('/agent/tickets', {
        params: {
          service_id: parseInt(serviceId),
          status: 'called',
          per_page: 50,
        },
      });
      setTickets(response.data?.data || []);
    } catch (error) {
      console.error('Error fetching called tickets:', error);
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

  const markAbsent = async (ticketId: number) => {
    try {
      await axiosClient.post(`/tickets/${ticketId}/mark-absent`);
      fetchData();
    } catch (error: any) {
      console.error('Error marking absent:', error);
    }
  };

  const closeTicket = async (ticketId: number) => {
    try {
      await axiosClient.post(`/tickets/${ticketId}/close`);
      fetchData();
    } catch (error: any) {
      console.error('Error closing ticket:', error);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const renderTicket = ({ item }: { item: Ticket }) => (
    <View style={[styles.ticketCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.ticketHeader}>
        <View style={[styles.ticketNumber, { backgroundColor: '#FF9500' }]}>
          <Text style={styles.ticketNumberText}>{item.number}</Text>
        </View>
        <Text style={[styles.ticketTime, { color: colors.textSecondary }]}>
          Appelé à {formatTime(item.called_at || item.created_at)}
        </Text>
      </View>
      <View style={styles.ticketActions}>
        <TouchableOpacity 
          style={[styles.actionBtn, { backgroundColor: '#FF3B30' }]}
          onPress={() => markAbsent(item.id)}
        >
          <Ionicons name="person-remove" size={18} color="white" />
          <Text style={styles.actionBtnText}>Absent</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionBtn, { backgroundColor: '#4CAF50' }]}
          onPress={() => closeTicket(item.id)}
        >
          <Ionicons name="checkmark-circle" size={18} color="white" />
          <Text style={styles.actionBtnText}>Terminer</Text>
        </TouchableOpacity>
      </View>
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
          <Ionicons name="megaphone" size={24} color="#FF9500" />
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Tickets appelés</Text>
        </View>
        <View style={[styles.countBadge, { backgroundColor: '#FF9500' }]}>
          <Text style={styles.countText}>{tickets.length}</Text>
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
            <Ionicons name="megaphone-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Aucun ticket appelé</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Les tickets appelés apparaîtront ici
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
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
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
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  ticketNumber: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  ticketNumberText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 18,
  },
  ticketTime: {
    fontSize: 12,
  },
  ticketActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 6,
  },
  actionBtnText: {
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
