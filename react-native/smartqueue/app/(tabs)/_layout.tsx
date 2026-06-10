import { Tabs, Redirect } from "expo-router";
import { View, Platform, Modal, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import "../../global.css";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { useAuth } from "../../src/store/authStore";
// eslint-disable-next-line import/no-named-as-default
import GlobalCalledTicketOverlay from "../../src/components/GlobalCalledTicketOverlay";
import { useTicket, useTicketStore } from "../../src/store/ticketStore";
import { useCustomAlert } from "../../src/hooks/useCustomAlert";
import { useTicketSocket } from "../../src/hooks/useTicketSocket";
import { ticketsApi } from "../../src/api/ticketsApi";
import * as Haptics from "expo-haptics";

export default function TabLayout() {
  const colors = useThemeColors();
  const isDark = !!colors.dark?.background;
  const { user, isAuthenticated } = useAuth();
  const { AlertComponent, showSuccess, showError, showWarning } = useCustomAlert();

  const {
    activeTicket,
    isInitialized,
    pendingReviewTicket,
    setPendingReviewTicket,
  } = useTicket();

  // État local de la modal d'évaluation
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Réinitialise les champs quand une nouvelle review est demandée
  useEffect(() => {
    if (pendingReviewTicket) {
      setReviewRating(0);
      setReviewComment("");
    }
  }, [pendingReviewTicket]);

  const handleReviewSubmit = async () => {
    if (!pendingReviewTicket || reviewRating === 0) return;
    setReviewSubmitting(true);
    try {
      await ticketsApi.submitReview(
        pendingReviewTicket.id,
        reviewRating,
        reviewComment.trim() || undefined,
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // ignore — doublon ou problème réseau
    } finally {
      setReviewSubmitting(false);
      setPendingReviewTicket(null);
    }
  };

  // Charger le ticket actif dès que l'utilisateur est authentifié et que le
  // store n'est pas encore initialisé. Cela garantit que le socket se connecte
  // avec le bon ticketId dès le premier rendu des tabs.
  useEffect(() => {
    if (isAuthenticated && !isInitialized) {
      useTicketStore.getState().fetchActiveTicket().catch((err) =>
        console.warn('[TabLayout] fetchActiveTicket error:', err?.message),
      );
    }
  }, [isAuthenticated, isInitialized]);

  // Connect WebSocket at tab level so called events work on ALL screens.
  // ticketId est null tant que fetchActiveTicket n'a pas répondu — le hook
  // attend et se connecte dès qu'un ticket actif est disponible.
  useTicketSocket(activeTicket?.id?.toString() || null);

  // Redirect agents to their space
  if (user?.role === "agent" || user?.role === "admin") {
    return <Redirect href="/agent" />;
  }

  return (
    <>
      <View style={{ flex: 1 }}>
        <GlobalCalledTicketOverlay
          showSuccess={showSuccess}
          showError={showError}
          showWarning={showWarning}
        />
        {AlertComponent}

        {/* Modal d'évaluation post-service — apparaît quelle que soit la tab active */}
        <Modal
          visible={!!pendingReviewTicket}
          transparent
          animationType="slide"
          statusBarTranslucent
        >
          <KeyboardAvoidingView
            style={reviewStyles.overlay}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={[reviewStyles.card, { backgroundColor: colors.surface }]}>
              <View style={reviewStyles.handle} />

              <Ionicons name="star" size={40} color="#F59E0B" style={{ alignSelf: "center", marginBottom: 8 }} />
              <Text style={[reviewStyles.title, { color: colors.textPrimary }]}>
                Comment s'est passé votre visite ?
              </Text>
              <Text style={[reviewStyles.subtitle, { color: colors.textSecondary }]}>
                {pendingReviewTicket?.serviceName ?? ""}
              </Text>

              <View style={reviewStyles.stars}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <TouchableOpacity key={s} onPress={() => setReviewRating(s)} activeOpacity={0.7}>
                    <Ionicons
                      name={s <= reviewRating ? "star" : "star-outline"}
                      size={44}
                      color={s <= reviewRating ? "#F59E0B" : colors.textTertiary}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[reviewStyles.input, {
                  backgroundColor: colors.surfaceSecondary,
                  color: colors.textPrimary,
                  borderColor: colors.border,
                }]}
                placeholder="Ajouter un commentaire (facultatif)"
                placeholderTextColor={colors.textTertiary}
                value={reviewComment}
                onChangeText={setReviewComment}
                multiline
                maxLength={500}
              />

              <TouchableOpacity
                style={[
                  reviewStyles.submitBtn,
                  { backgroundColor: reviewRating > 0 ? "#F59E0B" : colors.border },
                  reviewSubmitting && { opacity: 0.7 },
                ]}
                onPress={handleReviewSubmit}
                disabled={reviewRating === 0 || reviewSubmitting}
                activeOpacity={0.8}
              >
                <Text style={[reviewStyles.submitText, { color: reviewRating > 0 ? "#FFF" : colors.textTertiary }]}>
                  {reviewSubmitting ? "Envoi…" : "Envoyer l'évaluation"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={reviewStyles.skipBtn}
                onPress={() => setPendingReviewTicket(null)}
                activeOpacity={0.7}
              >
                <Text style={[reviewStyles.skipText, { color: colors.textTertiary }]}>Passer</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textSecondary,
            headerShown: false,
            tabBarShowLabel: false,
            tabBarStyle: {
              position: "absolute",
              bottom: Platform.OS === "ios" ? 30 : 20,
              marginHorizontal: 20,
              height: 60,
              borderRadius: 30,
              backgroundColor: colors.surface,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 15 },
              shadowOpacity: isDark ? 0.4 : 0.15,
              shadowRadius: 25,
              elevation: 15,
              paddingHorizontal: 30,
              justifyContent: "space-between",
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
            },
            tabBarItemStyle: {
              height: 50,
              width: 44,
              justifyContent: "center",
              alignItems: "center",
              padding: 10,
            },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              tabBarIcon: ({ color, focused }) => (
                <View
                  style={{
                    alignItems: "center",
                    justifyContent: "center",
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: focused ? colors.primary : "transparent",
                    transform: [{ scale: focused ? 1.1 : 1 }],
                  }}
                >
                  <Ionicons
                    name="map-outline"
                    size={20}
                    color={focused ? "#FFFFFF" : color}
                  />
                </View>
              ),
            }}
          />

          <Tabs.Screen
            name="scan"
            options={{
              tabBarIcon: ({ color, focused }) => (
                <View
                  style={{
                    alignItems: "center",
                    justifyContent: "center",
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: focused ? colors.primary : "transparent",
                    transform: [{ scale: focused ? 1.1 : 1 }],
                  }}
                >
                  <Ionicons
                    name="qr-code-outline"
                    size={20}
                    color={focused ? "#FFFFFF" : color}
                  />
                </View>
              ),
            }}
          />

          <Tabs.Screen
            name="tickets"
            options={{
              tabBarIcon: ({ color, focused }) => (
                <View
                  style={{
                    alignItems: "center",
                    justifyContent: "center",
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: focused ? colors.primary : "transparent",
                    transform: [{ scale: focused ? 1.1 : 1 }],
                  }}
                >
                  <Ionicons
                    name="ticket-outline"
                    size={20}
                    color={focused ? "#FFFFFF" : color}
                  />
                </View>
              ),
            }}
          />

          <Tabs.Screen
            name="history"
            options={{
              tabBarIcon: ({ color, focused }) => (
                <View
                  style={{
                    alignItems: "center",
                    justifyContent: "center",
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: focused ? colors.primary : "transparent",
                    transform: [{ scale: focused ? 1.1 : 1 }],
                  }}
                >
                  <Ionicons
                    name="time-outline"
                    size={20}
                    color={focused ? "#FFFFFF" : color}
                  />
                </View>
              ),
            }}
          />

          <Tabs.Screen
            name="profile"
            options={{
              tabBarIcon: ({ color, focused }) => (
                <View
                  style={{
                    alignItems: "center",
                    justifyContent: "center",
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: focused ? colors.primary : "transparent",
                    transform: [{ scale: focused ? 1.1 : 1 }],
                  }}
                >
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color={focused ? "#FFFFFF" : color}
                  />
                </View>
              ),
            }}
          />

          <Tabs.Screen
            name="live-ticket"
            options={{
              href: null,
            }}
          />
        </Tabs>
      </View>
    </>
  );
}

const reviewStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  card: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: Platform.OS === "ios" ? 44 : 28,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CCC",
    alignSelf: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
  },
  stars: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  submitBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  submitText: {
    fontSize: 16,
    fontWeight: "700",
  },
  skipBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 14,
  },
});
