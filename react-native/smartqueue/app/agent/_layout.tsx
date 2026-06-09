import { Tabs } from 'expo-router';
import { View, Platform } from 'react-native';
import { Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { useAuth } from '../../src/store/authStore';

export default function AgentTabLayout() {
  const colors = useThemeColors();
  const isDark = !!colors.dark?.background;
  const { user } = useAuth();

  // Only agents and admins can access this space
  if (user?.role !== 'agent' && user?.role !== 'admin') {
    return <Redirect href="/(tabs)" />;
  }

  return (
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
      {/* Tab Dashboard - Accueil Agent */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
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
                name={focused ? 'home' : 'home-outline'} 
                size={20} 
                color={focused ? '#FFFFFF' : color} 
              />
            </View>
          ),
        }}
      />

      {/* Tab Queue - File d'attente */}
      <Tabs.Screen
        name="queue"
        options={{
          title: 'File d\'attente',
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
                name={focused ? 'list' : 'list-outline'} 
                size={20} 
                color={focused ? '#FFFFFF' : color} 
              />
            </View>
          ),
        }}
      />

      {/* Tab Called - Appelés */}
      <Tabs.Screen
        name="called"
        options={{
          title: 'Appelés',
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
                name={focused ? 'megaphone' : 'megaphone-outline'} 
                size={20} 
                color={focused ? '#FFFFFF' : color} 
              />
            </View>
          ),
        }}
      />

      {/* Tab Profile - Profil Agent */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
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
                name={focused ? 'person' : 'person-outline'} 
                size={20} 
                color={focused ? '#FFFFFF' : color} 
              />
            </View>
          ),
        }}
      />

      {/* Screens cachés du tab bar (accessibles via navigation) */}
      <Tabs.Screen
        name="absent"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="priority"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
