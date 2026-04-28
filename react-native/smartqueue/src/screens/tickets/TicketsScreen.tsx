import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTicket } from '../../store/ticketStore';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useSimpleNotification } from '../../hooks/useSimpleNotification';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');

// Composant TicketsScreen
export const TicketsScreen: React.FC = () => {
  const colors = useThemeColors();
  const {
    hasActiveTicket,
    activeTicket,
    position,
    etaMinutes,
    isAlmostThere,
    isCalled,
    error,
    fetchActiveTicket,
    cancelTicket,
    isInitialized,
  } = useTicket();
  const { AlertComponent, showWarning, showError } = useCustomAlert();
  const { notifyTicketCreated } = useSimpleNotification();
  
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = new Animated.Value(0);

  // Notify when active ticket is detected
  const hasNotifiedRef = React.useRef(false);
  useEffect(() => {
    if (hasActiveTicket && activeTicket && !hasNotifiedRef.current) {
      notifyTicketCreated(
        activeTicket.number,
        activeTicket.establishment?.name || 'Établissement'
      );
      hasNotifiedRef.current = true;
    } else if (!hasActiveTicket) {
      hasNotifiedRef.current = false;
    }
  }, [hasActiveTicket, activeTicket, notifyTicketCreated]);

  // Debug log
  useEffect(() => {
    console.log('[TicketsScreen] State:', { hasActiveTicket, isInitialized, activeTicketId: activeTicket?.id, position });
  }, [hasActiveTicket, isInitialized, activeTicket, position]);

  // Rafraîchir le ticket actif au montage pour s'assurer que les données sont à jour
  useEffect(() => {
    const refreshOnMount = async () => {
      try {
        await fetchActiveTicket();
      } catch (error) {
        console.error('Error fetching active ticket on mount:', error);
      }
    };
    refreshOnMount();
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  // Rafraîchir les données
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchActiveTicket();
    } catch (error) {
      console.error('Error refreshing ticket:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Annuler le ticket actif
  const handleCancelTicket = () => {
    if (!activeTicket) return;

    showWarning(
      'Annuler le ticket',
      'Êtes-vous sûr de vouloir annuler votre ticket ? Vous perdrez votre place dans la file.',
      'Oui, annuler',
      async () => {
        try {
          await cancelTicket(activeTicket.id);
        } catch (error: any) {
          console.error('Error canceling ticket:', error);
          const errorMsg = error?.response?.data?.message || error?.message || 'Impossible d\'annuler le ticket. Veuillez réessayer.';
          showError('Erreur', errorMsg);
        }
      },
      'Non'
    );
  };

  // Navigation vers les différentes fonctionnalités
  const handleScanQR = () => {
    router.push('/(tabs)/scan');
  };

  const handleViewLiveTicket = () => {
    if (!activeTicket) return;
    router.push({
      pathname: '/(tabs)/live-ticket',
      params: { ticketId: String(activeTicket.id) },
    });
  };

  const handleViewHistory = () => {
    router.push('/(tabs)/history');
  };

  const handleNotifications = () => {
    router.push('/notifications');
  };

  const getStatusColor = () => {
    if (isCalled) return ['#EF4444', '#DC2626'];
    if (isAlmostThere) return ['#F59E0B', '#D97706'];
    return ['#3B82F6', '#2563EB'];
  };

  const getStatusText = () => {
    if (isCalled) return 'APPELÉ';
    if (isAlmostThere) return 'BIENTÔT VOTRE TOUR';
    return 'EN ATTENTE';
  };

  // Rendu du ticket actif
  const renderActiveTicket = () => {
    if (!hasActiveTicket) {
      return (
        <Animated.View style={[styles.noTicketCard, { opacity: fadeAnim }]}>
          <View style={styles.noTicketContent}>
            <View style={[styles.noTicketIconContainer, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="ticket-outline" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.noTicketTitle, { color: colors.textPrimary }]}>
              Aucun ticket actif
            </Text>
            <Text style={[styles.noTicketSubtitle, { color: colors.textSecondary }]}>
              Scannez un QR code ou rejoignez une file pour obtenir un ticket
            </Text>
            <TouchableOpacity style={styles.scanButton} onPress={handleScanQR}>
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                style={styles.scanButtonGradient}
              >
                <Ionicons name="qr-code-outline" size={20} color="#FFFFFF" />
                <Text style={styles.scanButtonText}>Scanner un QR code</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      );
    }

    return (
      <Animated.View style={[styles.activeTicketCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
        {/* Status Banner */}
        <LinearGradient
          colors={getStatusColor() as [string, string]}
          style={styles.statusBanner}
        >
          <Ionicons name="time-outline" size={16} color="#FFFFFF" />
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </LinearGradient>

        <View style={styles.ticketContent}>
          {/* Position */}
          <View style={styles.positionSection}>
            <Text style={[styles.positionNumber, { color: colors.textPrimary }]}>{position}</Text>
            <Text style={[styles.positionLabel, { color: colors.textTertiary }]}>ème position</Text>
          </View>

          {/* Ticket Info */}
          <View style={styles.ticketInfo}>
            <View style={styles.infoItem}>
              <View style={[styles.infoIconContainer, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="pricetag-outline" size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>Numéro</Text>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{activeTicket?.number}</Text>
              </View>
            </View>
            
            <View style={styles.infoItem}>
              <View style={[styles.infoIconContainer, { backgroundColor: colors.success + '20' }]}>
                <Ionicons name="briefcase-outline" size={18} color={colors.success} />
              </View>
              <View>
                <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>Service</Text>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{activeTicket?.service?.name || 'Service'}</Text>
              </View>
            </View>
            
            <View style={styles.infoItem}>
              <View style={[styles.infoIconContainer, { backgroundColor: colors.warning + '20' }]}>
                <Ionicons name="business-outline" size={18} color={colors.warning} />
              </View>
              <View>
                <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>Établissement</Text>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{activeTicket?.establishment?.name || 'Établissement'}</Text>
              </View>
            </View>
            
            <View style={styles.infoItem}>
              <View style={[styles.infoIconContainer, { backgroundColor: colors.secondary + '20' }]}>
                <Ionicons name="time-outline" size={18} color={colors.secondary} />
              </View>
              <View>
                <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>Temps estimé</Text>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{etaMinutes} min</Text>
              </View>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.ticketActions}>
            <TouchableOpacity style={styles.primaryAction} onPress={handleViewLiveTicket}>
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                style={styles.primaryActionGradient}
              >
                <Ionicons name="eye-outline" size={20} color="#FFFFFF" />
                <Text style={styles.primaryActionText}>Voir en direct</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.dangerAction, { backgroundColor: colors.danger + '15' }]} onPress={handleCancelTicket}>
              <View style={styles.dangerActionContent}>
                <Ionicons name="close-outline" size={20} color={colors.danger} />
                <Text style={[styles.dangerActionText, { color: colors.danger }]}>Annuler le ticket</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    );
  };

  // Rendu des actions rapides
  const renderQuickActions = () => {
    const actions = [
      {
        id: 'scan',
        title: 'Scanner',
        icon: 'qr-code-outline',
        color: colors.primary,
        onPress: handleScanQR,
      },
      {
        id: 'history',
        title: 'Historique',
        icon: 'time-outline',
        color: colors.success,
        onPress: handleViewHistory,
      },
      {
        id: 'map',
        title: 'Carte',
        icon: 'map-outline',
        color: colors.warning,
        onPress: () => router.push('/(tabs)'),
      },
    ];

    return (
      <View style={styles.quickActionsSection}>
        <Text style={styles.sectionTitle}>Actions rapides</Text>
        <View style={styles.quickActionsGrid}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={[styles.quickActionCard, { backgroundColor: colors.surface , borderColor: colors.border, borderWidth: 1}]}
              onPress={action.onPress}
              activeOpacity={0.8}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: action.color + '15' }]}>
                <Ionicons name={action.icon as any} size={24} color={action.color} />
              </View>
              <Text style={[styles.quickActionTitle, { color: colors.textPrimary }]}>{action.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  // Rendu des statistiques
  const renderStats = () => {
    if (!hasActiveTicket) return null;

    return (
      <View style={styles.statsSection}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Statistiques</Text>
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.primary + '15', borderColor: colors.border, borderWidth: 1 }]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{position}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Position</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.warning + '15', borderColor: colors.border, borderWidth: 1 }]}>
            <Text style={[styles.statValue, { color: colors.warning }]}>{etaMinutes}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Minutes</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.success + '15', borderColor: colors.border, borderWidth: 1 }]}>
            <Text style={[styles.statValue, { color: colors.success }]}>{Math.max(0, position - 1)}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Avant vous</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Gradient Header */}
      <LinearGradient
        colors={colors.dark?.background ? ['#1E3A5F', '#2563EB', '#3B82F6'] : ['#3B82F6', '#2563EB', '#1D4ED8']}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={[styles.headerTitle, { color: '#FFFFFF' }]}>Ma File</Text>
            <Text style={styles.headerSubtitle}>Gérez vos tickets</Text>
          </View>
          <TouchableOpacity style={[styles.notificationButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]} onPress={handleNotifications}>
            <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
            {hasActiveTicket && (
              <View style={[styles.notificationBadge, { backgroundColor: colors.danger }]}>
                <Text style={[styles.notificationBadgeText, { color: '#FFFFFF' }]}>1</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={64} color={colors.danger} />
            <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>Oups ! Une erreur est survenue</Text>
            <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
              {error.includes('401') ? 'Votre session a expiré. Veuillez vous reconnecter.' : error}
            </Text>
            <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={handleRefresh}>
              <Text style={[styles.retryButtonText, { color: '#FFFFFF' }]}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {renderActiveTicket()}
            {renderStats()}
            {renderQuickActions()}
          </>
        )}
        {AlertComponent}
        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    paddingTop: 50,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  notificationButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 30,
  },
  // No Ticket Card
  noTicketCard: {
    borderRadius: 24,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  noTicketContent: {
    alignItems: 'center',
    padding: 32,
  },
  noTicketIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  noTicketTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  noTicketSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  scanButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  scanButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    gap: 8,
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color:'#FFFFFF',
  },
  // Active Ticket Card
  activeTicketCard: {
    borderRadius: 24,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    overflow: 'hidden',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  ticketContent: {
    padding: 24,
  },
  positionSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  positionNumber: {
    fontSize: 72,
    fontWeight: '800',
    lineHeight: 80,
  },
  positionLabel: {
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  ticketInfo: {
    gap: 16,
    marginBottom: 24,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  ticketActions: {
    gap: 12,
  },
  primaryAction: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  primaryActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  primaryActionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dangerAction: {
    borderRadius: 16,
    paddingVertical: 16,
  },
  dangerActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dangerActionText: {
    fontSize: 16,
    fontWeight: '700',
  },
  // Stats Section
  statsSection: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Quick Actions
  quickActionsSection: {
    marginTop: 20,
    marginBottom:100,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,

  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  quickActionTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Error
  errorContainer: {
    alignItems: 'center',
    padding: 40,
    marginTop: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  bottomSpace: {
    height: 40,
  },
});

export default TicketsScreen;
