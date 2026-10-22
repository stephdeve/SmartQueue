import Constants from 'expo-constants';

/**
 * Coordonnées et liens légaux, fournis au build (EAS) par des variables
 * EXPO_PUBLIC_*. Laissés vides, les écrans n'affichent pas les entrées
 * correspondantes (plutôt qu'un numéro ou un lien fictif).
 *
 * La politique de confidentialité est exigée par l'App Store et le Play Store.
 */
const clean = (value?: string) => (value ?? '').trim();

export const appInfo = {
  version: Constants.expoConfig?.version ?? '',
  supportEmail: clean(process.env.EXPO_PUBLIC_SUPPORT_EMAIL),
  supportPhone: clean(process.env.EXPO_PUBLIC_SUPPORT_PHONE),
  privacyUrl: clean(process.env.EXPO_PUBLIC_PRIVACY_URL),
  termsUrl: clean(process.env.EXPO_PUBLIC_TERMS_URL),
};
