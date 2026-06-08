import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  TextInput,
  Platform,
  StatusBar,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { useCustomAlert } from "../../src/hooks/useCustomAlert";
import axiosClient from "../../src/api/axiosClient";
import { useFocusEffect } from "@react-navigation/native";
import Echo from "laravel-echo";
import Pusher from "pusher-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

(window as any).Pusher = Pusher;

// ─── Types ────────────────────────────────────────────────────────────────────

type Ticket = {
  id: number;
  number: string;
  status: string;
  position?: number | null;
  priority: string;
  created_at: string;
  called_at?: string;
  en_route_at?: string | null;
  present_at?: string | null;
  response_received_at?: string | null;
  en_route_expires_at?: string | null;
  estimated_travel_minutes?: number | null;
};

type ServiceStats = {
  waiting: number;
  processed: number;
  avg_wait_time: number;
};

type ThemeColors = ReturnType<typeof useThemeColors>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const mins = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
    if (mins < 1) return "À l'instant";
    if (mins < 60) return `il y a ${mins}min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `il y a ${h}h${m}min` : `il y a ${h}h`;
  } catch {
    return "--";
  }
}

function fmtTime(dateStr?: string | null): string {
  if (!dateStr) return "--";
  try {
    return new Date(dateStr).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "--";
  }
}

// ─── Config maps ──────────────────────────────────────────────────────────────

const PRIORITY_CFG: Record<string, { color: string; label: string }> = {
  vip: { color: "#8B5CF6", label: "VIP" },
  high: { color: "#FF9500", label: "PRIO" },
  normal: { color: "#8E8E93", label: "STD" },
};

const STATUS_CFG: Record<string, { color: string; label: string }> = {
  waiting: { color: "#007AFF", label: "Attente" },
  called: { color: "#34C759", label: "Appelé" },
  absent: { color: "#FF3B30", label: "Absent" },
  en_route: { color: "#FF9500", label: "En route" },
  present: { color: "#34C759", label: "Présent" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiPill({
  icon,
  label,
  value,
  accent,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  accent: string;
  colors: ThemeColors;
}) {
  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        borderRadius: 10,
        paddingHorizontal: 9,
        paddingVertical: 8,
        gap: 7,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 7,
          backgroundColor: accent + "1A",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Ionicons name={icon} size={14} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: accent,
            fontWeight: "800",
            fontSize: 15,
            lineHeight: 18,
          }}
          numberOfLines={1}
        >
          {value}
        </Text>
        <Text
          style={{ color: colors.textSecondary, fontSize: 10, lineHeight: 13 }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

function CurrentTicketCard({
  ticket,
  onRecall,
  onAbsent,
  onClose,
  isActing,
}: {
  ticket: Ticket;
  onRecall: () => void;
  onAbsent: () => void;
  onClose: () => void;
  isActing: boolean;
}) {
  const statusCfg = STATUS_CFG[ticket.status] ?? {
    color: "#007AFF",
    label: ticket.status,
  };

  let statusLine = "";
  if (ticket.status === "present") {
    statusLine = "Usager présent sur place";
  } else if (ticket.en_route_at) {
    statusLine =
      ticket.estimated_travel_minutes != null
        ? `En route · ≈ ${ticket.estimated_travel_minutes} min`
        : "Réponse reçue";
  } else if (ticket.called_at) {
    statusLine = `Appelé à ${fmtTime(ticket.called_at)} · ${timeAgo(ticket.called_at)}`;
  }

  return (
    <View
      style={{
        marginHorizontal: 12,
        marginBottom: 6,
        borderRadius: 12,
        backgroundColor: "#1558CC",
        overflow: "hidden",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 13,
          paddingVertical: 11,
          gap: 11,
        }}
      >
        {/* Icon */}
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            backgroundColor: "rgba(255,255,255,0.15)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Ionicons name="megaphone" size={20} color="white" />
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
              marginBottom: 2,
            }}
          >
            <Text
              style={{
                color: "white",
                fontWeight: "900",
                fontSize: 20,
                letterSpacing: 0.4,
              }}
            >
              {ticket.number}
            </Text>
            <View
              style={{
                backgroundColor: "rgba(255,255,255,0.2)",
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 5,
              }}
            >
              <Text
                style={{
                  color: "white",
                  fontSize: 9,
                  fontWeight: "800",
                  letterSpacing: 0.5,
                }}
              >
                {statusCfg.label.toUpperCase()}
              </Text>
            </View>
          </View>
          {statusLine !== "" && (
            <Text style={{ color: "rgba(255,255,255,0.82)", fontSize: 12 }}>
              {statusLine}
            </Text>
          )}
        </View>

        {/* Action buttons */}
        <View style={{ flexDirection: "row", gap: 6 }}>
          {/* Recall */}
          <TouchableOpacity
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              backgroundColor: "rgba(255,255,255,0.15)",
              justifyContent: "center",
              alignItems: "center",
            }}
            onPress={onRecall}
            disabled={isActing}
          >
            <Ionicons name="volume-high" size={16} color="white" />
          </TouchableOpacity>

          {/* Absent */}
          <TouchableOpacity
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              backgroundColor: "rgba(255,59,48,0.55)",
              justifyContent: "center",
              alignItems: "center",
            }}
            onPress={onAbsent}
            disabled={isActing}
          >
            <Ionicons name="person-remove" size={16} color="white" />
          </TouchableOpacity>

          {/* Close / Served */}
          <TouchableOpacity
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              backgroundColor: "rgba(52,199,89,0.55)",
              justifyContent: "center",
              alignItems: "center",
            }}
            onPress={onClose}
            disabled={isActing}
          >
            <Ionicons name="checkmark-circle" size={16} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AgentQueue() {
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const { AlertComponent, showSuccess, showWarning, showError } =
    useCustomAlert();

  const params = useLocalSearchParams<{
    serviceId: string;
    counterId: string;
  }>();
  const serviceId = params.serviceId;
  const counterId = params.counterId;

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [currentTicket, setCurrentTicket] = useState<Ticket | null>(null);
  const [stats, setStats] = useState<ServiceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<string>("open");
  const [searchQuery, setSearchQuery] = useState("");
  const echoRef = useRef<any>(null);

  // Responsive horizontal padding
  const hPad = width >= 768 ? 20 : 12;

  // ── fetchData ──────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!serviceId) return;
    try {
      const [queueRes, statsRes, serviceRes] = await Promise.all([
        axiosClient.get(`/services/${serviceId}/queue`),
        axiosClient.get(`/services/${serviceId}/affluence`),
        axiosClient.get(`/services/${serviceId}`),
      ]);

      const waitingTickets = (queueRes.data?.tickets || []).filter(
        (t: Ticket) => t.status === "waiting",
      );

      waitingTickets.sort((a: Ticket, b: Ticket) => {
        const pa =
          typeof a.position === "number" ? a.position : Number.MAX_SAFE_INTEGER;
        const pb =
          typeof b.position === "number" ? b.position : Number.MAX_SAFE_INTEGER;
        return pa - pb;
      });

      setTickets(waitingTickets);
      setFilteredTickets(waitingTickets);
      setStats({
        waiting: statsRes.data?.waiting || statsRes.data?.people || 0,
        processed: statsRes.data?.processed || 0,
        avg_wait_time:
          statsRes.data?.eta_avg || statsRes.data?.average_wait_time || 0,
      });
      setServiceStatus(serviceRes.data?.status || "open");

      const calledTicket = (queueRes.data?.tickets || []).find(
        (t: Ticket) =>
          t.status === "present" ||
          t.status === "called" ||
          t.status === "en_route",
      );
      setCurrentTicket(calledTicket || null);
    } catch (error) {
      console.error("Error fetching queue:", error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [serviceId]);

  // ── useFocusEffect: refresh on screen focus ────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  // ── useFocusEffect: WebSocket / Echo realtime ──────────────────────────────
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const connectRealtime = async () => {
        if (!serviceId || echoRef.current) return;
        const token = await AsyncStorage.getItem("access_token");
        if (!token) return;

        const wsUrlStr =
          process.env.EXPO_PUBLIC_WS_URL ||
          "wss://reverb-production-b4e5.up.railway.app";
        const isWss = wsUrlStr.startsWith("wss://");
        const hostWithoutScheme = wsUrlStr
          .replace("wss://", "")
          .replace("ws://", "");
        const hostParts = hostWithoutScheme.split(":");
        const host = hostParts[0];
        const portStr = hostParts[1];
        const port = portStr ? parseInt(portStr, 10) : isWss ? 443 : 80;

        const echo = new Echo({
          broadcaster: "reverb",
          key: process.env.EXPO_PUBLIC_REVERB_APP_KEY || "smartqueue_key",
          appid: process.env.EXPO_PUBLIC_REVERB_APP_ID || "smartqueue_id",
          wsHost: host,
          wsPort: port,
          wssPort: port,
          forceTLS: isWss,
          enabledTransports: ["ws", "wss"],
          disableStats: true,
          authorizer: (channel: any) => ({
            authorize: (socketId: string, callback: Function) => {
              axiosClient
                .post("/broadcasting/auth", {
                  socket_id: socketId,
                  channel_name: channel.name,
                })
                .then((response) => callback(false, response.data))
                .catch((error) => callback(true, error));
            },
          }),
        });

        echoRef.current = echo;

        echo
          .join(`service.${serviceId}`)
          .listen(".user.en_route", () => {
            if (!isActive) return;
            fetchData();
          })
          .listen(".service.ticket.called", () => {
            if (!isActive) return;
            fetchData();
          })
          .listen(".service.ticket.absent", () => {
            if (!isActive) return;
            fetchData();
          })
          .listen(".service.ticket.served", () => {
            if (!isActive) return;
            fetchData();
          })
          .listen(".service.stats.updated", () => {
            if (!isActive) return;
            fetchData();
          });
      };

      connectRealtime();

      return () => {
        isActive = false;
        if (echoRef.current) {
          try {
            echoRef.current.leave(`service.${serviceId}`);
            echoRef.current.disconnect();
          } catch {}
          echoRef.current = null;
        }
      };
    }, [serviceId, fetchData]),
  );

  // ── Search filter ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTickets(tickets);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredTickets(
        tickets.filter(
          (t) =>
            t.number.toLowerCase().includes(q) ||
            String(t.position ?? "").includes(q),
        ),
      );
    }
  }, [searchQuery, tickets]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleCallNext = async () => {
    if (!serviceId) return;
    setIsActing(true);
    try {
      const payload: any = {};
      if (counterId) payload.counter_id = parseInt(counterId);
      await axiosClient.post(
        `/services/${parseInt(serviceId)}/call-next`,
        payload,
      );
      await fetchData();
      showSuccess("Appel réussi", "Le prochain ticket a été appelé");
    } catch (error: any) {
      showError(
        "Erreur",
        error?.response?.data?.message || "Erreur lors de l'appel",
      );
    } finally {
      setIsActing(false);
    }
  };

  const handleMarkAbsent = async (ticketId: number, ticketNumber?: string) => {
    showWarning(
      "Marquer absent",
      `Voulez-vous marquer le ticket ${ticketNumber ?? ticketId} comme absent ?`,
      "Marquer absent",
      async () => {
        setIsActing(true);
        try {
          await axiosClient.post(`/tickets/${ticketId}/mark-absent`);
          await fetchData();
          showSuccess("Succès", "Ticket marqué comme absent");
        } catch (error: any) {
          showError("Erreur", error?.response?.data?.message || "Erreur");
        } finally {
          setIsActing(false);
        }
      },
      "Annuler",
    );
  };

  const handleRecall = async (ticketId: number) => {
    setIsActing(true);
    try {
      await axiosClient.post(`/tickets/${ticketId}/recall`);
      showSuccess("Rappel envoyé", "Le client a été notifié");
    } catch (error: any) {
      showError("Erreur", error?.response?.data?.message || "Erreur");
    } finally {
      setIsActing(false);
    }
  };

  const handleClose = async (ticketId: number) => {
    showWarning(
      "Terminer le service",
      `Voulez-vous terminer le service pour le ticket ${ticketId} ?`,
      "Terminer",
      async () => {
        setIsActing(true);
        try {
          await axiosClient.post(`/tickets/${ticketId}/close`);
          await fetchData();
          showSuccess("Service terminé", "Le ticket a été clôturé");
        } catch (error: any) {
          showError("Erreur", error?.response?.data?.message || "Erreur");
        } finally {
          setIsActing(false);
        }
      },
      "Annuler",
    );
  };

  const handleOpenService = async () => {
    setIsActing(true);
    try {
      await axiosClient.post(`/services/${parseInt(serviceId || "0")}/open`);
      setServiceStatus("open");
      showSuccess("Succès", "Service ouvert");
    } catch (err: any) {
      showError(
        "Erreur",
        err?.response?.data?.message || err?.message || "Erreur",
      );
    } finally {
      setIsActing(false);
    }
  };

  const handleCloseService = async () => {
    setIsActing(true);
    try {
      await axiosClient.post(`/services/${parseInt(serviceId || "0")}/close`);
      setServiceStatus("closed");
      showSuccess("Succès", "Service fermé");
    } catch (err: any) {
      showError(
        "Erreur",
        err?.response?.data?.message || err?.message || "Erreur",
      );
    } finally {
      setIsActing(false);
    }
  };

  // ── Ticket row renderer ────────────────────────────────────────────────────
  const renderTicket = ({ item, index }: { item: Ticket; index: number }) => {
    const prio = PRIORITY_CFG[item.priority] ?? PRIORITY_CFG.normal;

    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.surface,
          borderRadius: 10,
          marginBottom: 5,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: 9,
          paddingHorizontal: 10,
          gap: 10,
        }}
      >
        {/* Position + priority pill */}
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            backgroundColor: prio.color + "18",
            justifyContent: "center",
            alignItems: "center",
            borderWidth: 1,
            borderColor: prio.color + "40",
          }}
        >
          <Text style={{ color: prio.color, fontWeight: "800", fontSize: 15 }}>
            {item.position ?? index + 1}
          </Text>
        </View>

        {/* Ticket number + meta */}
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginBottom: 3,
            }}
          >
            <Text
              style={{
                color: colors.textPrimary,
                fontWeight: "700",
                fontSize: 15,
              }}
              numberOfLines={1}
            >
              {item.number}
            </Text>
            {/* Priority badge */}
            <View
              style={{
                backgroundColor: prio.color + "20",
                paddingHorizontal: 5,
                paddingVertical: 1,
                borderRadius: 5,
              }}
            >
              <Text
                style={{
                  color: prio.color,
                  fontSize: 9,
                  fontWeight: "800",
                  letterSpacing: 0.3,
                }}
              >
                {prio.label}
              </Text>
            </View>
          </View>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 11,
              lineHeight: 14,
            }}
            numberOfLines={1}
          >
            Pris à {fmtTime(item.created_at)}
            {"  ·  "}
            {timeAgo(item.created_at)}
          </Text>
        </View>

        {/* Status badge */}
        {(() => {
          const sc = STATUS_CFG[item.status] ?? {
            color: "#8E8E93",
            label: item.status,
          };
          return (
            <View
              style={{
                backgroundColor: sc.color + "18",
                paddingHorizontal: 7,
                paddingVertical: 3,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: sc.color + "35",
              }}
            >
              <Text
                style={{ color: sc.color, fontSize: 10, fontWeight: "700" }}
              >
                {sc.label}
              </Text>
            </View>
          );
        })()}

        {/* Absent action */}
        <TouchableOpacity
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: "#FF3B3010",
            borderWidth: 1,
            borderColor: "#FF3B3028",
            justifyContent: "center",
            alignItems: "center",
          }}
          onPress={() => handleMarkAbsent(item.id, item.number)}
        >
          <Ionicons name="person-remove-outline" size={15} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    );
  };

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Ionicons
          name="hourglass-outline"
          size={32}
          color={colors.textSecondary}
        />
        <Text
          style={{ color: colors.textSecondary, marginTop: 8, fontSize: 14 }}
        >
          Chargement...
        </Text>
      </SafeAreaView>
    );
  }

  // ── Derived UI state ───────────────────────────────────────────────────────
  const isCallNextDisabled = isActing || tickets.length === 0;

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: hPad,
          paddingBottom: 10,
          paddingTop:
            Platform.OS === "ios" ? 6 : (StatusBar.currentHeight ?? 6) + 4,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          gap: 8,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontWeight: "700",
              fontSize: 17,
            }}
          >
            {"File d'attente"}
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 11,
              marginTop: 1,
            }}
          >
            Service #{serviceId}
            {counterId ? `  ·  Guichet ${counterId}` : ""}
          </Text>
        </View>

        {/* Service open/close toggle */}
        <TouchableOpacity
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: serviceStatus === "open" ? "#34C759" : "#FF3B30",
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 14,
            gap: 5,
            opacity: isActing ? 0.6 : 1,
          }}
          onPress={() =>
            serviceStatus === "open"
              ? handleCloseService()
              : handleOpenService()
          }
          disabled={isActing}
        >
          <Ionicons
            name={
              serviceStatus === "open" ? "checkmark-circle" : "close-circle"
            }
            size={14}
            color="white"
          />
          <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>
            {serviceStatus === "open" ? "Ouvert" : "Fermé"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── KPI Pills ──────────────────────────────────────────────────────── */}
      {stats && (
        <View
          style={{
            flexDirection: "row",
            paddingHorizontal: hPad,
            paddingVertical: 8,
            gap: 6,
          }}
        >
          <KpiPill
            icon="people-outline"
            label="En attente"
            value={String(stats.waiting)}
            accent="#007AFF"
            colors={colors}
          />
          <KpiPill
            icon="checkmark-done-outline"
            label="Traités"
            value={String(stats.processed)}
            accent="#34C759"
            colors={colors}
          />
          <KpiPill
            icon="timer-outline"
            label="Moy. attente"
            value={
              stats.avg_wait_time > 0
                ? `${Math.round(stats.avg_wait_time)}min`
                : "--"
            }
            accent="#FF9500"
            colors={colors}
          />
        </View>
      )}

      {/* ── Current Ticket ─────────────────────────────────────────────────── */}
      {currentTicket && (
        <View style={{ paddingHorizontal: hPad - 12, marginBottom: 2 }}>
          <CurrentTicketCard
            ticket={currentTicket}
            onRecall={() => handleRecall(currentTicket.id)}
            onAbsent={() =>
              handleMarkAbsent(currentTicket.id, currentTicket.number)
            }
            onClose={() => handleClose(currentTicket.id)}
            isActing={isActing}
          />
        </View>
      )}

      {/* ── Search bar ─────────────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.surface,
          borderRadius: 10,
          marginHorizontal: hPad,
          marginBottom: 4,
          marginTop: 2,
          paddingHorizontal: 10,
          paddingVertical: 7,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 8,
        }}
      >
        <Ionicons name="search" size={15} color={colors.textSecondary} />
        <TextInput
          style={{
            flex: 1,
            fontSize: 14,
            color: colors.textPrimary,
            padding: 0,
          }}
          placeholder="Rechercher un ticket..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons
              name="close-circle"
              size={15}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Ticket FlatList ────────────────────────────────────────────────── */}
      <FlatList
        data={filteredTickets}
        renderItem={renderTicket}
        keyExtractor={(item) => item.id.toString()}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: hPad,
          paddingTop: 6,
          paddingBottom: serviceStatus === "open" ? 108 : 24,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
          />
        }
        ListHeaderComponent={
          filteredTickets.length > 0 ? (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 11,
                  fontWeight: "600",
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                }}
              >
                {"File d'attente"}
              </Text>
              <View
                style={{
                  backgroundColor: "#007AFF18",
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{ color: "#007AFF", fontSize: 12, fontWeight: "700" }}
                >
                  {filteredTickets.length} ticket
                  {filteredTickets.length > 1 ? "s" : ""}
                </Text>
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={() => (
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Ionicons
              name="ticket-outline"
              size={48}
              color={colors.textSecondary}
            />
            <Text
              style={{
                color: colors.textPrimary,
                fontWeight: "700",
                fontSize: 15,
                marginTop: 12,
              }}
            >
              File vide
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 13,
                marginTop: 4,
              }}
            >
              Aucun ticket en attente
            </Text>
          </View>
        )}
      />

      {/* ── Sticky "Appeler le suivant" button ─────────────────────────────── */}
      {serviceStatus === "open" && (
        <View
          style={{
            position: "absolute",
            bottom: 80,
            left: 0,
            right: 0,
            paddingHorizontal: hPad,
            paddingTop: 12,
            paddingBottom: Platform.OS === "ios" ? 28 : 16,
            backgroundColor: colors.background,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <TouchableOpacity
            style={{
              backgroundColor: isCallNextDisabled
                ? colors.textSecondary
                : "#007AFF",
              borderRadius: 14,
              paddingVertical: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity: isCallNextDisabled ? 0.45 : 1,
            }}
            onPress={handleCallNext}
            disabled={isCallNextDisabled}
          >
            <Ionicons name="megaphone" size={20} color="white" />
            <Text style={{ color: "white", fontSize: 16, fontWeight: "700" }}>
              Appeler le suivant
            </Text>
            {tickets.length > 0 && (
              <View
                style={{
                  backgroundColor: "rgba(255,255,255,0.25)",
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 10,
                }}
              >
                <Text
                  style={{ color: "white", fontSize: 13, fontWeight: "700" }}
                >
                  {tickets.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      {AlertComponent}
    </SafeAreaView>
  );
}
