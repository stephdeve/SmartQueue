import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Platform,
  Switch,
  StyleSheet,
} from 'react-native';
import { useAuth } from '../../src/store/authStore';
import { useSettings } from '../../src/store/settingsStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCustomAlert } from '../../src/hooks/useCustomAlert';
import { useTheme } from '../../src/hooks/useTheme';

interface MenuItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  onPress: () => void;
  destructive?: boolean;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (value: boolean) => void;
}

export default function AgentProfileScreen() {
  const { user, logout } = useAuth();
  const { 
    isDarkMode, 
    setDarkMode,
    preferences,
    updatePreferences,
    loadPreferences 
  } = useSettings();
  const { colors } = useTheme();
  const { AlertComponent, showWarning } = useCustomAlert();
  
  const [avatarUri] = useState<string | null>(null);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);
  
  const pushNotificationsEnabled = preferences.push_notifications_enabled;

  const handleLogout = () => {
    showWarning(
      'Déconnexion',
      'Voulez-vous vraiment vous déconnecter ?',
      'Déconnexion',
      async () => {
        try {
          await logout();
          router.push('/login');
        } catch (error) {
          console.error('Erreur de déconnexion :', error);
        }
      },
      'Annuler'
    );
  };

  const getMemberSince = () => {
    if (!user?.created_at) return 'Récemment';
    try {
      const date = new Date(user.created_at);
      return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    } catch {
      return 'Récemment';
    }
  };

  const menuSections = [
    {
      title: 'COMPTE',
      items: [
        { id: 'personalInfo', title: 'Informations', subtitle: 'Nom, email, téléphone', icon: 'person-outline', iconBg: colors.primary, onPress: () => router.push('/personal-info') },
        { id: 'role', title: 'Rôle', subtitle: user?.role === 'admin' ? 'Administrateur' : 'Agent', icon: 'shield-outline', iconBg: colors.success, onPress: () => {} },
      ],
    },
    {
      title: 'SERVICES',
      items: [
        { id: 'services', title: 'Mes services', subtitle: `${((user as any)?.services || []).length} service(s)`, icon: 'layers-outline', iconBg: colors.warning, onPress: () => router.push('/agent') },
        { id: 'counters', title: 'Mes guichets', subtitle: `${((user as any)?.counters || []).length} guichet(s)`, icon: 'desktop-outline', iconBg: colors.secondary, onPress: () => router.push('/agent') },
      ],
    },
    {
      title: 'APP',
      items: [
        { id: 'notifications', title: 'Notifications', icon: 'notifications-outline', iconBg: colors.warning, toggle: true, toggleValue: pushNotificationsEnabled, onToggle: (v: boolean) => { updatePreferences({ push_notifications_enabled: v }).catch(() => {}); } },
        { id: 'darkMode', title: 'Mode sombre', icon: 'moon-outline', iconBg: colors.secondary, toggle: true, toggleValue: isDarkMode, onToggle: setDarkMode },
      ],
    },
    {
      title: 'SUPPORT',
      items: [
        { id: 'help', title: 'Aide & support', icon: 'help-circle-outline', iconBg: colors.info, onPress: () => router.push('/help-support') },
        { id: 'about', title: 'À propos', icon: 'information-circle-outline', iconBg: colors.textTertiary, onPress: () => router.push('/about') },
      ],
    },
  ];

  const MenuItemComponent = ({ item }: { item: MenuItem }) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={item.onPress}
      disabled={item.toggle || item.id === 'role'}
      activeOpacity={0.7}
    >
      <View style={styles.menuItemLeft}>
        <View style={[styles.iconContainer, { backgroundColor: item.iconBg + '15' }]}>
          <Ionicons name={item.icon} size={18} color={item.iconBg} />
        </View>
        <View style={styles.menuItemText}>
          <Text style={[styles.menuItemTitle, { color: colors.textPrimary }]}>{item.title}</Text>
          {item.subtitle && <Text style={[styles.menuItemSubtitle, { color: colors.textTertiary }]}>{item.subtitle}</Text>}
        </View>
      </View>
      
      {item.toggle ? (
        <Switch value={item.toggleValue} onValueChange={item.onToggle} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={item.toggleValue ? colors.primary : colors.textTertiary} />
      ) : item.id === 'role' ? (
        <View style={[styles.roleBadge, { backgroundColor: colors.primary + '15' }]}>
          <Text style={[styles.roleText, { color: colors.primary }]}>{user?.role === 'admin' ? 'Admin' : 'Agent'}</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      )}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      {/* Header compact */}
      <LinearGradient colors={[colors.primary, colors.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={[styles.roleBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Ionicons name="shield-checkmark" size={12} color="#FFF" />
            <Text style={styles.roleBadgeText}>{user?.role === 'admin' ? 'Admin' : 'Agent'}</Text>
          </View>

          <View style={styles.avatarWrapper}>
            <View style={[styles.avatar, { backgroundColor: colors.surface }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>{(user?.name || 'A').charAt(0).toUpperCase()}</Text>
            </View>
            <TouchableOpacity style={[styles.cameraBtn, { backgroundColor: colors.primary }]}>
              <Ionicons name="camera" size={12} color="#FFF" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.userName}>{user?.name || 'Agent'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'agent@smartqueue.com'}</Text>
          <View style={styles.memberBadge}>
            <Ionicons name="calendar-outline" size={10} color="#FFF" />
            <Text style={styles.memberText}>Membre depuis {getMemberSince()}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Menu */}
      <View style={styles.menuContainer}>
        {menuSections.map((section, idx) => (
          <View key={idx} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>{section.title}</Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {section.items.map((item, i) => (
                <View key={item.id}>
                  <MenuItemComponent item={item as MenuItem} />
                  {i < section.items.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                </View>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <View style={[styles.logoutContent, { backgroundColor: colors.danger + '50' }]}>
            <Ionicons name="log-out-outline" size={18} color={colors.danger} />
            <Text style={[styles.logoutText, { color: colors.danger }]}>Déconnexion</Text>
          </View>
        </TouchableOpacity>

        <Text style={[styles.version, { color: colors.textTertiary }]}>SmartQueue Agent v1.0.0</Text>
      </View>
      {AlertComponent}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: Platform.OS === 'ios' ? 50 : 30, paddingBottom: 24, paddingHorizontal: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerContent: { alignItems: 'center' },
  roleBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, gap: 4, marginBottom: 12 },
  roleBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  avatarWrapper: { position: 'relative', marginBottom: 12 },
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
  avatarText: { fontSize: 32, fontWeight: '800' },
  cameraBtn: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  userName: { fontSize: 22, fontWeight: '800', color: '#FFF', marginBottom: 4 },
  userEmail: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 10 },
  memberBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, gap: 5 },
  memberText: { fontSize: 11, fontWeight: '600', color: '#FFF' },
  menuContainer: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 100 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginLeft: 4 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16 },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconContainer: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  menuItemText: { flex: 1 },
  menuItemTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  menuItemSubtitle: { fontSize: 12 },
  roleBadgeII: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  roleText: { fontSize: 11, fontWeight: '700' },
  divider: { height: 0.5, marginLeft: 62 },
  logoutBtn: { marginTop: 8 },
  logoutContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, gap: 8 },
  logoutText: { fontSize: 14, fontWeight: '600' },
  version: { textAlign: 'center', fontSize: 11, marginTop: 20 },
});