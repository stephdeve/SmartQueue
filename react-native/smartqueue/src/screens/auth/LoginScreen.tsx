import React, { useState, useRef, useEffect } from 'react';
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
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuth, useAuthStore } from '../../store/authStore';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

interface LoginFormData {
  email: string;
  password: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

// Composant Input personnalisé
const CustomInput: React.FC<{
  icon: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'email-address' | 'default';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string;
  colors: any;
  onToggleSecure?: () => void;
  showSecure?: boolean;
}> = ({ icon, placeholder, value, onChangeText, secureTextEntry, keyboardType, autoCapitalize, error, colors, onToggleSecure, showSecure }) => (
  <View style={styles.inputContainer}>
    <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceSecondary, borderColor: error ? colors.danger : colors.border }]}>
      <Ionicons name={icon as any} size={20} color={colors.textTertiary} style={styles.inputIcon} />
      <TextInput
        style={[styles.input, { color: colors.textPrimary }]}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
      />
      {onToggleSecure && (
        <TouchableOpacity onPress={onToggleSecure} style={styles.eyeButton}>
          <Ionicons name={showSecure ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textTertiary} />
        </TouchableOpacity>
      )}
    </View>
    {error && <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>}
  </View>
);

// Composant Bouton Social
const SocialButton: React.FC<{
  icon: string;
  label: string;
  onPress: () => void;
  loading?: boolean;
  colors: any;
}> = ({ icon, label, onPress, loading, colors }) => (
  <TouchableOpacity
    style={[styles.socialButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
    onPress={onPress}
    activeOpacity={0.8}
    disabled={loading}
  >
    {loading ? (
      <ActivityIndicator size="small" color={colors.primary} />
    ) : (
      <>
        <Ionicons name={icon as any} size={20} color={colors.primary} />
        <Text style={[styles.socialButtonText, { color: colors.textPrimary }]}>{label}</Text>
      </>
    )}
  </TouchableOpacity>
);

export const LoginScreen: React.FC = () => {
  const colors = useThemeColors();
  const isDark = !!colors.dark?.background;
  const { login, isLoading, error, clearError } = useAuth();
  const { AlertComponent, showSuccess, showError } = useCustomAlert();
  const { isLoading: googleLoading, handleGoogleLogin } = useGoogleAuth();
  
  const [formData, setFormData] = useState<LoginFormData>({ email: '', password: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 7, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (error) clearError();
  }, [formData, error, clearError]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    if (!formData.email.trim()) newErrors.email = 'Email requis';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Email invalide';
    if (!formData.password) newErrors.password = 'Mot de passe requis';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Fonction centralisée de gestion d'erreurs
  const handleApiError = (error: any, customMessage?: string) => {
    console.error('API Error:', error);
    
    // Erreur réseau
    if (error?.message === 'Network Error' || error?.code === 'ERR_NETWORK') {
      showError(
        '📡 Erreur réseau',
        'Impossible de contacter le serveur.\n\nVérifiez :\n• Votre connexion internet\n• Que le serveur est démarré\n• Votre adresse IP/config réseau'
      );
      return;
    }
    
    // Pas de réponse du serveur (timeout)
    if (error?.request && !error?.response) {
      showError(
        '⏱️ Délai dépassé',
        'Le serveur ne répond pas. Veuillez réessayer dans quelques instants.'
      );
      return;
    }
    
    // Erreur avec code HTTP
    const status = error?.response?.status;
    const message = error?.response?.data?.message || error?.response?.data?.error;
    
    switch (status) {
      case 400:
        if (message?.includes('email')) {
          showError('Email invalide', 'Veuillez vérifier votre adresse email');
        } else {
          showError('Données invalides', message || 'Vérifiez vos informations');
        }
        break;
      case 401:
        showError('🔐 Échec de connexion', 'Email ou mot de passe incorrect');
        break;
      case 403:
        showError('Accès refusé', 'Votre compte n\'a pas accès à cette application');
        break;
      case 404:
        showError('Service indisponible', 'Le service de connexion est temporairement indisponible');
        break;
      case 429:
        showError('Trop de tentatives', 'Trop de tentatives de connexion. Veuillez réessayer dans 5 minutes.');
        break;
      case 500:
      case 502:
      case 503:
        showError('🔧 Erreur serveur', 'Problème technique. Réessayez plus tard.');
        break;
      default:
        showError('Erreur', message || customMessage || 'Une erreur est survenue lors de la connexion');
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    try {
      const user = await login({ 
        email: formData.email.trim(), 
        password: formData.password 
      });
      
      // Succès de la connexion
      showSuccess('✅ Connexion réussie', 'Bienvenue sur SmartQueue !');
      
      // Redirection après un court délai
      setTimeout(() => {
        if ((user as any)?.role === 'agent' || (user as any)?.role === 'admin') {
          router.replace('/agent');
        } else {
          router.replace('/(tabs)');
        }
      }, 1000);
      
    } catch (error: any) {
      handleApiError(error, 'Échec de la connexion');
    }
  };

  const handleGoogleLoginPress = async () => {
    try {
      const result = await handleGoogleLogin();
      
      if (result.success) {
        showSuccess('✅ Connexion réussie', 'Connexion Google réussie !');
        
        setTimeout(() => {
          // useAuth est un hook ; l'état hors rendu se lit sur le store zustand
          const { user } = useAuthStore.getState();
          if (user?.role === 'agent' || user?.role === 'admin') {
            router.replace('/agent');
          } else {
            router.replace('/(tabs)');
          }
        }, 1000);
        
      } else if (result.error) {
        // Gestion spécifique des erreurs Google
        if (result.error.includes('Network') || result.error.includes('network')) {
          showError('📡 Erreur réseau', 'Problème de connexion internet. Vérifiez votre réseau.');
        } else if (result.error.includes('canceled') || result.error.includes('annulée')) {
          showError('Connexion annulée', 'Vous avez annulé la connexion Google');
        } else if (result.error.includes('account')) {
          showError('Compte invalide', 'Problème avec votre compte Google');
        } else {
          showError('Erreur Google', result.error);
        }
      }
    } catch (error: any) {
      handleApiError(error, 'Échec de la connexion Google');
    }
  };

  const handleForgotPassword = () => {
    router.push('/forgot-password');
  };

  const handleGoToRegister = () => router.push('/register');

  const handleInputChange = (field: keyof LoginFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
    if (error) clearError();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          {/* Header avec animation */}
          <Animated.View style={[styles.headerContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
            <LinearGradient
              colors={isDark ? ['#1E3A5F', '#2563EB'] : ['#3B82F6', '#1D4ED8']}
              style={styles.headerGradient}
            >
              <View style={styles.logoContainer}>
                <Ionicons name="timer-outline" size={48} color="#FFF" />
              </View>
              <Text style={styles.logoText}>SmartQueue</Text>
              <Text style={styles.tagline}>Gérez vos files d’attente</Text>
            </LinearGradient>
          </Animated.View>

          {/* Formulaire */}
          <Animated.View style={[styles.formContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={[styles.formTitle, { color: colors.textPrimary }]}>Connexion</Text>
            <Text style={[styles.formSubtitle, { color: colors.textSecondary }]}>Connectez-vous pour continuer</Text>

            <CustomInput
              icon="mail-outline"
              placeholder="Adresse email"
              value={formData.email}
              onChangeText={(text) => handleInputChange('email', text)}
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
              colors={colors}
            />

            <CustomInput
              icon="lock-closed-outline"
              placeholder="Mot de passe"
              value={formData.password}
              onChangeText={(text) => handleInputChange('password', text)}
              secureTextEntry={!showPassword}
              error={errors.password}
              colors={colors}
              onToggleSecure={() => setShowPassword(!showPassword)}
              showSecure={showPassword}
            />

            <TouchableOpacity style={styles.forgotButton} onPress={handleForgotPassword}>
              <Text style={[styles.forgotText, { color: colors.primary }]}>Mot de passe oublié ?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.loginButton, { backgroundColor: colors.primary }, (isLoading || googleLoading) && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={isLoading || googleLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.loginButtonText}>Se connecter</Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.textTertiary }]}>ou</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            <SocialButton
              icon="logo-google"
              label="Continuer avec Google"
              onPress={handleGoogleLoginPress}
              loading={googleLoading}
              colors={colors}
            />

            <View style={styles.signupContainer}>
              <Text style={[styles.signupText, { color: colors.textSecondary }]}>Pas encore de compte ? </Text>
              <TouchableOpacity onPress={handleGoToRegister}>
                <Text style={[styles.signupLink, { color: colors.primary }]}>S’inscrire</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {AlertComponent}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  
  headerContainer: { marginBottom: -20, zIndex: 1 },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 50,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },
  
  formContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  formTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 14,
    marginBottom: 32,
  },
  
  inputContainer: { marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 45,
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  eyeButton: { padding: 4 },
  errorText: { fontSize: 11, marginTop: 4, marginLeft: 4 },
  
  forgotButton: { alignSelf: 'flex-end', marginBottom: 24, marginTop: 4 },
  forgotText: { fontSize: 13, fontWeight: '500' },
  
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  errorContainerText: { fontSize: 13, flex: 1 },
  
  loginButton: {
    borderRadius: 14,
    height: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: { opacity: 0.7 },
  loginButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 13 },
  
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 14,
    height: 45,
    gap: 12,
    marginBottom: 24,
  },
  socialButtonText: { fontSize: 15, fontWeight: '500' },
  
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupText: { fontSize: 14 },
  signupLink: { fontSize: 14, fontWeight: '700' },
});

export default LoginScreen;