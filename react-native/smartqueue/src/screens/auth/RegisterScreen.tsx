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
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../store/authStore';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

interface RegisterFormData {
  name: string;
  email: string;
  phone: string;
  password: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
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
  keyboardType?: 'email-address' | 'default' | 'phone-pad';
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

// Composant Checkbox
const Checkbox: React.FC<{
  checked: boolean;
  onPress: () => void;
  label: string;
  colors: any;
}> = ({ checked, onPress, label, colors }) => (
  <TouchableOpacity style={styles.checkboxContainer} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.checkbox, { borderColor: colors.border }, checked && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
      {checked && <Ionicons name="checkmark" size={12} color="#FFF" />}
    </View>
    <Text style={[styles.checkboxLabel, { color: colors.textSecondary }]}>{label}</Text>
  </TouchableOpacity>
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

export const RegisterScreen: React.FC = () => {
  const colors = useThemeColors();
  const isDark = !!colors.dark?.background;
  const { register, isLoading, error, clearError } = useAuth();
  const { AlertComponent, showSuccess, showError } = useCustomAlert();
  const { isLoading: googleLoading, handleGoogleRegister } = useGoogleAuth();
  
  const [formData, setFormData] = useState<RegisterFormData>({
    name: '',
    email: '',
    phone: '',
    password: '',
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
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

    if (!formData.name.trim()) newErrors.name = 'Nom requis';
    else if (formData.name.trim().length < 2) newErrors.name = 'Nom trop court';

    if (!formData.email.trim()) newErrors.email = 'Email requis';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Email invalide';

    if (formData.phone && !/^[+]?[\d\s-()]{8,}$/.test(formData.phone)) {
      newErrors.phone = 'Téléphone invalide';
    }

    if (!formData.password) newErrors.password = 'Mot de passe requis';
    else if (formData.password.length < 6) newErrors.password = '6 caractères minimum';

    if (!agreedToTerms) newErrors.general = 'Acceptez les conditions';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    try {
      await register({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        password: formData.password,
        password_confirmation: formData.password,
      });
      router.replace('/(tabs)');
    } catch (error) { console.error('Register error:', error); }
  };

  const handleInputChange = (field: keyof RegisterFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const handleGoToLogin = () => router.push('/login');

  const handleGoogleRegisterPress = async () => {
    const result = await handleGoogleRegister(formData.phone || undefined);
    if (result.success) {
      showSuccess('Succès', 'Inscription Google réussie !');
      router.replace('/(tabs)');
    } else if (result.error) showError('Erreur', result.error);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header avec animation */}
          <Animated.View style={[styles.headerContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
            <LinearGradient
              colors={isDark ? ['#1E3A5F', '#2563EB'] : ['#3B82F6', '#1D4ED8']}
              style={styles.headerGradient}
            >
              <TouchableOpacity style={styles.backButton} onPress={handleGoToLogin}>
                <Ionicons name="arrow-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <View style={styles.logoContainer}>
                <Ionicons name="person-add-outline" size={48} color="#FFF" />
              </View>
              <Text style={styles.logoText}>Inscription</Text>
              <Text style={styles.tagline}>Créez votre compte gratuitement</Text>
            </LinearGradient>
          </Animated.View>

          {/* Formulaire */}
          <Animated.View style={[styles.formContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={[styles.formTitle, { color: colors.textPrimary }]}>Informations</Text>
            <Text style={[styles.formSubtitle, { color: colors.textSecondary }]}>Remplissez vos coordonnées</Text>

            <CustomInput
              icon="person-outline"
              placeholder="Nom complet"
              value={formData.name}
              onChangeText={(text) => handleInputChange('name', text)}
              autoCapitalize="words"
              error={errors.name}
              colors={colors}
            />

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
              icon="call-outline"
              placeholder="Téléphone (optionnel)"
              value={formData.phone}
              onChangeText={(text) => handleInputChange('phone', text)}
              keyboardType="phone-pad"
              error={errors.phone}
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

            <Checkbox
              checked={agreedToTerms}
              onPress={() => setAgreedToTerms(!agreedToTerms)}
              label="J'accepte les conditions d'utilisation"
              colors={colors}
            />

            {errors.general && (
              <View style={[styles.errorContainer, { backgroundColor: colors.danger + '10' }]}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                <Text style={[styles.errorContainerText, { color: colors.danger }]}>{errors.general}</Text>
              </View>
            )}

            {error && (
              <View style={[styles.errorContainer, { backgroundColor: colors.danger + '10' }]}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                <Text style={[styles.errorContainerText, { color: colors.danger }]}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.registerButton, { backgroundColor: colors.primary }, (isLoading || googleLoading) && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={isLoading || googleLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.registerButtonText}>S'inscrire</Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.textTertiary }]}>ou</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            <SocialButton
              icon="logo-google"
              label="S'inscrire avec Google"
              onPress={handleGoogleRegisterPress}
              loading={googleLoading}
              colors={colors}
            />

            <View style={styles.loginContainer}>
              <Text style={[styles.loginText, { color: colors.textSecondary }]}>Déjà inscrit ? </Text>
              <TouchableOpacity onPress={handleGoToLogin}>
                <Text style={[styles.loginLink, { color: colors.primary }]}>Se connecter</Text>
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
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 50,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
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
    fontSize: 28,
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
    height: 54,
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  eyeButton: { padding: 4 },
  errorText: { fontSize: 11, marginTop: 4, marginLeft: 4 },
  
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxLabel: {
    fontSize: 13,
    flex: 1,
  },
  
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  errorContainerText: { fontSize: 13, flex: 1 },
  
  registerButton: {
    borderRadius: 14,
    height: 54,
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
  registerButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  
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
    height: 54,
    gap: 12,
    marginBottom: 24,
  },
  socialButtonText: { fontSize: 15, fontWeight: '500' },
  
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: { fontSize: 14 },
  loginLink: { fontSize: 14, fontWeight: '700' },
});

export default RegisterScreen;