import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../theme';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useSettings } from '../../store/settingsStore';
import { useCustomAlert } from '../../hooks/useCustomAlert';

export const NotificationPrefsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const colors = useThemeColors();
  const {
    pushNotificationsEnabled,
    smsNotificationsEnabled,
    positionUpdatesEnabled,
    promotionsEnabled,
    updatePreferences,
    updateNotificationPreferences,
  } = useSettings();
  const { AlertComponent, showError } = useCustomAlert();
  
  // Valeurs issues du store persisté (push/SMS synchronisés avec le serveur) :
  // des useState locaux se réinitialisaient à chaque ouverture de l'écran
  const smsEnabled = smsNotificationsEnabled;
  const ticketUpdates = positionUpdatesEnabled;
  const promotions = promotionsEnabled;
  const setSmsEnabled = (value: boolean) =>
    updatePreferences({ sms_notifications_enabled: value }).catch(() =>
      showError('Erreur', 'Impossible de mettre à jour les préférences.'),
    );
  const setTicketUpdates = (value: boolean) =>
    updateNotificationPreferences({ position_updates: value }).catch(() => {});
  const setPromotions = (value: boolean) =>
    updateNotificationPreferences({ promotions: value }).catch(() => {});
  const [isLoading, setIsLoading] = useState(false);

  const handleTogglePush = async (value: boolean) => {
    try {
      await updatePreferences({ push_notifications_enabled: value });
    } catch (error) {
      showError('Erreur', 'Impossible de mettre à jour les préférences.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header compact */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Notifications</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Canaux de notification */}
        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>Canaux</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.row, { borderBottomColor: colors.border }]}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBadge, { backgroundColor: colors.primary + "15" }]}>
                <Ionicons name="notifications-outline" size={18} color={colors.primary} />
              </View>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>Notifications Push</Text>
            </View>
            <Switch
              value={pushNotificationsEnabled}
              onValueChange={handleTogglePush}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBadge, { backgroundColor: colors.success + "15" }]}>
                <Ionicons name="chatbubble-outline" size={18} color={colors.success} />
              </View>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>Alertes SMS</Text>
            </View>
            <Switch
              value={smsEnabled}
              onValueChange={setSmsEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Types de notification */}
        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>Types</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.row, { borderBottomColor: colors.border }]}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBadge, { backgroundColor: colors.warning + "15" }]}>
                <Ionicons name="ticket-outline" size={18} color={colors.warning} />
              </View>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>Mises à jour des tickets</Text>
            </View>
            <Switch
              value={ticketUpdates}
              onValueChange={setTicketUpdates}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBadge, { backgroundColor: colors.secondary + "15" }]}>
                <Ionicons name="megaphone-outline" size={18} color={colors.secondary} />
              </View>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>Offres et promotions</Text>
            </View>
            <Switch
              value={promotions}
              onValueChange={setPromotions}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Message d'information compact */}
        <View style={[styles.infoBox, { backgroundColor: colors.primary + "08" }]}>
          <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
          <Text style={[styles.hintText, { color: colors.textSecondary }]}>
            Activez les notifications pour ne pas manquer votre tour
          </Text>
        </View>

        {AlertComponent}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
  },
  backButton: { padding: 6, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  content: { padding: 16, paddingBottom: 30 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 0.5,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBadge: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 14, fontWeight: '500' },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  hintText: { fontSize: 12, textAlign: 'center', flex: 1 },
});

export default NotificationPrefsScreen;