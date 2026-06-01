import { Tabs, Redirect } from "expo-router";
import { View, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import "../../global.css";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { useAuth } from "../../src/store/authStore";
// eslint-disable-next-line import/no-named-as-default
import GlobalCalledTicketOverlay from "../../src/components/GlobalCalledTicketOverlay";
import { useTicket, useTicketStore } from "../../src/store/ticketStore";
import { useCustomAlert } from "../../src/hooks/useCustomAlert";
import { useTicketSocket } from "../../src/hooks/useTicketSocket";

export default function TabLayout() {
  const colors = useThemeColors();
  const isDark = !!colors.dark?.background;
  const { user, isAuthenticated } = useAuth();
  const { AlertComponent, showSuccess, showError, showWarning } = useCustomAlert();

  const {
    activeTicket,
    isInitialized,
  } = useTicket();

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
                    size={22}
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
                    size={22}
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
                    size={22}
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
                    size={22}
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
                    size={22}
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
