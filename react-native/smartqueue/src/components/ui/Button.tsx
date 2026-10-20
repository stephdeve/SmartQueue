import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  View,
} from 'react-native';
import { useSettings } from '../../store/settingsStore';
import { Theme } from '../../theme';

// Types pour les boutons
export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

// Composant Button avec style iOS
export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  style,
  textStyle,
}) => {
  const { isDarkMode } = useSettings();
  
  // Obtenir les couleurs selon le thème et la variante
  const getButtonStyle = () => {
    const lightVariants = Theme.components.button as Record<string, any>;
    const darkVariants = Theme.dark.components.button as Record<string, any>;
    // Le thème ne définit pas de variante "success" : sans repli, le bouton était sans fond
    const baseStyle = lightVariants[variant]
      ?? { ...lightVariants.primary, backgroundColor: Theme.colors.success };

    if (isDarkMode && darkVariants[variant]) {
      return { ...baseStyle, ...darkVariants[variant] };
    }

    return baseStyle;
  };

  // Obtenir la taille du bouton
  const getSizeStyle = (): ViewStyle => {
    switch (size) {
      case 'small':
        return {
          paddingHorizontal: 16,
          paddingVertical: 8,
          minHeight: 36,
        };
      case 'large':
        return {
          paddingHorizontal: 32,
          paddingVertical: 16,
          minHeight: 52,
        };
      default: // medium
        return {
          paddingHorizontal: 24,
          paddingVertical: 12,
          minHeight: 44,
        };
    }
  };

  // Obtenir le style du texte selon la taille
  const getTextSizeStyle = (): TextStyle => {
    switch (size) {
      case 'small':
        return Theme.typography.textStyles.caption1;
      case 'large':
        return Theme.typography.textStyles.headline;
      default: // medium
        return Theme.typography.textStyles.button;
    }
  };

  // Style du conteneur
  const containerStyle: ViewStyle = {
    ...getButtonStyle(),
    ...getSizeStyle(),
    opacity: disabled || loading ? 0.5 : 1,
    width: fullWidth ? '100%' : undefined,
    ...style,
  };

  // Style du texte
  const containerTextStyle: TextStyle = {
    ...getTextSizeStyle(),
    textAlign: 'center',
    color: getButtonStyle().color || Theme.colors.textPrimary,
    ...textStyle,
  };

  // Contenu du bouton
  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator 
            size="small" 
            color={containerTextStyle.color} 
            style={styles.spinner}
          />
          <Text style={containerTextStyle}>{title}</Text>
        </View>
      );
    }

    if (icon && iconPosition === 'left') {
      return (
        <View style={styles.contentContainer}>
          {icon}
          <Text style={[containerTextStyle, styles.textWithIcon]}>{title}</Text>
        </View>
      );
    }

    if (icon && iconPosition === 'right') {
      return (
        <View style={styles.contentContainer}>
          <Text style={[containerTextStyle, styles.textWithIcon]}>{title}</Text>
          {icon}
        </View>
      );
    }

    return <Text style={containerTextStyle}>{title}</Text>;
  };

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};

// Styles
const styles = StyleSheet.create({
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    marginRight: 8,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  withRouter: {
    marginRight: 8,
  },
  textWithIcon: {
    marginLeft: 8,
  },
});

export default Button;
