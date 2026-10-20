import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { useAuth } from '../../store/authStore';
import { useSettings } from '../../store/settingsStore';
import { Theme } from '../../theme';
import { useAppNavigation } from '../../navigation/AppNavigator';

const { width, height } = Dimensions.get('window');

// Composant SplashScreen
export const SplashScreen: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { isFirstLaunch, onboardingCompleted } = useSettings();
  const { navigateToOnboarding, goToLogin, goToMain } = useAppNavigation();
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const logoAnim = useRef(new Animated.Value(0)).current;

  // Animation de démarrage
  useEffect(() => {
    const startAnimation = () => {
      // Animation du logo
      Animated.sequence([
        Animated.timing(logoAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(logoAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
          delay: 800,
        }),
      ]).start();

      // Animation du fade et scale
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    };

    startAnimation();
  }, [fadeAnim, scaleAnim, logoAnim]);

  // Navigation après animation et chargement
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => {
        if (isAuthenticated) {
          goToMain();
        } else if (isFirstLaunch && !onboardingCompleted) {
          navigateToOnboarding();
        } else {
          goToLogin();
        }
      }, 2000); // Durée totale du splash

      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isLoading, isFirstLaunch, onboardingCompleted, navigateToOnboarding, goToLogin, goToMain]);

  return (
    <View style={[styles.container, { backgroundColor: Theme.colors.background }]}>
      {/* Animation du logo */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Logo VQS */}
        <View style={styles.logo}>
          <Animated.View
            style={[
              styles.logoCircle,
              {
                opacity: logoAnim,
                transform: [
                  {
                    scale: logoAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1.2],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={[styles.logoText, { color: Theme.colors.surface }]}>
              VQS
            </Text>
          </Animated.View>
          
          {/* Tagline */}
          <Animated.Text
            style={[
              styles.tagline,
              {
                color: Theme.colors.textSecondary,
                opacity: fadeAnim,
              },
            ]}
          >
            Virtual Queue System
          </Animated.Text>
        </View>
      </Animated.View>

      {/* Indicateur de chargement */}
      {isLoading && (
        <Animated.View
          style={[
            styles.loadingContainer,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <View style={styles.loadingDots}>
            <View style={[styles.dot, { backgroundColor: Theme.colors.primary }]} />
            <View style={[styles.dot, { backgroundColor: Theme.colors.primary }]} />
            <View style={[styles.dot, { backgroundColor: Theme.colors.primary }]} />
          </View>
        </Animated.View>
      )}

      {/* Version de l'app */}
      <Animated.Text
        style={[
          styles.version,
          {
            color: Theme.colors.textTertiary,
            opacity: fadeAnim,
          },
        ]}
      >
        Version 1.0.0
      </Animated.Text>
    </View>
  );
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Theme.colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoText: {
    ...Theme.typography.textStyles.largeTitle,
    fontWeight: '800',
    fontSize: 36,
    letterSpacing: 2,
  },
  tagline: {
    ...Theme.typography.textStyles.headline,
    marginTop: Theme.spacing.lg,
    textAlign: 'center',
    fontWeight: '500',
  },
  loadingContainer: {
    position: 'absolute',
    bottom: height * 0.3,
    alignItems: 'center',
  },
  loadingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  version: {
    position: 'absolute',
    bottom: Theme.spacing.xl,
    ...Theme.typography.textStyles.caption2,
  },
});

export default SplashScreen;
