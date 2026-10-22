import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Linking,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useThemeColors } from '../../hooks/useThemeColors';
import { appInfo } from '../../config/appInfo';

interface FAQItem {
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    question: 'Comment rejoindre une file d\'attente ?',
    answer: 'Scannez le QR code affiché dans l\'établissement depuis l\'onglet Scanner, ou choisissez l\'établissement et le service dans l\'onglet Explorer puis prenez un ticket.'
  },
  {
    question: 'Puis-je annuler mon ticket ?',
    answer: 'Oui, vous pouvez annuler votre ticket à tout moment avant d\'être appelé. Allez dans l\'onglet Tickets, sélectionnez votre ticket actif et appuyez sur "Annuler le ticket".'
  },
  {
    question: 'Comment fonctionnent les notifications ?',
    answer: 'SmartQueue vous envoie des notifications push lorsque vous êtes appelé, ou quand il reste peu de personnes avant vous.'
  },
  {
    question: 'Que se passe-t-il si je manque mon tour ?',
    answer: 'Si vous ne vous présentez pas après l\'appel, votre ticket est marqué « absent ». L\'agent peut vous rappeler un nombre limité de fois, fixé par le service ; au-delà, le ticket expire et il faut en reprendre un.'
  },
  {
    question: 'Comment fonctionne le calcul du temps d\'attente ?',
    answer: 'Le temps d\'attente estimé est calculé en fonction du nombre de personnes devant vous et du temps moyen de service.'
  },
  {
    question: 'Puis-je réserver à l\'avance ?',
    answer: 'Actuellement, SmartQueue ne propose pas de réservation à l\'avance. Vous rejoignez la file en temps réel.'
  }
];

const FAQAccordion: React.FC<{ item: FAQItem; isOpen: boolean; onPress: () => void; colors: any }> = ({ 
  item, 
  isOpen, 
  onPress,
  colors 
}) => {
  const [animation] = useState(new Animated.Value(0));
  
  React.useEffect(() => {
    Animated.timing(animation, {
      toValue: isOpen ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [isOpen]);

  const heightInterpolate = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 80],
  });

  return (
    <View style={[styles.faqContainer, { borderBottomColor: colors.border }]}>
      <TouchableOpacity 
        style={[styles.faqHeader, isOpen && { backgroundColor: colors.primary + "05" }]} 
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Text style={[styles.faqQuestion, { color: colors.textPrimary }, isOpen && { color: colors.primary }]}>
          {item.question}
        </Text>
        <Animated.View style={{
          transform: [{
            rotate: animation.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', '180deg'],
            })
          }]
        }}>
          <Ionicons name="chevron-down" size={18} color={isOpen ? colors.primary : colors.textTertiary} />
        </Animated.View>
      </TouchableOpacity>
      <Animated.View style={[styles.faqAnswerContainer, { height: heightInterpolate }]}>
        <Text style={[styles.faqAnswer, { color: colors.textSecondary }]} numberOfLines={3}>{item.answer}</Text>
      </Animated.View>
    </View>
  );
};

export const HelpSupportScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const isDark = !!colors.dark?.background;
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

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
          <Text style={styles.headerTitle}>Aide & Support</Text>
          <View style={styles.iconButton} />
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Contact Section compact */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>Contact</Text>
          {!appInfo.supportEmail && !appInfo.supportPhone ? (
            <Text style={[styles.contactLabel, { color: colors.textSecondary }]}>
              Pour une question sur votre ticket, adressez-vous à l’accueil de l’établissement.
            </Text>
          ) : (
          <View style={styles.contactRow}>
            {!!appInfo.supportEmail && (
            <TouchableOpacity 
              style={[styles.contactItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => Linking.openURL(`mailto:${appInfo.supportEmail}`)}
              activeOpacity={0.7}
            >
              <View style={[styles.contactIcon, { backgroundColor: colors.primary + "15" }]}>
                <Ionicons name="mail-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.contactInfo}>
                <Text style={[styles.contactLabel, { color: colors.textTertiary }]}>Email</Text>
                <Text style={[styles.contactValue, { color: colors.textPrimary }]}>{appInfo.supportEmail}</Text>
              </View>
            </TouchableOpacity>
            )}

            {!!appInfo.supportPhone && (
            <TouchableOpacity 
              style={[styles.contactItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => Linking.openURL(`tel:${appInfo.supportPhone.replace(/\s/g, '')}`)}
              activeOpacity={0.7}
            >
              <View style={[styles.contactIcon, { backgroundColor: colors.success + "15" }]}>
                <Ionicons name="call-outline" size={18} color={colors.success} />
              </View>
              <View style={styles.contactInfo}>
                <Text style={[styles.contactLabel, { color: colors.textTertiary }]}>Téléphone</Text>
                <Text style={[styles.contactValue, { color: colors.textPrimary }]}>{appInfo.supportPhone}</Text>
              </View>
            </TouchableOpacity>
            )}
          </View>
          )}
        </View>

        {/* FAQ Section compact */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>Questions fréquentes</Text>
          <View style={[styles.faqCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {faqData.map((item, index) => (
              <FAQAccordion
                key={index}
                item={item}
                isOpen={openFAQ === index}
                onPress={() => toggleFAQ(index)}
                colors={colors}
              />
            ))}
          </View>
        </View>

        {/* Support Hours compact */}
        <View style={[styles.infoBox, { backgroundColor: colors.primary + "05", borderColor: colors.primary + "15" }]}>
          <View style={[styles.infoIcon, { backgroundColor: colors.primary + "15" }]}>
            <Ionicons name="time-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.infoContent}>
            <Text style={[styles.infoTitle, { color: colors.primary }]}>Horaires support</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>Lun-Ven 9h-18h | Sam 10h-14h</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 20,
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
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 30 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginLeft: 4 },
  
  contactRow: { flexDirection: 'row', gap: 10 },
  contactItem: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, borderWidth: 1, gap: 10 },
  contactIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  contactInfo: { flex: 1 },
  contactLabel: { fontSize: 10, fontWeight: '600', marginBottom: 2 },
  contactValue: { fontSize: 12, fontWeight: '500' },
  
  faqCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  faqContainer: { borderBottomWidth: 0.5 },
  faqHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 14 },
  faqQuestion: { flex: 1, fontSize: 14, fontWeight: '600', marginRight: 10 },
  faqAnswerContainer: { overflow: 'hidden' },
  faqAnswer: { fontSize: 13, lineHeight: 18, paddingHorizontal: 14, paddingBottom: 14 },
  
  infoBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 12, borderWidth: 1, gap: 10 },
  infoIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  infoContent: { flex: 1 },
  infoTitle: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  infoText: { fontSize: 12 },
});

export default HelpSupportScreen;