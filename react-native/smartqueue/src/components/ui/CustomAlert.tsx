import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../hooks/useThemeColors';

const { width } = Dimensions.get('window');

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
}

interface AlertConfig {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBgColor: string;
  primaryButtonBg: string;
  primaryButtonText: string;
  secondaryButtonBg: string;
  secondaryButtonText: string;
  headerBgColor: string;
  secondaryButtonBorder?: string;
}

const alertConfig: Record<AlertType, AlertConfig> = {
  success: {
    icon: 'checkmark-circle',
    iconColor: '#FFFFFF',
    iconBgColor: '#22C55E',
    primaryButtonBg: '#22C55E',
    primaryButtonText: '#FFFFFF',
    secondaryButtonBg: 'transparent',
    secondaryButtonText: '#6B7280',
    headerBgColor: '#86EFAC',
    secondaryButtonBorder: '#E5E7EB',
  },
  warning: {
    icon: 'alert-triangle',
    iconColor: '#FFFFFF',
    iconBgColor: '#F59E0B',
    primaryButtonBg: '#F59E0B',
    primaryButtonText: '#FFFFFF',
    secondaryButtonBg: 'transparent',
    secondaryButtonText: '#6B7280',
    headerBgColor: '#FCD34D',
    secondaryButtonBorder: '#E5E7EB',
  },
  error: {
    icon: 'close-circle',
    iconColor: '#FFFFFF',
    iconBgColor: '#EF4444',
    primaryButtonBg: '#EF4444',
    primaryButtonText: '#FFFFFF',
    secondaryButtonBg: 'transparent',
    secondaryButtonText: '#6B7280',
    headerBgColor: '#FCA5A5',
    secondaryButtonBorder: '#E5E7EB',
  },
  info: {
    icon: 'information-circle',
    iconColor: '#FFFFFF',
    iconBgColor: '#3B82F6',
    primaryButtonBg: '#3B82F6',
    primaryButtonText: '#FFFFFF',
    secondaryButtonBg: 'transparent',
    secondaryButtonText: '#6B7280',
    headerBgColor: '#93C5FD',
    secondaryButtonBorder: '#E5E7EB',
  },
};

export const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  type,
  title,
  message,
  primaryButton,
  secondaryButton,
  onClose,
}) => {
  const colors = useThemeColors();
  const isDark = !!colors.dark?.background;
  const config = alertConfig[type];

  // Garde-fou : ne jamais rendre un objet comme enfant React (crash fatal en
  // build : "Objects are not valid as a React child"). On force une chaîne.
  const safeTitle = typeof title === 'string' ? title : String(title ?? '');
  const safeMessage =
    typeof message === 'string'
      ? message
      : (message as any)?.message ?? JSON.stringify(message ?? '');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          {/* Header with Icon */}
          <View style={[styles.header, { backgroundColor: config.headerBgColor }]}>
            <View style={[styles.iconContainer, { backgroundColor: config.iconBgColor }]}>
              <Ionicons name={config.icon} size={28} color={config.iconColor} />
            </View>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{safeTitle}</Text>
            <Text style={[styles.message, { color: colors.textSecondary }]}>{safeMessage}</Text>

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              {secondaryButton && (
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.secondaryButton,
                    { backgroundColor: isDark ? colors.surfaceSecondary : config.secondaryButtonBg },
                    type === 'warning' && {
                      backgroundColor: isDark ? 'transparent' : 'transparent',
                      borderWidth: 1,
                      borderColor: isDark ? colors.border : config.secondaryButtonBorder,
                    },
                  ]}
                  onPress={secondaryButton.onPress}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      { color: isDark ? colors.textSecondary : config.secondaryButtonText },
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
                  onPress={primaryButton.onPress}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      styles.primaryButtonText,
                      { color: config.primaryButtonText },
                    ]}
                  >
                    {primaryButton.text}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: width * 0.85,
    maxWidth: 360,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    height: 70,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: -20,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: -28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  content: {
    paddingTop: 40,
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'column',
    width: '100%',
    gap: 12,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    width: '100%',
  },
  secondaryButton: {
    width: '100%',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  primaryButtonText: {
    fontWeight: '700',
  },
});

export default CustomAlert;
