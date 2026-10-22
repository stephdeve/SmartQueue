import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useThemeColors } from '../../hooks/useThemeColors';
import { appInfo } from '../../config/appInfo';

const FeatureItem: React.FC<{ icon: any; title: string; description: string; colors: any }> = ({ icon, title, description, colors }) => (
  <View style={[styles.featureItem, { borderBottomColor: colors.border }]}>
    <View style={[styles.featureIcon, { backgroundColor: colors.primary + '15' }]}>
      <Ionicons name={icon} size={20} color={colors.primary} />
    </View>
    <View style={styles.featureContent}>
      <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.featureDescription, { color: colors.textSecondary }]}>{description}</Text>
    </View>
  </View>
);

export const AboutAppScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const isDark = !!colors.dark?.background;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header compact */}
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton} activeOpacity={0.8}>
            <View style={[styles.iconButtonBg, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name="arrow-back" size={22} color="#FFF" />
            </View>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>À propos</Text>
          <View style={styles.iconButton} />
        </View>

        {/* App Logo Section compact */}
        <View style={styles.logoSection}>
          <View style={[styles.logoContainer, { backgroundColor: colors.surface }]}>
            <Ionicons name="ticket" size={36} color={colors.primary} />
          </View>
          <Text style={styles.appName}>SmartQueue</Text>
          {!!appInfo.version && <Text style={styles.version}>Version {appInfo.version}</Text>}
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Description compact */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>Notre mission</Text>
          <Text style={[styles.description, { color: colors.textSecondary, backgroundColor: colors.surface, borderColor: colors.border }]}>
            SmartQueue révolutionne la gestion des files d’attente en permettant aux clients de rejoindre une file virtuellement, sans attendre physiquement.
          </Text>
        </View>

        {/* Features compact */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>Fonctionnalités</Text>
          <View style={[styles.featuresCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <FeatureItem icon="qr-code-outline" title="Scan QR" description="Rejoignez une file en scannant un QR code" colors={colors} />
            <FeatureItem icon="time-outline" title="Temps réel" description="Suivez votre position et l'attente estimée" colors={colors} />
            <FeatureItem icon="notifications-outline" title="Notifications" description="Alertes quand c'est votre tour" colors={colors} />
            <FeatureItem icon="map-outline" title="Carte interactive" description="Trouvez les établissements proches" colors={colors} />
          </View>
        </View>

        {/* Legal Links compact */}
        {(!!appInfo.termsUrl || !!appInfo.privacyUrl) && (
        <View style={[styles.linksCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {!!appInfo.termsUrl && (
          <TouchableOpacity style={styles.linkItem} onPress={() => Linking.openURL(appInfo.termsUrl)}>
            <Ionicons name="document-text-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.linkText, { color: colors.textPrimary }]}>Conditions d’utilisation</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
          )}
          {!!appInfo.termsUrl && !!appInfo.privacyUrl && <View style={[styles.linkDivider, { backgroundColor: colors.border }]} />}
          {!!appInfo.privacyUrl && (
          <TouchableOpacity style={styles.linkItem} onPress={() => Linking.openURL(appInfo.privacyUrl)}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.linkText, { color: colors.textPrimary }]}>Politique de confidentialité</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
          )}
        </View>
        )}

        {/* Copyright compact */}
        <Text style={[styles.copyright, { color: colors.textTertiary }]}>
          © {new Date().getFullYear()} SmartQueue
        </Text>
        <Text style={[styles.copyrightSub, { color: colors.textTertiary }]}>
          Conçu avec ❤️ au Bénin
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: { width: 36, height: 36 },
  iconButtonBg: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  logoSection: { alignItems: 'center', marginTop: 16 },
  logoContainer: { width: 72, height: 72, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  appName: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  version: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 30 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginLeft: 4 },
  description: { fontSize: 14, lineHeight: 20, borderRadius: 16, padding: 14, borderWidth: 1 },
  featuresCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  featureItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 0.5 },
  featureIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  featureContent: { flex: 1 },
  featureTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  featureDescription: { fontSize: 12 },
  linksCard: { borderRadius: 16, borderWidth: 1, marginBottom: 20, overflow: 'hidden' },
  linkItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  linkDivider: { height: 0.5, marginLeft: 48 },
  linkText: { flex: 1, fontSize: 14, fontWeight: '500' },
  copyright: { fontSize: 12, textAlign: 'center', marginTop: 8 },
  copyrightSub: { fontSize: 11, textAlign: 'center', marginTop: 4 },
});

export default AboutAppScreen;