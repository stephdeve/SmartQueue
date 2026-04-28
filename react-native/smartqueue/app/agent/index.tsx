import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { useAuth } from '../../src/store/authStore';
import { useCustomAlert } from '../../src/hooks/useCustomAlert';
import axiosClient from '../../src/api/axiosClient';
import { useFocusEffect } from '@react-navigation/native';

const { width } = Dimensions.get('window');

type Service = {
  id: number;
  name: string;
  status: string;
  avg_service_time_minutes?: number;
  people_waiting?: number;
};

type Counter = {
  id: number;
  name: string;
  status: string;
};

export default function AgentHome() {
  const colors = useThemeColors();
  const { user, logout } = useAuth();
  const { AlertComponent, showWarning, showError } = useCustomAlert();
  const [services, setServices] = useState<Service[]>([]);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedCounter, setSelectedCounter] = useState<Counter | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isTogglingCounter, setIsTogglingCounter] = useState(false);

  // Time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Bonjour';
    if (hour >= 12 && hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  const loadData = async () => {
    try {
      // Get services and counters from user object
      const assignedServices = (user as any)?.services || [];
      const assignedCounters = (user as any)?.counters || [];
      
      console.log('[AgentHome] User services:', assignedServices);
      
      if (assignedServices.length === 0) {
        setServices([]);
        setIsLoading(false);
        return;
      }
      
      // Load stats for each assigned service
      const servicesWithStats = await Promise.all(
        assignedServices.map(async (s: Service) => {
          try {
            const response = await axiosClient.get(`/services/${s.id}/affluence`);
            return {
              ...s,
              people_waiting: response.data?.waiting || response.data?.people || 0,
            };
          } catch {
            return { ...s, people_waiting: 0 };
          }
        })
      );
      setServices(servicesWithStats);
      setCounters(assignedCounters);
      
      // Auto-select first service if available
      if (servicesWithStats.length > 0) {
        setSelectedService(servicesWithStats[0]);
      }
      if (assignedCounters.length > 0) {
        setSelectedCounter(assignedCounters[0]);
      }
    } catch (error) {
      console.error('Error loading agent data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [user])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const navigateToProfile = () => {
    router.push('/agent/profile');
  };

  const navigateToStats = () => {
    router.push('/agent/stats');
  };

  const toggleCounter = async (counter: Counter) => {
    if (isTogglingCounter) return;
    setIsTogglingCounter(true);
    try {
      const isOpening = counter.status !== 'open';
      const endpoint = isOpening ? `/counters/${counter.id}/open` : `/counters/${counter.id}/close`;
      await axiosClient.post(endpoint);
      
      // Update local state
      setCounters(prev => prev.map(c => 
        c.id === counter.id 
          ? { ...c, status: isOpening ? 'open' : 'closed' }
          : c
      ));
      if (selectedCounter?.id === counter.id) {
        setSelectedCounter({ ...counter, status: isOpening ? 'open' : 'closed' });
      }
    } catch (error: any) {
      showError('Erreur', error?.response?.data?.message || 'Impossible de modifier le statut du guichet');
    } finally {
      setIsTogglingCounter(false);
    }
  };

  const navigateToQueue = () => {
    if (!selectedService) {
      showError('Erreur', 'Veuillez sélectionner un service');
      return;
    }
    router.push(`/agent/queue?serviceId=${selectedService.id}${selectedCounter ? `&counterId=${selectedCounter.id}` : ''}`);
  };

  const navigateToCalled = () => {
    if (!selectedService) {
      showError('Erreur', 'Veuillez sélectionner un service');
      return;
    }
    router.push(`/agent/called?serviceId=${selectedService.id}`);
  };

  const navigateToAbsent = () => {
    if (!selectedService) {
      showError('Erreur', 'Veuillez sélectionner un service');
      return;
    }
    router.push(`/agent/absent?serviceId=${selectedService.id}`);
  };

  const navigateToPriority = () => {
    if (!selectedService) {
      showError('Erreur', 'Veuillez sélectionner un service');
      return;
    }
    router.push(`/agent/priority?serviceId=${selectedService.id}`);
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>Bonjour,</Text>
          <Text style={[styles.userName, { color: colors.textPrimary }]}>{user?.name}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={[styles.roleBadge, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="person" size={16} color={colors.primary} />
            <Text style={[styles.roleText, { color: colors.primary }]}>{user?.role === 'admin' ? 'Admin' : 'Agent'}</Text>
          </View>
          <TouchableOpacity onPress={navigateToProfile} style={styles.profileButton}>
            <Ionicons name="person-circle-outline" size={28} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Service Selection */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Service assigné</Text>
        {services.length === 0 ? (
          <View style={[styles.emptyServiceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.textSecondary} />
            <Text style={[styles.emptyServiceText, { color: colors.textSecondary }]}>
              Aucun service assigné
            </Text>
            <Text style={[styles.emptyServiceHint, { color: colors.textSecondary }]}>
              Contactez votre administrateur pour être assigné à un service
            </Text>
          </View>
        ) : (
          <FlatList
            data={services}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.serviceCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  selectedService?.id === item.id && { borderColor: colors.primary, borderWidth: 2 }
                ]}
                onPress={() => setSelectedService(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.serviceIcon, { backgroundColor: colors.primary + '20' }]}>
                  <Ionicons name="layers" size={24} color={colors.primary} />
                </View>
                <Text style={[styles.serviceName, { color: colors.textPrimary }]}>{item.name}</Text>
                <View style={[styles.statusBadge, { backgroundColor: item.status === 'open' ? '#4CAF50' : '#FF5722' }]}>
                  <Text style={styles.statusText}>{item.status === 'open' ? 'Ouvert' : 'Fermé'}</Text>
                </View>
                <Text style={[styles.waitingText, { color: colors.textSecondary }]}>
                  {item.people_waiting} en attente
                </Text>
              </TouchableOpacity>
            )}
            style={styles.servicesList}
          />
        )}
      </View>

      {/* Counter Selection */}
      {counters.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Guichet</Text>
          <FlatList
            data={counters}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <View style={[
                styles.counterCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                selectedCounter?.id === item.id && { borderColor: colors.primary, borderWidth: 2 }
              ]}>
                <TouchableOpacity
                  style={styles.counterContent}
                  onPress={() => setSelectedCounter(item)}
                >
                  <Ionicons name="desktop-outline" size={20} color={colors.primary} />
                  <Text style={[styles.counterName, { color: colors.textPrimary }]}>{item.name}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.counterToggle, { 
                    backgroundColor: item.status === 'open' ? '#4CAF50' : '#9E9E9E',
                    opacity: isTogglingCounter ? 0.6 : 1
                  }]}
                  onPress={() => toggleCounter(item)}
                  disabled={isTogglingCounter}
                >
                  <Text style={styles.counterStatusText}>
                    {item.status === 'open' ? 'Ouvert' : 'Fermé'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            style={styles.countersList}
          />
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Actions rapides</Text>
        
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={navigateToQueue}
          activeOpacity={0.7}
        >
          <Ionicons name="list" size={24} color="white" />
          <Text style={[styles.actionButtonText]}>Gérer la file d&apos;attente</Text>
          <Ionicons name="chevron-forward" size={20} color="white" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#8B5CF6' }]}
          onPress={navigateToStats}
          activeOpacity={0.7}
        >
          <Ionicons name="stats-chart" size={24} color="white" />
          <Text style={[styles.actionButtonText]}>Voir les statistiques</Text>
          <Ionicons name="chevron-forward" size={20} color="white" />
        </TouchableOpacity>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.smallActionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={navigateToCalled}
            activeOpacity={0.7}
          >
            <Ionicons name="megaphone-outline" size={24} color="#FF9500" />
            <Text style={[styles.smallActionText, { color: colors.textPrimary }]}>Appelés</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.smallActionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={navigateToAbsent}
            activeOpacity={0.7}
          >
            <Ionicons name="person-remove-outline" size={24} color="#FF3B30" />
            <Text style={[styles.smallActionText, { color: colors.textPrimary }]}>Absents</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.smallActionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={navigateToPriority}
            activeOpacity={0.7}
          >
            <Ionicons name="star-outline" size={24} color="#FFD60A" />
            <Text style={[styles.smallActionText, { color: colors.textPrimary }]}>Priorité</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      {selectedService && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Statistiques</Text>
          <View style={[styles.statsContainer, { backgroundColor: colors.surface , borderColor: colors.border}]}>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{selectedService.people_waiting || 0}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>En attente</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{selectedService.avg_service_time_minutes || 5} min</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Temps moyen</Text>
            </View>
          </View>
        </View>
      )}

      {AlertComponent}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  greeting: {
    fontSize: 14,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  servicesList: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  serviceCard: {
    width: 140,
    padding: 16,
    borderRadius: 16,
    marginRight: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  serviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: 4,
  },
  statusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  waitingText: {
    fontSize: 12,
  },
  emptyServiceCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyServiceText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyServiceHint: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  countersList: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  counterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 1,
    gap: 8,
  },
  counterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  counterName: {
    fontSize: 14,
    fontWeight: '500',
  },
  counterToggle: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  counterStatusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    gap: 12,
  },
  actionButtonText: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  smallActionCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  smallActionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
    borderRadius: 16,
    borderWidth:1,
    paddingBottom:20,
 
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  profileButton: {
    padding: 4,
  },
});
