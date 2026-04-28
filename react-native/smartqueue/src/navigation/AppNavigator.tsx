import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../store/authStore';
import { useSettings } from '../store/settingsStore';
import { Theme } from '../theme';

// Types de navigation
import { RootStackParamList } from './types';

// Navigation principale
import TabNavigator from './TabNavigator';

// Écrans globaux
import ScanScreen from '../screens/tickets/ScanScreen';
import ServiceDetailsScreen from '../screens/tickets/ServiceDetailsScreen';
import LiveTicketScreen from '../screens/tickets/LiveTicketScreen';
import PersonalInfoScreen from '../screens/profile/PersonalInfoScreen';
import NotificationPrefsScreen from '../screens/profile/NotificationPrefsScreen';
import AboutAppScreen from '../screens/profile/AboutAppScreen';
import HelpSupportScreen from '../screens/profile/HelpSupportScreen';

// Écrans d'authentification (re-import to use them)
import SplashScreen from '../screens/auth/SplashScreen';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Composant de chargement
const LoadingScreen = () => (
  <View style={[styles.loadingContainer, { backgroundColor: Theme.colors.background }]}>
    <ActivityIndicator size="large" color={Theme.colors.primary} />
  </View>
);

// Composant AppNavigator
export const AppNavigator: React.FC = () => {
  const { isAuthenticated, isLoading, checkAuth } = useAuth();
  const { onboardingCompleted, isFirstLaunch } = useSettings();
  const [isInitializing, setIsInitializing] = useState(true);

  // Request notification permissions
  const requestNotificationPermissions = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('Notification permissions not granted');
      }
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
    }
  };

  // Configure notification behavior
  useEffect(() => {
    // Set notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    // Listen for notifications received while app is foregrounded
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received in foreground:', notification);
    });

    // Listen for notification response (user taps notification)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response);
      // Could navigate to specific screen here
    });

    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
  }, []);

  // Initialiser l'application
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Request notification permissions
        await requestNotificationPermissions();
        // Vérifier l'authentification
        await checkAuth();
      } catch (error) {
        console.error('App initialization error:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeApp();
  }, [checkAuth]);

  // Afficher l'écran de chargement pendant l'initialisation
  if (isInitializing || isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 300,
        }}
        initialRouteName={getInitialRoute()}
      >
        {/* Écran de splash */}
        <Stack.Screen 
          name="Splash" 
          component={SplashScreen}
          options={{ 
            gestureEnabled: false,
            animation: 'fade',
          }}
        />

        {/* Onboarding (premier lancement) */}
        <Stack.Screen 
          name="Onboarding" 
          component={OnboardingScreen}
          options={{ 
            gestureEnabled: false,
            animation: 'slide_from_right',
          }}
        />

        {/* Écrans d'authentification */}
        <Stack.Screen 
          name="Login" 
          component={LoginScreen}
          options={{ 
            gestureEnabled: false,
            animation: 'slide_from_right',
          }}
        />

        <Stack.Screen 
          name="Register" 
          component={RegisterScreen}
          options={{ 
            gestureEnabled: false,
            animation: 'slide_from_right',
          }}
        />

        {/* Navigation principale (utilisateur authentifié) */}
        <Stack.Screen 
          name="Main" 
          component={TabNavigator}
          options={{ 
            gestureEnabled: false,
            animation: 'fade',
          }}
        />

        {/* Screens globaux / modaux */}
        <Stack.Screen 
          name="ScanScreen" 
          component={ScanScreen}
          options={{ 
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />

        <Stack.Screen 
          name="ServiceDetails" 
          component={ServiceDetailsScreen}
          options={{ title: 'Détails' }}
        />

        <Stack.Screen 
          name="LiveTicket" 
          component={LiveTicketScreen}
          options={{ 
            gestureEnabled: false,
            animation: 'slide_from_right',
          }}
        />

        <Stack.Screen 
          name="PersonalInfo" 
          component={PersonalInfoScreen}
          options={{ title: 'Infos Personnelles' }}
        />

        <Stack.Screen 
          name="NotificationPreferences" 
          component={NotificationPrefsScreen}
          options={{ title: 'Notifications' }}
        />

        <Stack.Screen 
          name="AboutApp" 
          component={AboutAppScreen}
          options={{ title: 'À Propos' }}
        />

        <Stack.Screen 
          name="HelpSupport" 
          component={HelpSupportScreen}
          options={{ title: 'Aide & Support' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

// Déterminer l'écran initial selon l'état
const getInitialRoute = (): keyof RootStackParamList => {
  // Toujours commencer par le splash pour l'initialisation
  return 'Splash';
};

import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export const useAppNavigation = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isAuthenticated } = useAuth();
  const { onboardingCompleted, isFirstLaunch } = useSettings();

  return {
    // État de navigation
    needsOnboarding: isFirstLaunch && !onboardingCompleted,
    needsAuth: !isAuthenticated,
    canAccessMain: isAuthenticated && !isFirstLaunch,
    
    // Fonctions de navigation utilitaires
    navigateToOnboarding: () => {
      navigation.replace('Onboarding');
    },
    goToLogin: () => {
      navigation.replace('Login');
    },
    goToMain: () => {
      navigation.replace('Main');
    },
    goBack: () => {
      navigation.goBack();
    },
  };
};

// Styles
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AppNavigator;
