import { Tabs } from 'expo-router';
import { View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import '../../global.css';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { useAuth } from '../../src/store/authStore';
import { useTicket } from '../../src/store/ticketStore';
import { CalledTicketOverlay } from '../../src/components/CalledTicketOverlay';
import { useDistanceTracking } from '../../src/hooks/useDistanceTracking';
import { useCustomAlert } from '../../src/hooks/useCustomAlert';
import { useTicketSocket } from '../../src/hooks/useTicketSocket';
import * as Haptics from 'expo-haptics';
import axiosClient from '../../src/api/axiosClient';

export default function TabLayout() {
  const colors = useThemeColors();
  const isDark = !!colors.dark?.background;
  const { user } = useAuth();
  const { AlertComponent, showSuccess, showError, showInfo } = useCustomAlert();

  // Called ticket overlay state
  const {
    isCalled,
    activeTicket,
    counterNumber,
    hasRecalled,
    clearActiveTicket,
    setRecalled,
    updateTicketStatus,
  } = useTicket();

  // Connect WebSocket at tab level so called events work on ALL screens
  useTicketSocket(activeTicket?.id?.toString() || null);

  // Distance tracking for overlay
  const hasValidCoordinates = activeTicket?.establishment &&
    (activeTicket.establishment as any)?.lat !== undefined &&
    (activeTicket.establishment as any)?.lng !== undefined;

  const { distanceInfo } = useDistanceTracking({
    targetCoordinates: hasValidCoordinates
      ? {
          latitude: (activeTicket.establishment as any).lat,
          longitude: (activeTicket.establishment as any).lng,
        }
      : null,
    enabled: isCalled && hasValidCoordinates,
  });

  // Handle confirm presence (en-route)
  const handleEnRoute = async () => {
    try {
      await axiosClient.post(`/tickets/${activeTicket?.id}/en-route`, {
        estimated_travel_minutes: distanceInfo?.travelTimes?.car,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSuccess('Présence confirmée', "L'agent a été notifié de votre arrivée");
      // Dismiss overlay by updating status
      updateTicketStatus('en_route');
    } catch (error: any) {
      showError('Erreur', error.response?.data?.error || 'Impossible de confirmer');
    }
  };

  // Handle recall
  const handleRecall = async () => {
    if (hasRecalled) {
      showInfo('Info', 'Le rappel a déjà été utilisé');
      return;
    }
    try {
      await axiosClient.post(`/tickets/${activeTicket?.id}/request-recall`);
      setRecalled();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (error: any) {
      showError('Erreur', error.response?.data?.error || "Impossible d'envoyer le rappel");
    }
  };

  // Handle defer (laisser passer)
  const handleDefer = async () => {
    try {
      const response = await axiosClient.post(`/tickets/${activeTicket?.id}/defer`);
      if (response.data?.success) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        showSuccess('Position échangée', 'Vous passez après la personne suivante');
        // After defer, ticket goes back to waiting, so dismiss overlay
        updateTicketStatus('waiting');
      } else {
        showError('Impossible', response.data?.message || "Impossible de déférer");
      }
    } catch (error: any) {
      showError('Erreur', error.response?.data?.message || "Impossible de déférer");
    }
  };

  // Handle dismiss (after expiry or cancel)
  const handleDismiss = () => {
    updateTicketStatus('dismissed');
  };

  // Redirect agents to their space
  if (user?.role === 'agent' || user?.role === 'admin') {
    return <Redirect href="/agent" />;
  }

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: {
            position: 'absolute',
            bottom: Platform.OS === 'ios' ? 30 : 20,
            marginHorizontal: 20,
          height: 60,
          borderRadius: 30,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 15 },
          shadowOpacity: isDark ? 0.4 : 0.15,
          shadowRadius: 25,
          elevation: 15,
          paddingHorizontal: 30,
          justifyContent: 'space-between',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.border
        },
        tabBarItemStyle: {
          height: 50,
          width: 44,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: focused ? colors.primary : 'transparent',
              transform: [{ scale: focused ? 1.1 : 1 }],
            }}>
              <Ionicons 
                name="map-outline" 
                size={22} 
                color={focused ? '#FFFFFF' : color} 
              />
            </View>
          ),
        }}
      />
      
      <Tabs.Screen
        name="scan"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: focused ? colors.primary : 'transparent',
              transform: [{ scale: focused ? 1.1 : 1 }],
            }}>
              <Ionicons 
                name="qr-code-outline" 
                size={22} 
                color={focused ? '#FFFFFF' : color} 
              />
            </View>
          ),
        }}
      />
      
      <Tabs.Screen
        name="tickets"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: focused ? colors.primary : 'transparent',
              transform: [{ scale: focused ? 1.1 : 1 }],
            }}>
              <Ionicons 
                name="ticket-outline" 
                size={22} 
                color={focused ? '#FFFFFF' : color} 
              />
            </View>
          ),
        }}
      />
      
      <Tabs.Screen
        name="history"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: focused ? colors.primary : 'transparent',
              transform: [{ scale: focused ? 1.1 : 1 }],
            }}>
              <Ionicons 
                name="time-outline" 
                size={22} 
                color={focused ? '#FFFFFF' : color} 
              />
            </View>
          ),
        }}
      />
      
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: focused ? colors.primary : 'transparent',
              transform: [{ scale: focused ? 1.1 : 1 }],
            }}>
              <Ionicons 
                name="person-outline" 
                size={22} 
                color={focused ? '#FFFFFF' : color} 
              />
            </View>
          ),
        }}
      />
      
      <Tabs.Screen
        name="live-ticket"
        options={{
          href: null,
        }}
      />
      </Tabs>

      {/* Global Called Ticket Overlay - shows on ALL screens */}
      {AlertComponent}
      <CalledTicketOverlay
        visible={!!isCalled}
        counterNumber={counterNumber || undefined}
        distanceInfo={distanceInfo}
        countdownSeconds={180}
        hasRecalled={!!hasRecalled}
        onEnRoute={handleEnRoute}
        onRecall={handleRecall}
        onDefer={handleDefer}
        onDismiss={handleDismiss}
      />
    </>
  );
}