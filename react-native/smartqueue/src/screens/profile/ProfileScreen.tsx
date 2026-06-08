import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Platform,
  Switch,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../store/authStore';
import { useSettings } from '../../store/settingsStore';
import { useAlertPreferencesStore } from '../../store/alertPreferencesStore';
import { MARGIN_OPTIONS, TRANSPORT_MODE_OPTIONS, MarginOption } from '../../types/alertPreferences';
import { TabParamList } from '../../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCustomAlert } from '../../hooks/useCustomAlert';
import { useTheme } from '../../hooks/useTheme';
import { CustomActionSheet, Option } from '../../components/ui/CustomActionSheet';

const { width } = Dimensions.get('window');

type ProfileNavigationProp = NativeStackNavigationProp<TabParamList, 'Profile'>;

// Composant Menu Item compact
const MenuItemCompact: React.FC<{
  item: any;
  colors: any;
  onPress: () => void;
  onToggle?: (value: boolean) => void;
  toggleValue?: boolean;
  destructive?: boolean;
}> = ({ item, colors, onPress, onToggle, toggleValue, destructive }) => (
  <TouchableOpacity
    style={styles.menuItem}
    onPress={onPress}
    disabled={item.toggle}
    activeOpacity={0.7}
  >
    <View style={styles.menuItemLeft}>
      <View style={[styles.iconContainer, { backgroundColor: item.iconBg + '15' }]}>
        <Ionicons name={item.icon} size={20} color={item.iconBg} />
      </View>
      <View style={styles.menuItemText}>
        <Text style={[styles.menuItemTitle, { color: colors.textPrimary }, destructive && { color: colors.danger }]}>
          {item.title}
        </Text>
        {item.subtitle && (
          <Text style={[styles.menuItemSubtitle, { color: colors.textTertiary }]} numberOfLines={1}>
            {item.subtitle}
          </Text>
        )}
      </View>
    </View>
    
    {item.toggle ? (
      <Switch
        value={toggleValue}
        onValueChange={onToggle}
        trackColor={{ false: colors.borderSecondary, true: colors.primary + '80' }}
        thumbColor={toggleValue ? colors.primary : colors.textTertiary}
      />
    ) : (
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    )}
  </TouchableOpacity>
);

