import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuth } from '../../store/authStore';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Ionicons } from '@expo/vector-icons';

// Types pour le formulaire
interface LoginFormData {
  email: string;
  password: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

// Composant LoginScreen
export const LoginScreen: React.FC = () => {
  const colors = useThemeColors();
  const isDark = !!colors.dark?.background;
  const { login, isLoading, error, clearError } = useAuth();
  const { AlertComponent, showInfo, showWarning, showError, showSuccess } = useCustomAlert();
  const { isLoading: googleLoading, handleGoogleLogin } = useGoogleAuth();
  
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  React.useEffect(() => {
    if (error) {
      clearError();
    }
  }, [formData, error, clearError]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'L\'email est requis';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'L\'email n\'est pas valide';
    }

    if (!formData.password) {
      newErrors.password = 'Le mot de passe est requis';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const user = await login({
        email: formData.email.trim(),
        password: formData.password,
      });
      // Redirect based on user role
      if ((user as any)?.role === 'agent' || (user as any)?.role === 'admin') {
        router.replace('/agent');
      } else {
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleInputChange = (field: keyof LoginFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleGoToRegister = () => {
    router.push('/register');
  };

  const handleGoogleLoginPress = async () => {
    const result = await handleGoogleLogin();
    if (result.success) {
      showSuccess('Succès', 'Connexion Google réussie !');
      // Check role for redirect
      const { user } = useAuth();
      if ((user as any)?.role === 'agent' || (user as any)?.role === 'admin') {
        router.replace('/agent');
      } else {
        router.replace('/(tabs)');
      }
    } else if (result.error) {
      showError('Erreur', result.error);
    }
  };

  const handleForgotPassword = () => {
    showWarning(
      'Mot de passe oublié',
      'Entrez votre adresse email pour recevoir un lien de réinitialisation.',
      'Envoyer',
      () => {
        console.log('Send password reset to:', formData.email);
      },
      'Annuler'
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* Header */}
          <LinearGradient
            colors={isDark ? ['#1E3A5F', '#2563EB', '#3B82F6'] : ['#60A5FA', '#3B82F6', '#2563EB']}
            style={styles.headerGradient}
          >
            <Text style={styles.logoText}>SmartQueue</Text>
            <Text style={styles.welcomeText}>Soyez les bienvenues</Text>
          </LinearGradient>

          {/* Form */}
          <Animated.View
            style={[
              styles.formContainer,
              {
                backgroundColor: colors.surface,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >

            <View style={[styles.inputWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
              <TextInput
                style={[styles.input, { color: colors.textPrimary }]}
                placeholder="Adresse email"
                placeholderTextColor={colors.textTertiary}
                value={formData.email}
                onChangeText={(value) => handleInputChange('email', value)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>

            {errors.email && (
              <Text style={styles.errorText}>{errors.email}</Text>
            )}

            <View style={[styles.inputWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
              <TextInput
                style={[styles.input, { color: colors.textPrimary }]}
                placeholder="Mot de passe"
                placeholderTextColor={colors.textTertiary}
                value={formData.password}
                onChangeText={(value) => handleInputChange('password', value)}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!isLoading}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textTertiary}
                />
              </TouchableOpacity>
            </View>

            {errors.password && (
              <Text style={styles.errorText}>{errors.password}</Text>
            )}

            <TouchableOpacity
              onPress={handleForgotPassword}
              disabled={isLoading}
              style={styles.forgotPasswordContainer}
            >
              <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>Mot de passe oublié ?</Text>
            </TouchableOpacity>

            {error && (
              <View style={[styles.errorContainer, { backgroundColor: isDark ? '#451a1a' : '#FEF2F2' }]}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                <Text style={[styles.errorContainerText, { color: colors.danger }]}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.signInButton, { backgroundColor: colors.primary }, isLoading && styles.signInButtonDisabled]}
              onPress={handleSubmit}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <Text style={styles.signInButtonText}>Connexion...</Text>
              ) : (
                <Text style={styles.signInButtonText}>Se connecter</Text>
              )}
            </TouchableOpacity>

            <View style={styles.socialSection}>
              <TouchableOpacity
                style={[styles.googleButton, { backgroundColor: colors.surface, borderColor: colors.border }, googleLoading && styles.googleButtonLoading]}
                onPress={handleGoogleLoginPress}
                activeOpacity={0.8}
                disabled={googleLoading || isLoading}
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <View style={styles.googleIconContainer}>
                      <Ionicons name="logo-google" size={18} color={colors.primary} />
                    </View>
                    <Text style={[styles.googleButtonText, { color: colors.textPrimary }]}>Continuer avec Google</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.signUpContainer}>
              <Text style={[styles.signUpText, { color: colors.textSecondary }]}>Pas encore de compte ? </Text>
              <TouchableOpacity onPress={handleGoToRegister} disabled={isLoading}>
                <Text style={[styles.signUpLink, { color: colors.primary }]}>S&apos;inscrire</Text>
              </TouchableOpacity>
            </View>

          </Animated.View>

          {AlertComponent}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};


// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 80,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  logoText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: 2,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  formContainer: {
    marginTop: -40,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    flex: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 52,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  eyeIcon: {
    padding: 4,
  },
  errorText: {
    fontSize: 12,
    marginTop: -12,
    marginBottom: 12,
    marginLeft: 4,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorContainerText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  signInButton: {
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  signInButtonDisabled: {
    opacity: 0.7,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color:'white',
  },
  socialSection: {
    marginBottom: 24,
  },
  socialTitle: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
    height: 48,
  },
  googleButtonLoading: {
    opacity: 0.7,
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  googleButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  signUpText: {
    fontSize: 14,
  },
  signUpLink: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default LoginScreen;
