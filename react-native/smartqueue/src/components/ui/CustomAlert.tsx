import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Animated,
  Platform,
  ScaledSize,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../../hooks/useThemeColors';

const { width, height } = Dimensions.get('window');

export type AlertType = 'success' | 'warning' | 'error' | 'info';

export interface CustomAlertProps {
  visible: boolean;
  type: AlertType;
  title: string;
  message: string;
  primaryButton?: {
    text: string;
    onPress: () => void;
  };
  secondaryButton?: {
    text: string;
    onPress: () => void;
  };
  onClose?: () => void;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

interface AlertConfig {
  icon: keyof typeof Ionicons.glyphMap;
  gradientColors: [string, string];
  iconBgColor: string;
  primaryButtonBg: string;
  secondaryButtonText: string;
}

const alertConfig: Record<AlertType, AlertConfig> = {
  success: {
    icon: 'checkmark-circle',
    gradientColors: ['#22C55E', '#16A34A'],
    iconBgColor: '#22C55E',
    primaryButtonBg: '#22C55E',
    secondaryButtonText: '#6B7280',
  },
  warning: {
    icon: 'warning-outline', // Correction : 'warning-outline' existe
    gradientColors: ['#F59E0B', '#D97706'],
    iconBgColor: '#F59E0B',
    primaryButtonBg: '#F59E0B',
    secondaryButtonText: '#6B7280',
  },
  error: {
    icon: 'close-circle',
    gradientColors: ['#EF4444', '#DC2626'],
    iconBgColor: '#EF4444',
    primaryButtonBg: '#EF4444',
    secondaryButtonText: '#6B7280',
  },
  info: {
    icon: 'information-circle',
    gradientColors: ['#3B82F6', '#2563EB'],
    iconBgColor: '#3B82F6',
    primaryButtonBg: '#3B82F6',
    secondaryButtonText: '#6B7280',
  },
};

// Composant responsive
const getResponsiveSize = (screenWidth: number) => {
  if (screenWidth < 380) {
    return {
      containerWidth: screenWidth * 0.9,
      iconSize: 52,
      iconMarginTop: -26,
      titleSize: 18,
      messageSize: 13,
      buttonTextSize: 13,
      paddingHorizontal: 20,
      paddingTop: 20,
    };
  } else if (screenWidth < 768) {
    return {
      containerWidth: screenWidth * 0.85,
      iconSize: 64,
      iconMarginTop: -32,
      titleSize: 20,
      messageSize: 14,
      buttonTextSize: 14,
      paddingHorizontal: 24,
      paddingTop: 24,
    };
  } else {
    return {
      containerWidth: 400,
      iconSize: 72,
      iconMarginTop: -36,
      titleSize: 22,
      messageSize: 15,
      buttonTextSize: 15,
      paddingHorizontal: 32,
      paddingTop: 28,
    };
  }
};

export const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  type,
  title,
  message,
  primaryButton,
  secondaryButton,
  onClose,
  autoClose = false,
  autoCloseDelay = 3000,
}) => {
  const colors = useThemeColors();
  const isDark = !!colors.dark?.background;
  const config = alertConfig[type];
  
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const autoCloseTimer = useRef<NodeJS.Timeout | null>(null);
  
  const [screenWidth, setScreenWidth] = React.useState(width);
  const responsive = getResponsiveSize(screenWidth);

  // Gestion du redimensionnement de l'écran
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }: { window: ScaledSize }) => {
      setScreenWidth(window.width);
    });
    return () => subscription.remove();
  }, []);

  // Animation d'entrée
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 65,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-close timer
      if (autoClose && primaryButton) {
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: autoCloseDelay,
          useNativeDriver: false,
        }).start();

        autoCloseTimer.current = setTimeout(() => {
          if (primaryButton?.onPress) {
            primaryButton.onPress();
          }
          if (onClose) onClose();
        }, autoCloseDelay);
      }
    } else {
      scaleAnim.setValue(0.7);
      fadeAnim.setValue(0);
      progressAnim.setValue(0);
      if (autoCloseTimer.current) {
        clearTimeout(autoCloseTimer.current);
      }
    }

    return () => {
      if (autoCloseTimer.current) {
        clearTimeout(autoCloseTimer.current);
      }
    };
  }, [visible, autoClose, autoCloseDelay]);

  // Garde-fou contre les objets React enfants
  const safeTitle = typeof title === 'string' ? title : String(title ?? '');
  const safeMessage = typeof message === 'string'
    ? message
    : (message as any)?.message ?? JSON.stringify(message ?? '');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.container,
            {
              backgroundColor: colors.surface,
              transform: [{ scale: scaleAnim }],
              width: responsive.containerWidth,
              maxWidth: 500,
            },
          ]}
        >
          {/* Progress Bar for auto-close */}
          {autoClose && primaryButton && (
            <Animated.View
              style={[
                styles.progressBar,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                  backgroundColor: config.primaryButtonBg,
                },
              ]}
            />
          )}

          {/* Icon Section */}
          <LinearGradient
            colors={config.gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.headerGradient, { height: responsive.iconSize + 36 }]}
          >
            <View
              style={[
                styles.iconContainer,
                {
                  width: responsive.iconSize,
                  height: responsive.iconSize,
                  borderRadius: responsive.iconSize / 2,
                  marginTop: responsive.iconMarginTop,
                  backgroundColor: config.iconBgColor,
                },
              ]}
            >
              <Ionicons
                name={config.icon}
                size={responsive.iconSize * 0.5}
                color="#FFFFFF"
              />
            </View>
          </LinearGradient>

          {/* Content */}
          <View
            style={[
              styles.content,
              {
                paddingHorizontal: responsive.paddingHorizontal,
                paddingTop: responsive.paddingTop,
                paddingBottom: responsive.paddingHorizontal,
              },
            ]}
          >
            <Text
              style={[
                styles.title,
                {
                  color: colors.textPrimary,
                  fontSize: responsive.titleSize,
                },
              ]}
            >
              {safeTitle}
            </Text>
            <Text
              style={[
                styles.message,
                {
                  color: colors.textSecondary,
                  fontSize: responsive.messageSize,
                  lineHeight: responsive.messageSize * 1.5,
                },
              ]}
            >
              {safeMessage}
            </Text>

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              {secondaryButton && (
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.secondaryButton,
                    {
                      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
                    },
                  ]}
                  onPress={() => {
                    if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
                    secondaryButton.onPress();
                    if (onClose) onClose();
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      styles.secondaryButtonText,
                      {
                        color: config.secondaryButtonText,
                        fontSize: responsive.buttonTextSize,
                      },
                    ]}
                  >
                    {secondaryButton.text}
                  </Text>
                </TouchableOpacity>
              )}

              {primaryButton && (
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.primaryButton,
                    { backgroundColor: config.primaryButtonBg },
                  ]}
                  onPress={() => {
                    if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
                    primaryButton.onPress();
                    if (onClose) onClose();
                  }}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[config.primaryButtonBg, config.primaryButtonBg + 'CC']}
                    style={styles.primaryButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        styles.primaryButtonText,
                        {
                          color: '#FFFFFF',
                          fontSize: responsive.buttonTextSize,
                        },
                      ]}
                    >
                      {primaryButton.text}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Close button (X) */}
          <TouchableOpacity
            style={[
              styles.closeButton,
              {
                width: responsive.buttonTextSize + 16,
                height: responsive.buttonTextSize + 16,
                borderRadius: (responsive.buttonTextSize + 16) / 2,
              },
            ]}
            onPress={() => {
              if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
              if (onClose) onClose();
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name="close"
              size={responsive.buttonTextSize}
              color={"white"}
            />
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
    position: 'relative',
  },
  progressBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 3,
    zIndex: 10,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  headerGradient: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop:15,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  content: {
    alignItems: 'center',
    
  },
  title: {
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  primaryButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryButtonGradient: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontWeight: '600',
  },
  primaryButtonText: {
    fontWeight: '700',
  },
  secondaryButtonText: {
    fontWeight: '600',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    color:"white",
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
});

export default CustomAlert;