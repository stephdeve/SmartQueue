import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, StyleSheet } from 'react-native';
import { useSettings } from '../store/settingsStore';
import { useTicket } from '../store/ticketStore';
import { Theme } from '../theme';
import { Ionicons } from '@expo/vector-icons';

// Écrans des tabs
import ExploreScreen from '../screens/explore/ExploreScreen';
import TicketsScreen from '../screens/tickets/TicketsScreen';
import HistoryScreen from '../screens/history/HistoryScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

// Types de navigation
export type TabParamList = {
  Explore: undefined;
  Tickets: undefined;
  History: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

// Composant TabNavigator
export const TabNavigator: React.FC = () => {
  const { isDarkMode } = useSettings();
  const { hasActiveTicket } = useTicket();

  // Configuration des tabs
  const tabScreenOptions = {
    headerShown: false,
    tabBarStyle: [
      styles.tabBar,
      {
        backgroundColor: isDarkMode 
          ? Theme.colors.dark.tabBackground 
          : Theme.colors.tabBackground,
        borderTopColor: isDarkMode 
          ? Theme.colors.dark.separator 
          : Theme.colors.separator,
      },
    ],
    tabBarActiveTintColor: Theme.colors.tabActive,
    tabBarInactiveTintColor: Theme.colors.tabInactive,
    tabBarLabelStyle: styles.tabBarLabel,
    tabBarIconStyle: styles.tabBarIcon,
    tabBarActiveBackgroundColor: 'transparent',
    tabBarInactiveBackgroundColor: 'transparent',
    tabBarItemStyle: styles.tabBarItem,
  };

  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      {/* Tab Explore */}
      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{
          title: 'Explorer',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'map' : 'map-outline'}
              size={size}
              color={color}
            />
          ),
          tabBarBadge: undefined, // Pas de badge pour explore
        }}
      />

      {/* Tab Tickets */}
      <Tab.Screen
        name="Tickets"
        component={TicketsScreen}
        options={{
          title: 'Tickets',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'ticket' : 'ticket-outline'}
              size={size}
              color={color}
            />
          ),
          tabBarBadge: hasActiveTicket ? 1 : undefined, // Badge rouge si ticket actif
        }}
      />

      {/* Tab History */}
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          title: 'Historique',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'time' : 'time-outline'}
              size={size}
              color={color}
            />
          ),
          tabBarBadge: undefined, // Pas de badge pour history
        }}
      />

      {/* Tab Profile */}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={size}
              color={color}
            />
          ),
          tabBarBadge: undefined, // Pas de badge pour profile
        }}
      />
    </Tab.Navigator>
  );
};

// Hook personnalisé pour la navigation des tabs
export const useTabNavigation = () => {
  const { hasActiveTicket, activeTicket } = useTicket();

  return {
    // État des tabs
    hasActiveTicket,
    activeTicketCount: hasActiveTicket ? 1 : 0,
    
    // Fonctions de navigation
    navigateToExplore: () => {
      // Navigation vers explore
    },
    navigateToTickets: () => {
      // Navigation vers tickets
    },
    navigateToHistory: () => {
      // Navigation vers history
    },
    navigateToProfile: () => {
      // Navigation vers profile
    },
    
    // Utilitaires
    shouldShowTicketBadge: hasActiveTicket,
    getTicketBadgeColor: () => {
      if (!activeTicket) return undefined;
      
      switch (activeTicket.status) {
        case 'called':
          return Theme.colors.success;
        case 'waiting':
          return (activeTicket.position ?? Infinity) <= 2 ? Theme.colors.warning : Theme.colors.primary;
        default:
          return Theme.colors.primary;
      }
    },
  };
};

// Styles
const styles = StyleSheet.create({
  tabBar: {
    height: Platform.OS === 'ios' ? 83 : 60,
    paddingBottom: Platform.OS === 'ios' ? 34 : 10,
    paddingTop: 8,
    borderTopWidth: 0.5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  tabBarLabel: {
    ...Theme.typography.textStyles.tabBar,
    fontWeight: '500',
  },
  tabBarIcon: {
    marginBottom: 2,
  },
  tabBarItem: {
    paddingVertical: 4,
  },
});

export default TabNavigator;