// Composant Header du profil
const ProfileHeader: React.FC<{
  user: any;
  memberSince: string;
  colors: any;
  isDarkMode: boolean;
}> = ({ user, memberSince, colors, isDarkMode }) => {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <LinearGradient
      colors={isDarkMode ? ['#1E1E2E', '#2D2D44', '#1E3A5F'] : ['#3B82F6', '#2563EB', '#1D4ED8']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.headerGradient}
    >
      <Animated.View style={[styles.headerContent, { transform: [{ scale: scaleAnim }], opacity: fadeAnim }]}>
        <View style={styles.avatarWrapper}>
          <View style={[styles.avatarContainer, { backgroundColor: colors.surface }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {(user?.name || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <TouchableOpacity style={[styles.cameraButton, { backgroundColor: colors.primary }]}>
            <Ionicons name="camera" size={12} color="#FFF" />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.userName}>{user?.name || 'Utilisateur'}</Text>
        <Text style={styles.userEmail}>{user?.email || 'utilisateur@exemple.com'}</Text>
        
        <View style={styles.memberBadge}>
          <Ionicons name="shield-checkmark" size={12} color="#FFF" />
          <Text style={styles.memberText}>Membre depuis {memberSince}</Text>
        </View>
      </Animated.View>
    </LinearGradient>
  );
};

// Composant Section de menu
const MenuSection: React.FC<{
  title: string;
  items: any[];
  colors: any;
  onItemPress: (item: any) => void;
  onToggle: (item: any, value: boolean) => void;
}> = ({ title, items, colors, onItemPress, onToggle }) => (
  <View style={styles.section}>
    <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>{title}</Text>
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {items.map((item, idx) => (
        <View key={item.id}>
          <MenuItemCompact
            item={item}
            colors={colors}
            onPress={() => onItemPress(item)}
            onToggle={(value) => onToggle(item, value)}
            toggleValue={item.toggleValue}
            destructive={item.destructive}
          />
          {idx < items.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
        </View>
      ))}
    </View>
  </View>
);

// Composant principal
export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<ProfileNavigationProp>();
  const { user, logout } = useAuth();
  const { 
    isDarkMode, 
    setDarkMode,
    preferences,
    updatePreferences,
    loadPreferences 
  } = useSettings();
  const { colors } = useTheme();
  const {
    channels,
    marginMinutes,
    marginOption,
    enableSafetyAlert,
    phoneNumber,
    preferredTransportMode,
    setChannels,
    setMarginMinutes,
    setEnableSafetyAlert,
    setPhoneNumber,
    setPreferredTransportMode,
    loadPreferences: loadAlertPreferences,
  } = useAlertPreferencesStore();
  const { AlertComponent, showWarning } = useCustomAlert();
  
  const [alertChannelsVisible, setAlertChannelsVisible] = useState(false);
  const [alertTimingVisible, setAlertTimingVisible] = useState(false);
  const [transportModeVisible, setTransportModeVisible] = useState(false);

  const alertChannelOptions: Option[] = [
    { label: 'Notifications push', value: 'push', icon: 'notifications-outline' },
    { label: 'SMS', value: 'sms', icon: 'chatbubble-outline' },
    { label: 'Push + SMS', value: 'push_sms', icon: 'notifications-circle-outline' },
  ];

  const alertTimingOptions: Option[] = MARGIN_OPTIONS.map(opt => ({
    label: opt.label,
    value: opt.value === 'custom' ? marginMinutes : (opt.value as number),
  }));

  const transportModeOptions: Option[] = TRANSPORT_MODE_OPTIONS.map(opt => ({
    label: opt.label,
    value: opt.value,
    icon: opt.value === 'walking' ? 'walk-outline' : opt.value === 'motorcycle' ? 'bicycle-outline' : 'car-outline',
  }));

  useEffect(() => {
    loadPreferences();
    loadAlertPreferences();
  }, [loadPreferences, loadAlertPreferences]);

  const pushNotificationsEnabled = preferences.push_notifications_enabled;

  const handleSelectAlertChannel = (value: string | number) => {
    if (value === 'push') setChannels(['push']);
    else if (value === 'sms') setChannels(['sms']);
    else if (value === 'push_sms') setChannels(['push', 'sms']);
  };

  const handleSelectAlertTiming = (value: string | number) => {
    const predefinedOptions: MarginOption[] = [5, 10, 15, 20];
    const numericValue = value as number;
    const isPredefined = predefinedOptions.includes(numericValue as MarginOption);
    setMarginMinutes(numericValue, isPredefined ? (numericValue as MarginOption) : 'custom');
  };

  const handleSelectTransportMode = (value: string | number) => {
    setPreferredTransportMode(value as 'walking' | 'motorcycle' | 'car');
  };

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

  const getMemberSince = useCallback(() => {
    if (!user?.created_at) return 'Récemment';
    try {
      const date = new Date(user.created_at);
      return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    } catch {
      return 'Récemment';
    }
  }, [user?.created_at]);

  // Configuration des menus
  const menuSections = [
    {
      title: 'STATISTIQUES',
      items: [
        { id: 'dashboard', title: 'Tableau de bord', subtitle: 'Stats, badges et niveaux', icon: 'trophy-outline', iconBg: colors.warning, onPress: () => router.push('/dashboard') },
      ],
    },
    {
      title: 'COMPTE',
      items: [
        { id: 'personalInfo', title: 'Informations personnelles', subtitle: 'Nom, email, téléphone', icon: 'person-outline', iconBg: colors.primary, onPress: () => router.push('/personal-info') },
      ],
    },
    {
      title: 'ALERTES',
      items: [
        { id: 'alertChannels', title: 'Canaux d’alerte', subtitle: channels.includes('sms') ? 'Push + SMS' : 'Push uniquement', icon: 'notifications-outline', iconBg: colors.warning, onPress: () => setAlertChannelsVisible(true) },
        { id: 'alertMargin', title: 'Timing des alertes', subtitle: `${marginMinutes} min avant le tour`, icon: 'time-outline', iconBg: colors.primary, onPress: () => setAlertTimingVisible(true) },
        { id: 'transportMode', title: 'Mode de transport', subtitle: TRANSPORT_MODE_OPTIONS.find(o => o.value === preferredTransportMode)?.label || 'Voiture', icon: 'car-outline', iconBg: colors.secondary, onPress: () => setTransportModeVisible(true) },
        { id: 'safetyAlert', title: 'Alerte de sécurité', subtitle: enableSafetyAlert ? '2e alerte 2 min avant' : 'Désactivé', icon: 'shield-checkmark-outline', iconBg: colors.success, onPress: () => {}, toggle: true, toggleValue: enableSafetyAlert, onToggle: setEnableSafetyAlert },
      ],
    },
    {
      title: 'APPLICATION',
      items: [
        { id: 'notifications', title: 'Notifications', icon: 'notifications-outline', iconBg: colors.warning, toggle: true, toggleValue: pushNotificationsEnabled, onToggle: (value: boolean) => updatePreferences({ push_notifications_enabled: value }) },
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

  const handleItemPress = (item: any) => {
    if (item.onPress && !item.toggle) item.onPress();
  };

  const handleToggle = (item: any, value: boolean) => {
    if (item.onToggle) item.onToggle(value);
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]} 
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      <ProfileHeader user={user} memberSince={getMemberSince()} colors={colors} isDarkMode={isDarkMode} />

      <View style={styles.menuContainer}>
        {menuSections.map((section, idx) => (
          <MenuSection
            key={idx}
            title={section.title}
            items={section.items}
            colors={colors}
            onItemPress={handleItemPress}
            onToggle={handleToggle}
          />
        ))}

        {/* Bouton déconnexion */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
          <View style={[styles.logoutContent, { backgroundColor: colors.danger + '10' }]}>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={[styles.logoutText, { color: colors.danger }]}>Se déconnecter</Text>
          </View>
        </TouchableOpacity>

        <Text style={[styles.versionText, { color: colors.textTertiary }]}>
          SmartQueue v1.0.0
        </Text>
      </View>

      {/* Action Sheets */}
      <CustomActionSheet
        visible={alertChannelsVisible}
        title="Canaux d’alerte"
        message="Choisissez comment recevoir les alertes"
        options={alertChannelOptions}
        selectedValue={channels.includes('sms') ? (channels.includes('push') ? 'push_sms' : 'sms') : 'push'}
        onSelect={handleSelectAlertChannel}
        onClose={() => setAlertChannelsVisible(false)}
        type="warning"
      />

      <CustomActionSheet
        visible={alertTimingVisible}
        title="Timing des alertes"
        message="Quand être alerté avant votre tour"
        options={alertTimingOptions}
        selectedValue={marginMinutes}
        onSelect={handleSelectAlertTiming}
        onClose={() => setAlertTimingVisible(false)}
        type="info"
      />

      <CustomActionSheet
        visible={transportModeVisible}
        title="Mode de transport"
        message="Pour le calcul du temps de trajet"
        options={transportModeOptions}
        selectedValue={preferredTransportMode}
        onSelect={handleSelectTransportMode}
        onClose={() => setTransportModeVisible(false)}
        type="info"
      />

      {AlertComponent}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 32,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerContent: {
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '800',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  userName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 12,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  memberText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFF',
  },
  menuContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuItemText: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 12,
  },
  divider: {
    height: 1,
    marginLeft: 54,
  },
  logoutButton: {
    marginTop: 8,
    marginBottom: 16,
  },
  logoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 11,
    marginTop: 8,
  },
});

export default ProfileScreen;