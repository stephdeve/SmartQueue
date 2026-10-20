import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TouchableOpacity,
  TouchableOpacityProps,
} from 'react-native';
import { useSettings } from '../../store/settingsStore';
import { Theme } from '../../theme';

// Types pour les cartes
export interface CardProps extends TouchableOpacityProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: number | 'none' | 'small' | 'medium' | 'large';
  margin?: number | 'none' | 'small' | 'medium' | 'large';
  borderRadius?: number;
  onPress?: () => void;
  style?: ViewStyle;
  disabled?: boolean;
}

// Composant Card avec style iOS
export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'medium',
  margin = 'none',
  borderRadius = 12,
  onPress,
  style,
  disabled = false,
  ...touchableProps
}) => {
  const { isDarkMode } = useSettings();
  
  // Obtenir le style de la carte selon la variante
  const getCardStyle = () => {
    const baseStyle = Theme.components.card[variant];
    
    if (isDarkMode && Theme.dark.components.card) {
      return { ...baseStyle, ...Theme.dark.components.card };
    }
    
    return baseStyle;
  };

  // Obtenir le padding selon la taille
  const getPaddingStyle = (): ViewStyle => {
    if (typeof padding === 'number') return { padding };
    switch (padding) {
      case 'none':
        return { padding: 0 };
      case 'small':
        return { padding: Theme.spacing.sm };
      case 'large':
        return { padding: Theme.spacing.xxl };
      case 'medium':
      default:
        return { padding: Theme.spacing.lg };
    }
  };

  // Obtenir le margin selon la taille
  const getMarginStyle = (): ViewStyle => {
    if (typeof margin === 'number') return { margin };
    switch (margin) {
      case 'none':
        return { margin: 0 };
      case 'small':
        return { margin: Theme.spacing.sm };
      case 'large':
        return { margin: Theme.spacing.xxl };
      case 'medium':
      default:
        return { margin: Theme.spacing.lg };
    }
  };

  // Style du conteneur
  const containerStyle: ViewStyle = {
    ...getCardStyle(),
    ...getPaddingStyle(),
    ...getMarginStyle(),
    borderRadius,
    opacity: disabled ? 0.5 : 1,
    ...style,
  };

  // Si onPress est fourni, utiliser TouchableOpacity
  if (onPress) {
    return (
      <TouchableOpacity
        style={containerStyle}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
        {...touchableProps}
      >
        {children}
      </TouchableOpacity>
    );
  }

  // Sinon, utiliser View simple
  return (
    <View style={containerStyle}>
      {children}
    </View>
  );
};

// Types pour les sections de carte
export interface CardSectionProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number | 'none' | 'small' | 'medium' | 'large';
  borderBottom?: boolean;
}

// Composant pour les sections de carte
export const CardSection: React.FC<CardSectionProps> = ({
  children,
  style,
  padding = 'medium',
  borderBottom = false,
}) => {
  const getPaddingStyle = (): ViewStyle => {
    if (typeof padding === 'number') return { padding };
    switch (padding) {
      case 'none':
        return { padding: 0 };
      case 'small':
        return { padding: Theme.spacing.sm };
      case 'large':
        return { padding: Theme.spacing.xxl };
      case 'medium':
      default:
        return { padding: Theme.spacing.lg };
    }
  };

  const sectionStyle: ViewStyle = {
    ...getPaddingStyle(),
    borderBottomWidth: borderBottom ? 0.5 : 0,
    borderBottomColor: Theme.colors.separator,
    ...style,
  };

  return (
    <View style={sectionStyle}>
      {children}
    </View>
  );
};

// Types pour les headers de carte
export interface CardHeaderProps {
  title?: string;
  subtitle?: string;
  rightComponent?: React.ReactNode;
  style?: ViewStyle;
}

// Composant pour les headers de carte
export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  rightComponent,
  style,
}) => {
  return (
    <View style={[styles.header, style]}>
      <View style={styles.headerContent}>
        {title && (
          <Text style={styles.title}>{title}</Text>
        )}
        {subtitle && (
          <Text style={styles.subtitle}>{subtitle}</Text>
        )}
      </View>
      {rightComponent && (
        <View style={styles.rightComponent}>
          {rightComponent}
        </View>
      )}
    </View>
  );
};

// Types pour les footers de carte
export interface CardFooterProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number | 'none' | 'small' | 'medium' | 'large';
}

// Composant pour les footers de carte
export const CardFooter: React.FC<CardFooterProps> = ({
  children,
  style,
  padding = 'medium',
}) => {
  const getPaddingStyle = (): ViewStyle => {
    if (typeof padding === 'number') return { padding };
    switch (padding) {
      case 'none':
        return { padding: 0 };
      case 'small':
        return { padding: Theme.spacing.sm };
      case 'large':
        return { padding: Theme.spacing.xxl };
      case 'medium':
      default:
        return { padding: Theme.spacing.lg };
    }
  };

  const footerStyle: ViewStyle = {
    ...getPaddingStyle(),
    borderTopWidth: 0.5,
    borderTopColor: Theme.colors.separator,
    ...style,
  };

  return (
    <View style={footerStyle}>
      {children}
    </View>
  );
};

// Styles
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.sm,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    ...Theme.typography.textStyles.headline,
    color: Theme.colors.textPrimary,
    marginBottom: Theme.spacing.xs / 2,
  },
  subtitle: {
    ...Theme.typography.textStyles.footnote,
    color: Theme.colors.textSecondary,
  },
  rightComponent: {
    marginLeft: Theme.spacing.sm,
  },
});

export default Card;
