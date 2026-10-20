import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useSettings } from '../../store/settingsStore';
import { Theme } from '../../theme';

// Les props SVG ne peuvent pas recevoir une valeur Animated sur un <Circle> simple
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Types pour le cercle de progression
export interface ProgressCircleProps {
  progress: number; // 0 à 100
  size?: number;
  strokeWidth?: number;
  backgroundColor?: string;
  progressColor?: string;
  showPercentage?: boolean;
  showText?: boolean;
  text?: string;
  textColor?: string;
  animated?: boolean;
  duration?: number;
  gradient?: boolean;
  gradientColors?: string[];
}

const { width: screenWidth } = Dimensions.get('window');

// Composant ProgressCircle avec animations fluides
export const ProgressCircle: React.FC<ProgressCircleProps> = ({
  progress,
  size = 200,
  strokeWidth = 8,
  backgroundColor,
  progressColor,
  showPercentage = true,
  showText = true,
  text,
  textColor,
  animated = true,
  duration = 1000,
  gradient = false,
  gradientColors = [Theme.colors.primary, Theme.colors.secondary],
}) => {
  const { isDarkMode } = useSettings();
  const animatedValue = useRef(new Animated.Value(0)).current;
  
  // Calculer le rayon et la circonférence
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  
  // Couleurs selon le thème
  const bgColor = backgroundColor || (isDarkMode ? Theme.colors.dark.surfaceSecondary : Theme.colors.surfaceSecondary);
  const progressBgColor = progressColor || Theme.colors.primary;
  const txtColor = textColor || (isDarkMode ? Theme.colors.dark.textPrimary : Theme.colors.textPrimary);
  
  // Calculer le décalage du trait
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  
  // Animation du cercle
  useEffect(() => {
    if (animated) {
      Animated.timing(animatedValue, {
        toValue: progress,
        duration,
        // strokeDashoffset n'est pas animable par le driver natif
        useNativeDriver: false,
      }).start();
    } else {
      animatedValue.setValue(progress);
    }
  }, [progress, animated, duration]);

  // Animation du décalage
  const animatedStrokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
    extrapolate: 'clamp',
  });

  // Calculer la taille du texte selon la taille du cercle
  const getTextSize = () => {
    if (size <= 100) return Theme.typography.textStyles.title3;
    if (size <= 150) return Theme.typography.textStyles.title2;
    return Theme.typography.textStyles.title1;
  };

  // Obtenir la couleur selon la progression
  const getProgressColor = () => {
    if (progressColor) return progressColor;
    
    if (progress <= 30) return Theme.colors.danger;
    if (progress <= 60) return Theme.colors.warning;
    return Theme.colors.success;
  };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.svg}>
        {/* Cercle de fond */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={bgColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        
        {/* Cercle de progression */}
        {gradient ? (
          <>
            <Defs>
              <LinearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={gradientColors[0]} />
                <Stop offset="100%" stopColor={gradientColors[1]} />
              </LinearGradient>
            </Defs>
            <AnimatedCircle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="url(#progressGradient)"
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={animated ? animatedStrokeDashoffset : strokeDashoffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </>
        ) : (
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={getProgressColor()}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={animated ? animatedStrokeDashoffset : strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      
      {/* Texte au centre */}
      {showText && (
        <View style={styles.textContainer}>
          {showPercentage ? (
            <Text style={[getTextSize(), { color: txtColor }]}>
              {Math.round(progress)}%
            </Text>
          ) : (
            <Text style={[getTextSize(), { color: txtColor }]}>
              {text}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

// Types pour le cercle de position (utilisé pour les tickets)
export interface PositionCircleProps {
  position: number;
  total?: number;
  size?: number;
  strokeWidth?: number;
  showPosition?: boolean;
  showEta?: boolean;
  eta?: string;
  animated?: boolean;
  almostThere?: boolean;
  called?: boolean;
}

// Composant PositionCircle pour les tickets
export const PositionCircle: React.FC<PositionCircleProps> = ({
  position,
  total = 10,
  size = 200,
  strokeWidth = 12,
  showPosition = true,
  showEta = false,
  eta,
  animated = true,
  almostThere = false,
  called = false,
}) => {
  const { isDarkMode } = useSettings();
  
  // Calculer la progression (inversée car position 1 = 100%)
  const progress = total > 0 ? ((total - position + 1) / total) * 100 : 0;
  
  // Couleurs selon l'état
  const getProgressColor = () => {
    if (called) return Theme.colors.success;
    if (almostThere) return Theme.colors.warning;
    if (position <= 2) return Theme.colors.warning;
    if (position <= 5) return Theme.colors.primary;
    return Theme.colors.primary;
  };

  const getTextColor = () => {
    if (called) return Theme.colors.success;
    if (almostThere) return Theme.colors.warning;
    if (position <= 2) return Theme.colors.warning;
    return isDarkMode ? Theme.colors.dark.textPrimary : Theme.colors.textPrimary;
  };

  const getPositionText = () => {
    if (called) return 'Appelé';
    if (position === 1) return '1er';
    return `${position}ème`;
  };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <ProgressCircle
        progress={progress}
        size={size}
        strokeWidth={strokeWidth}
        progressColor={getProgressColor()}
        showPercentage={false}
        showText={true}
        text={showPosition ? getPositionText() : ''}
        textColor={getTextColor()}
        animated={animated}
        gradient={called}
        gradientColors={called ? [Theme.colors.success, '#30D158'] : undefined}
      />
      
      {/* ETA en dessous */}
      {showEta && eta && !called && (
        <Text style={[styles.etaText, { color: Theme.colors.textSecondary }]}>
          Est. {eta}
        </Text>
      )}
    </View>
  );
};

// Types pour le cercle "LIVE" avec animation pulse
export interface LiveBadgeProps {
  size?: number;
  color?: string;
  animated?: boolean;
}

// Composant LiveBadge avec animation pulse
export const LiveBadge: React.FC<LiveBadgeProps> = ({
  size = 8,
  color = Theme.colors.success,
  animated = true,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (animated) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();

      return () => pulseAnimation.stop();
    }
  }, [animated, pulseAnim]);

  return (
    <View style={styles.liveBadgeContainer}>
      <Animated.View
        style={[
          styles.liveDot,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            transform: [{ scale: animated ? pulseAnim : 1 }],
          },
        ]}
      />
      <Text style={styles.liveText}>LIVE</Text>
    </View>
  );
};

// Styles
const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  svg: {
    position: 'absolute',
  },
  textContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  etaText: {
    ...Theme.typography.textStyles.footnote,
    marginTop: Theme.spacing.sm,
    textAlign: 'center',
  },
  liveBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    marginRight: Theme.spacing.xs,
  },
  liveText: {
    ...Theme.typography.textStyles.badge,
    color: Theme.colors.success,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});

export default ProgressCircle;
