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
  section?: string;
  type?: 'status' | 'hours' | 'day' | 'exception' | 'separator' | 'info';
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

// Fonction pour obtenir la couleur selon le type d'option
const getOptionColor = (type?: string, isSelected?: boolean, colors?: any) => {
  if (isSelected) return colors?.primary || '#3B82F6';
  
  switch (type) {
    case 'status': return '#10B981';
    case 'hours': return '#F59E0B';
    case 'day': return '#8B5CF6';
    case 'exception': return '#EF4444';
    case 'info': return '#3B82F6';
    case 'separator': return '#6B7280';
    default: return colors?.textPrimary || '#1F2937';
  }
};

// Fonction responsive ultra compacte
const getResponsiveSize = (screenW: number, screenH: number) => {
  const isLandscape = screenW > screenH;
  const isTablet = screenW >= 768;
  
  return {
    containerMaxHeight: isLandscape ? '90%' : '85%',
    iconSize: isTablet ? 52 : 44,
    iconMarginTop: isTablet ? -26 : -22,
    titleSize: isTablet ? 20 : 16,
    messageSize: isTablet ? 13 : 11,
    optionTextSize: isTablet ? 14 : 12,
    optionPaddingVertical: isTablet ? 12 : 8,
    cancelPaddingVertical: isTablet ? 12 : 8,
    contentPaddingHorizontal: isTablet ? 20 : 16,
    contentPaddingBottom: isTablet ? 24 : 20,
    sectionHeaderSize: isTablet ? 11 : 10,
  };
};

// Traduction des sections
const getSectionTitle = (section: string): string => {
  const titles: { [key: string]: string } = {
    'status': 'État',
    'hours': 'Horaires',
    'days': 'Jours',
    'exceptions': 'Exceptions',
    'info': 'Infos',
    'general': 'Options',
  };
  return titles[section] || section;
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
  cancelText = 'Fermer',
}) => {
  const colors = useThemeColors();
  const isDark = !!colors.dark?.background;
  const theme = config[type];
  
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [screenWidth, setScreenWidth] = React.useState(screenWidth);
  const [screenHeightState, setScreenHeightState] = React.useState(screenHeight);
  const responsive = getResponsiveSize(screenWidth, screenHeightState);

  // Grouper les options par section
  const groupedOptions: { [key: string]: Option[] } = {};
  options.forEach(option => {
    const section = option.section || 'general';
    if (!groupedOptions[section]) groupedOptions[section] = [];
    groupedOptions[section].push(option);
  });

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }: { window: ScaledSize }) => {
      setScreenWidth(window.width);
      setScreenHeightState(window.height);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: screenHeightState, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, screenHeightState]);

  const handleSelect = (value: string | number) => {
    onSelect(value);
    setTimeout(onClose, 150);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        
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
          {/* Handle Indicator plus compact */}
          <View style={styles.handleIndicator} />

          {/* Header avec icône plus compact */}
          <LinearGradient colors={theme.gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerGradient}>
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
              <Ionicons name={theme.icon} size={responsive.iconSize * 0.45} color="#FFFFFF" />
            </View>
          </LinearGradient>

          {/* Content compact */}
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
            <Text style={[styles.title, { color: colors.textPrimary, fontSize: responsive.titleSize }]}>
              {title}
            </Text>
            
            {message && (
              <Text style={[styles.message, { color: colors.textSecondary, fontSize: responsive.messageSize, lineHeight: responsive.messageSize * 1.4 }]}>
                {message}
              </Text>
            )}

            {/* Options par section */}
            {Object.entries(groupedOptions).map(([section, sectionOptions]) => (
              <View key={section} style={styles.sectionContainer}>
                <Text style={[styles.sectionHeader, { color: colors.textTertiary, fontSize: responsive.sectionHeaderSize }]}>
                  {getSectionTitle(section)}
                </Text>
                <View style={styles.optionsContainer}>
                  {sectionOptions.map((option, index) => {
                    const isSelected = selectedValue === option.value;
                    const optionColor = getOptionColor(option.type, isSelected, colors);
                    const isLast = index === sectionOptions.length - 1;

                    if (option.type === 'separator') {
                      return (
                        <View key={`${index}-${String(option.value)}`} style={styles.separatorItem}>
                          <Text style={[styles.separatorText, { color: colors.textTertiary }]}>{option.label}</Text>
                        </View>
                      );
                    }

                    return (
                      <TouchableOpacity
                        key={`${index}-${String(option.value)}`}
                        style={[
                          styles.optionButton,
                          {
                            paddingVertical: responsive.optionPaddingVertical,
                            backgroundColor: isSelected ? optionColor + '10' : colors.surfaceSecondary,
                            borderBottomWidth: !isLast ? 0.5 : 0,
                            borderBottomColor: colors.border,
                          },
                        ]}
                        onPress={() => handleSelect(option.value)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.optionLeft}>
                          {option.icon && (
                            <View style={[styles.optionIconContainer, { backgroundColor: optionColor + '10' }]}>
                              <Ionicons name={option.icon} size={responsive.optionTextSize + 1} color={optionColor} />
                            </View>
                          )}
                          <View style={styles.optionTextContainer}>
                            <Text
                              style={[
                                styles.optionText,
                                {
                                  color: isSelected ? optionColor : colors.textPrimary,
                                  fontSize: responsive.optionTextSize,
                                  fontWeight: isSelected ? '600' : '400',
                                },
                              ]}
                              numberOfLines={1}
                            >
                              {option.label}
                            </Text>
                            {option.description && (
                              <Text style={[styles.optionDescription, { color: colors.textTertiary, fontSize: responsive.optionTextSize - 2 }]} numberOfLines={1}>
                                {option.description}
                              </Text>
                            )}
                          </View>
                        </View>
                        {isSelected && (
                          <View style={[styles.checkmarkContainer, { backgroundColor: optionColor + '15' }]}>
                            <Ionicons name="checkmark" size={12} color={optionColor} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}

            {/* Cancel Button compact */}
            {showCancel && (
              <TouchableOpacity
                style={[styles.cancelButton, { marginTop: 12 }]}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={[styles.cancelButtonText, { color: "#FFF", fontSize: responsive.optionTextSize }]}>
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
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  container: { borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 8 },
  handleIndicator: { width: 32, height: 3, borderRadius: 1.5, backgroundColor: '#CBD5E1', alignSelf: 'center', marginTop: 8, marginBottom: 2 },
  headerGradient: { marginTop: -16, paddingTop: 18, height: 65, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  iconContainer: { justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 },
  content: { paddingTop: 24 },
  title: { fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  message: { textAlign: 'center', marginBottom: 16 },
  sectionContainer: { marginBottom: 12 },
  sectionHeader: { fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginLeft: 4 },
  optionsContainer: { borderRadius: 12, overflow: 'hidden', marginBottom: 6 },
  optionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  optionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  optionIconContainer: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  optionTextContainer: { flex: 1 },
  optionText: { fontWeight: '500' },
  optionDescription: { marginTop: 1 },
  checkmarkContainer: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cancelButton: { borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EF4444', marginHorizontal: 16, paddingVertical:12 },
  cancelButtonText: { fontWeight: '600' },
  separatorItem: { paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  separatorText: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
});

export default CustomActionSheet;