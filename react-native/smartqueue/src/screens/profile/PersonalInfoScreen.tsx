import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../store/authStore';
import { usersApi } from '../../api/usersApi';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import { useThemeColors } from '../../hooks/useThemeColors';
import { router } from 'expo-router';

export const PersonalInfoScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const isDark = !!colors.dark?.background;
  const { user, updateUser, logout } = useAuth();
  const { AlertComponent, showError, showSuccess } = useCustomAlert();
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      showError('Erreur', 'Le nom est obligatoire.');
      return;
    }

    setIsLoading(true);
    try {
      // Utiliser la même méthode qui fonctionnait avant
      const response = await usersApi.updateProfile({ name, phone });
      updateUser({ name, phone });
      showSuccess('Succès', 'Votre profil a été mis à jour.', 'OK', () => {
        setIsEditing(false);
      });
    } catch (error: any) {
      console.error('Update profile error:', error);
      
      // Afficher le message d'erreur détaillé
      const errorMsg = error?.response?.data?.message || error?.message || 'Impossible de mettre à jour le profil.';
      showError('Erreur', errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Suppression définitive (DELETE /me) : exigée par l'App Store et le Play Store
  // pour toute application permettant de créer un compte.
  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await usersApi.deleteAccount(deletePassword);
      setDeleteVisible(false);
      await logout();
      router.replace('/login');
    } catch (error: any) {
      const status = error?.response?.status;
      const message =
        status === 422
          ? 'Mot de passe incorrect.'
          : error?.response?.data?.message || 'Impossible de supprimer le compte. Réessayez plus tard.';
      showError('Suppression impossible', message);
    } finally {
      setIsDeleting(false);
    }
  };

  const getInitials = () => {
    return (name || user?.name || 'U').charAt(0).toUpperCase();
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton} activeOpacity={0.8}>
            <View style={[styles.iconButtonBg, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name="arrow-back" size={22} color="#FFF" />
            </View>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profil</Text>
          <TouchableOpacity onPress={() => setIsEditing(!isEditing)} style={styles.iconButton} activeOpacity={0.8}>
            <View style={[styles.iconButtonBg, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name={isEditing ? "close" : "pencil"} size={20} color="#FFF" />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, { backgroundColor: colors.surface }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>{getInitials()}</Text>
            </View>
          </View>
          <Text style={styles.userName}>{user?.name || 'Utilisateur'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={[styles.formContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Name Field */}
          <View style={[styles.fieldContainer, { borderBottomColor: colors.border }]}>
            <View style={[styles.fieldIconContainer, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="person-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.fieldContent}>
              <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>Nom complet</Text>
              <TextInput
                style={[styles.fieldInput, { color: colors.textPrimary }, !isEditing && { color: colors.textSecondary }]}
                value={name}
                onChangeText={setName}
                placeholder="Votre nom"
                placeholderTextColor={colors.textTertiary}
                editable={isEditing}
              />
            </View>
          </View>

          {/* Email Field */}
          <View style={[styles.fieldContainer, { borderBottomColor: colors.border }]}>
            <View style={[styles.fieldIconContainer, { backgroundColor: colors.secondary + '15' }]}>
              <Ionicons name="mail-outline" size={18} color={colors.secondary} />
            </View>
            <View style={styles.fieldContent}>
              <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>Email</Text>
              <TextInput
                style={[styles.fieldInput, { color: colors.textSecondary }]}
                value={user?.email || ''}
                editable={false}
                placeholderTextColor={colors.textTertiary}
              />
            </View>
          </View>

          {/* Phone Field */}
          <View style={[styles.fieldContainer, { borderBottomColor: colors.border }]}>
            <View style={[styles.fieldIconContainer, { backgroundColor: colors.success + '15' }]}>
              <Ionicons name="call-outline" size={18} color={colors.success} />
            </View>
            <View style={styles.fieldContent}>
              <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>Téléphone</Text>
              <TextInput
                style={[styles.fieldInput, { color: colors.textPrimary }, !isEditing && { color: colors.textSecondary }]}
                value={phone}
                onChangeText={setPhone}
                placeholder="+229 01 00 00 00 00"
                placeholderTextColor={colors.textTertiary}
                keyboardType="phone-pad"
                editable={isEditing}
              />
            </View>
          </View>
        </View>

        {isEditing && (
          <TouchableOpacity
            style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.saveButtonGradient}>
              {isLoading ? (
                <Ionicons name="sync" size={20} color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color="#FFF" />
                  <Text style={styles.saveButtonText}>Enregistrer</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View style={styles.dangerSection}>
          <Text style={[styles.dangerTitle, { color: colors.textTertiary }]}>Zone de danger</Text>
          <TouchableOpacity 
            style={[styles.dangerButton, { backgroundColor: colors.danger + '10', borderColor: colors.danger + '20' }]}
            onPress={() => {
              setDeletePassword('');
              setDeleteVisible(true);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={[styles.dangerButtonText, { color: colors.danger }]}>Supprimer mon compte</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.danger} />
          </TouchableOpacity>
        </View>

        {AlertComponent}
      </ScrollView>

      <Modal visible={deleteVisible} transparent animationType="fade" onRequestClose={() => setDeleteVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Supprimer mon compte</Text>
            <Text style={[styles.modalText, { color: colors.textSecondary }]}>
              Votre compte et vos données personnelles seront supprimés définitivement. Vos tickets en cours seront annulés.
            </Text>
            <TextInput
              style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border }]}
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="Mot de passe"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
              autoCapitalize="none"
              editable={!isDeleting}
            />
            <Text style={[styles.modalHint, { color: colors.textTertiary }]}>
              Compte créé avec Google : laissez ce champ vide.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { borderColor: colors.border }]}
                onPress={() => setDeleteVisible(false)}
                disabled={isDeleting}
              >
                <Text style={[styles.modalButtonText, { color: colors.textPrimary }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.danger, borderColor: colors.danger }]}
                onPress={handleDeleteAccount}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: '#FFF' }]}>Supprimer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  iconButton: { width: 36, height: 36 },
  iconButtonBg: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  avatarSection: { alignItems: 'center' },
  avatarContainer: { position: 'relative', marginBottom: 12 },
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 },
  avatarText: { fontSize: 32, fontWeight: '700' },
  userName: { fontSize: 20, fontWeight: '700', color: '#FFF', marginBottom: 2 },
  userEmail: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 30 },
  formContainer: { borderRadius: 18, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  fieldContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 0.5 },
  fieldIconContainer: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  fieldContent: { flex: 1 },
  fieldLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  fieldInput: { fontSize: 15, fontWeight: '500', padding: 0, height: 22 },
  saveButton: { borderRadius: 14, overflow: 'hidden', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  saveButtonText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  dangerSection: { marginTop: 8 },
  dangerTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 },
  dangerButton: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, borderWidth: 1 },
  dangerButtonText: { flex: 1, fontSize: 14, fontWeight: '600', marginLeft: 10 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalCard: { borderRadius: 18, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  modalText: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  modalInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  modalHint: { fontSize: 12, marginTop: 6, marginBottom: 18 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalButton: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  modalButtonText: { fontSize: 15, fontWeight: '700' },
});

export default PersonalInfoScreen;