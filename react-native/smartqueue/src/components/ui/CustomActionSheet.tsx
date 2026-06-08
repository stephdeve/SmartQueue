import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  ScrollView,
  Animated,
  Platform,
  ScaledSize,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../../hooks/useThemeColors';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export interface Option {
  label: string;
  value: string | number;
  icon?: keyof typeof Ionicons.glyphMap;
  description?: string;
}

export interface CustomActionSheetProps {
  visible: boolean;
  title: string;
  message?: string;
  options: Option[];
  selectedValue?: string | number;
  onSelect: (value: string | number) => void;
  onClose: () => void;
  type?: 'info' | 'warning' | 'success' | 'error';
  showCancel?: boolean;
  cancelText?: string;
}

interface ConfigType {
  icon: keyof typeof Ionicons.glyphMap;
  gradientColors: [string, string];
  iconBgColor: string;
}

const config: Record<string, ConfigType> = {
  info: {
    icon: 'information-circle',
    gradientColors: ['#3B82F6', '#2563EB'],
    iconBgColor: '#3B82F6',
  },
  warning: {
    icon: 'warning-outline',
    gradientColors: ['#F59E0B', '#D97706'],
    iconBgColor: '#F59E0B',
  },
  success: {
    icon: 'checkmark-circle',
    gradientColors: ['#22C55E', '#16A34A'],
    iconBgColor: '#22C55E',
  },
  error: {
    icon: 'close-circle',
    gradientColors: ['#EF4444', '#DC2626'],
    iconBgColor: '#EF4444',
  },
};

// Fonction responsive
const getResponsiveSize = (screenW: number, screenH: number) => {
  const isLandscape = screenW > screenH;
  const isTablet = screenW >= 768;
  
  return {
    containerMaxHeight: isLandscape ? '90%' : '80%',
    iconSize: isTablet ? 64 : 56,
    iconMarginTop: isTablet ? -32 : -28,
    titleSize: isTablet ? 22 : 18,
    messageSize: isTablet ? 15 : 13,
    optionTextSize: isTablet ? 16 : 15,
    optionPaddingVertical: isTablet ? 18 : 14,
    cancelPaddingVertical: isTablet ? 18 : 14,
    contentPaddingHorizontal: isTablet ? 24 : 20,
    contentPaddingBottom: isTablet ? 32 : 24,
  };
};

export const CustomActionSheet: React.FC<CustomActionSheetProps> = ({
  visible,
  title,
  message,
  options,
  selectedValue,
  onSelect,
  onClose,
  type = 'info',
  showCancel = true,
  cancelText = 'Annuler',
}) => {
  const colors = useThemeColors();
  const isDark = !!colors.dark?.background;
  const theme = config[type];
  
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [screenWidth, setScreenWidth] = React.useState(screenWidth);
  const [screenHeightState, setScreenHeightState] = React.useState(screenHeight);
  const responsive = getResponsiveSize(screenWidth, screenHeightState);

  // Gestion du redimensionnement
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }: { window: ScaledSize }) => {
      setScreenWidth(window.width);
      setScreenHeightState(window.height);
    });
    return () => subscription.remove();
  }, []);

  // Animations
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: screenHeightState,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, screenHeightState]);

  const handleSelect = (value: string | number) => {
    onSelect(value);
    setTimeout(onClose, 150);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        
        <Animated.View
          style={[
            styles.container,
            {
              backgroundColor: colors.surface,
              transform: [{ translateY: slideAnim }],
              maxHeight: responsive.containerMaxHeight,
            },
          ]}
        >
          {/* Handle Indicator */}
          <View style={styles.handleIndicator} />

          {/* Header with Icon */}
          <LinearGradient
            colors={theme.gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View
              style={[
                styles.iconContainer,
                {
                  width: responsive.iconSize,
                  height: responsive.iconSize,
                  borderRadius: responsive.iconSize / 2,
                  marginTop: responsive.iconMarginTop,
                  backgroundColor: theme.iconBgColor,
                },
              ]}
            >
              <Ionicons
                name={theme.icon}
                size={responsive.iconSize * 0.5}
                color="#FFFFFF"
              />
            </View>
          </LinearGradient>

          {/* Content */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.content,
              {
                paddingHorizontal: responsive.contentPaddingHorizontal,
                paddingBottom: responsive.contentPaddingBottom,
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
              {title}
            </Text>
            
            {message && (
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
                {message}
              </Text>
            )}

            {/* Options List */}
            <View style={styles.optionsContainer}>
              {options.map((option, index) => {
                const isSelected = selectedValue === option.value;
                const isLast = index === options.length - 1;

                return (
                  <TouchableOpacity
                    key={`${index}-${String(option.value)}`}
                    style={[
                      styles.optionButton,
                      {
                        paddingVertical: responsive.optionPaddingVertical,
                        backgroundColor: isSelected ? colors.primary + '10' : colors.surfaceSecondary,
                        borderBottomWidth: !isLast ? 0.5 : 0,
                        borderBottomColor: colors.border,
                      },
                    ]}
                    onPress={() => handleSelect(option.value)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.optionLeft}>
                      {option.icon && (
                        <View
                          style={[
                            styles.optionIconContainer,
                            {
                              backgroundColor: isSelected ? colors.primary + '20' : colors.border + '30',
                            },
                          ]}
                        >
                          <Ionicons
                            name={option.icon}
                            size={responsive.optionTextSize + 4}
                            color={isSelected ? colors.primary : colors.textSecondary}
                          />
                        </View>
                      )}
                      <View style={styles.optionTextContainer}>
                        <Text
                          style={[
                            styles.optionText,
                            {
                              color: isSelected ? colors.primary : colors.textPrimary,
                              fontSize: responsive.optionTextSize,
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}
                        >
                          {option.label}
                        </Text>
                        {option.description && (
                          <Text
                            style={[
                              styles.optionDescription,
                              {
                                color: colors.textTertiary,
                                fontSize: responsive.optionTextSize - 2,
                              },
                            ]}
                          >
                            {option.description}
                          </Text>
                        )}
                      </View>
                    </View>
                    {isSelected && (
                      <View style={[styles.checkmarkContainer, { backgroundColor: colors.primary + '15' }]}>
                        <Ionicons name="checkmark" size={18} color={colors.primary} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Cancel Button */}
            {showCancel && (
              <TouchableOpacity
                style={[
                  styles.cancelButton,
                  {
                    paddingVertical: responsive.cancelPaddingVertical,
                    backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
                    marginTop: 16,
                  },
                ]}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.cancelButtonText,
                    {
                      color: colors.textSecondary,
                      fontSize: responsive.optionTextSize,
                    },
                  ]}
                >
                  {cancelText}
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  handleIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  headerGradient: {
    marginTop:-20,
     paddingTop:22,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
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
    paddingTop: 32,
  },
  title: {
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    textAlign: 'center',
    marginBottom: 20,
  },
  optionsContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionText: {
    fontWeight: '500',
  },
  optionDescription: {
    marginTop: 2,
  },
  checkmarkContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontWeight: '600',
  },
});

export default CustomActionSheet;