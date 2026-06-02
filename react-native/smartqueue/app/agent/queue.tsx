import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { useCustomAlert } from "../../src/hooks/useCustomAlert";
import axiosClient from "../../src/api/axiosClient";
import { useFocusEffect } from "@react-navigation/native";
import Echo from "laravel-echo";
import Pusher from "pusher-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

(window as any).Pusher = Pusher;

type Ticket = {
  id: number;
  number: string;
  status: string;
  position: number;
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

export default function AgentQueue() {
  const colors = useThemeColors();
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
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const echoRef = useRef<any>(null);

  const fetchData = useCallback(async () => {
    if (!serviceId) return;
    try {
      const [queueRes, statsRes, serviceRes] = await Promise.all([
        axiosClient.get(`/services/${serviceId}/queue`),
        axiosClient.get(`/services/${serviceId}/affluence`),
        axiosClient.get(`/services/${serviceId}`),
      ]);

      const waitingTickets = (queueRes.data?.tickets || [])
        .filter((t: Ticket) => t.status === "waiting")
        .sort((a: Ticket, b: Ticket) => a.position - b.position);

      setTickets(waitingTickets);
      setFilteredTickets(waitingTickets);
      setStats({
        waiting: statsRes.data?.waiting || statsRes.data?.people || 0,
        processed: statsRes.data?.processed || 0,
        avg_wait_time:
          statsRes.data?.eta_avg || statsRes.data?.average_wait_time || 0,
      });
      setServiceStatus(serviceRes.data?.status || "open");

      // Find currently called ticket
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

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

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
          .listen(".user.en_route", (e: any) => {
            if (!isActive) return;
            setCurrentTicket((prev) =>
              prev && prev.id === e.ticket_id
                ? {
                    ...prev,
                    en_route_at: new Date().toISOString(),
                    estimated_travel_minutes: e.estimated_minutes ?? null,
                  }
                : prev,
            );
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
            // Usager a cliqué "Je suis déjà là" → ticket auto-clos
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

  // Filter tickets based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTickets(tickets);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = tickets.filter(
        (t) =>
          t.number.toLowerCase().includes(query) ||
          t.position.toString().includes(query),
      );
      setFilteredTickets(filtered);
    }
  }, [searchQuery, tickets]);

  // Timer for elapsed time since ticket was called
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (currentTicket?.called_at) {
      const updateElapsed = () => {
        const called = new Date(currentTicket.called_at!);
        const now = new Date();
        setElapsedTime(Math.floor((now.getTime() - called.getTime()) / 1000));
      };
      updateElapsed();
      interval = setInterval(updateElapsed, 1000);
    } else {
      setElapsedTime(0);
    }
    return () => clearInterval(interval);
  }, [currentTicket]);

  const callNext = async () => {
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

  const markAbsent = async (ticketId: number, ticketNumber: string) => {
    showWarning(
      "Marquer absent",
      `Voulez-vous marquer le ticket ${ticketNumber} comme absent ?`,
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

  const recall = async (ticketId: number) => {
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

  const closeTicket = async (ticketId: number, ticketNumber: string) => {
    showWarning(
      "Terminer le service",
      `Voulez-vous terminer le service pour le ticket ${ticketNumber} ?`,
      "Terminer",
      async () => {
        setIsActing(true);
        try {
          await axiosClient.post(`/tickets/${ticketId}/close`);
          setCurrentTicket(null);
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

  const toggleService = async () => {
    const newStatus = serviceStatus === "open" ? "closed" : "open";
    showWarning(
      newStatus === "open" ? "Ouvrir le service" : "Fermer le service",
      newStatus === "open"
        ? "Voulez-vous ouvrir ce service ? Les clients pourront prendre des tickets."
        : "Voulez-vous fermer ce service ? Aucun nouveau ticket ne pourra être pris.",
      newStatus === "open" ? "Ouvrir" : "Fermer",
      async () => {
        setIsActing(true);
        try {
          if (serviceStatus === "open") {
            await axiosClient.post(`/services/${parseInt(serviceId)}/close`);
          } else {
            await axiosClient.post(`/services/${parseInt(serviceId)}/open`);
          }
          setServiceStatus(newStatus);
          showSuccess(
            "Succès",
            `Service ${newStatus === "open" ? "ouvert" : "fermé"}`,
          );
        } catch (error: any) {
          showError("Erreur", error?.response?.data?.message || "Erreur");
        } finally {
          setIsActing(false);
        }
      },
      "Annuler",
    );
  };

  const renderTicket = ({ item, index }: { item: Ticket; index: number }) => {
    const getPriorityConfig = () => {
      switch (item.priority) {
        case "vip":
          return {
            color: "#FFD60A",
            bgColor: "#FFD60A20",
            label: "VIP",
            icon: "star",
          };
        case "high":
          return {
            color: "#FF9500",
            bgColor: "#FF950020",
            label: "PRIORITAIRE",
            icon: "alert-circle",
          };
        default:
          return {
            color: "#22C55E",
            bgColor: "#22C55E20",
            label: "NORMAL",
            icon: "person",
          };
      }
    };

    const formatTime = (dateStr: string) => {
      if (!dateStr) return "--:--";
      try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return "--:--";
        return date.toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch {
        return "--:--";
      }
    };

    const getWaitTime = () => {
      if (!item.created_at) return "--";
      try {
        const created = new Date(item.created_at);
        if (isNaN(created.getTime())) return "--";
        const now = new Date();
        const diffMs = now.getTime() - created.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return "À l'instant";
        if (diffMins < 60) return `${diffMins} min`;
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return `${hours}h${mins.toString().padStart(2, "0")}`;
      } catch {
        return "--";
      }
    };

    const priority = getPriorityConfig();
    const waitTime = getWaitTime();
    const createdTime = formatTime(item.created_at);

    return (
      <View
        style={[
          styles.ticketCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 0.5,
          },
        ]}
      >
        {/* Left: Rank Icon */}
        <View
          style={[
            styles.ticketIconContainer,
            { backgroundColor: priority.bgColor },
          ]}
        >
          <Text style={[styles.ticketIconRank, { color: priority.color }]}>
            {index + 1}
          </Text>
        </View>

        {/* Center: Main Info */}
        <View style={styles.ticketContent}>
          {/* Row 1: Ticket Number + Priority Badge */}
          <View style={styles.ticketTitleRow}>
            <Text style={[styles.ticketTitle, { color: colors.textPrimary }]}>
              {item.number}
            </Text>
            <View
              style={[
                styles.ticketBadge,
                { backgroundColor: priority.bgColor },
              ]}
            >
              <Ionicons
                name={priority.icon as any}
                size={10}
                color={priority.color}
              />
              <Text style={[styles.ticketBadgeText, { color: priority.color }]}>
                {priority.label}
              </Text>
            </View>
          </View>

          {/* Row 2: Time info */}
          <View style={styles.ticketInfoRow}>
            <Ionicons
              name="time-outline"
              size={12}
              color={colors.textSecondary}
            />
            <Text
              style={[styles.ticketInfoText, { color: colors.textSecondary }]}
            >
              Pris à {createdTime}
            </Text>
          </View>

          {/* Row 3: Wait time badge */}
          <View style={styles.ticketBadgesRow}>
            <View
              style={[
                styles.ticketWaitBadge,
                { backgroundColor: colors.primary + "15" },
              ]}
            >
              <Ionicons
                name="hourglass-outline"
                size={12}
                color={colors.primary}
              />
              <Text style={[styles.ticketWaitText, { color: colors.primary }]}>
                Attente: {waitTime}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <Text style={{ color: colors.textSecondary }}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          File d&apos;attente
        </Text>
        <TouchableOpacity
          style={[
            styles.statusToggle,
            {
              backgroundColor: serviceStatus === "open" ? "#22C55E" : "#EF4444",
            },
          ]}
          onPress={toggleService}
          disabled={isActing}
        >
          <Ionicons
            name={
              serviceStatus === "open" ? "checkmark-circle" : "close-circle"
            }
            size={16}
            color="white"
          />
          <Text style={styles.statusToggleText}>
            {serviceStatus === "open" ? "Ouvert" : "Fermé"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      {stats && (
        <View
          style={[
            styles.statsContainer,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {stats.waiting}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              En attente
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {stats.processed}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Traités
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {stats.avg_wait_time} min
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Attente moy.
            </Text>
          </View>
        </View>
      )}

      {/* Current Called Ticket */}
      {currentTicket && (
        <View
          style={[
            styles.currentTicketCard,
            { backgroundColor: colors.primary },
          ]}
        >
          <View style={styles.currentTicketHeader}>
            <View style={styles.currentTicketIcon}>
              <Ionicons name="megaphone" size={24} color="white" />
            </View>
            <View>
              <Text style={styles.currentTicketLabel}>Ticket en cours</Text>
              <Text style={styles.currentTicketNumber}>
                {currentTicket.number}
              </Text>
              {elapsedTime > 0 && (
                <Text style={styles.elapsedTime}>
                  Appelé depuis {Math.floor(elapsedTime / 60)}:
                  {(elapsedTime % 60).toString().padStart(2, "0")}
                </Text>
              )}
              {currentTicket.en_route_at && (
                <View style={styles.presenceBadge}>
                  <Ionicons
                    name={
                      currentTicket.status === "present"
                        ? "person-circle"
                        : "checkmark-circle"
                    }
                    size={14}
                    color="#166534"
                  />
                  <Text style={styles.presenceBadgeText}>
                    {currentTicket.status === "present"
                      ? "Usager présent sur place"
                      : currentTicket.estimated_travel_minutes != null
                        ? `Usager en route · ≈ ${currentTicket.estimated_travel_minutes} min`
                        : "Réponse reçue"}
                  </Text>
                </View>
              )}
              {currentTicket.response_received_at && (
                <Text style={styles.elapsedTime}>
                  Réponse reçue à{" "}
                  {new Date(
                    currentTicket.response_received_at,
                  ).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              )}
              {currentTicket.en_route_expires_at &&
                currentTicket.status === "en_route" && (
                  <Text style={styles.elapsedTime}>
                    Priorité valable jusqu&apos;à{" "}
                    {new Date(
                      currentTicket.en_route_expires_at,
                    ).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                )}
            </View>
          </View>
          <View style={styles.currentTicketActions}>
            <TouchableOpacity
              style={styles.currentActionBtn}
              onPress={() => recall(currentTicket.id)}
            >
              <Ionicons name="volume-high" size={20} color="white" />
              <Text style={styles.currentActionText}>Rappeler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.currentActionBtn}
              onPress={() => markAbsent(currentTicket.id, currentTicket.number)}
            >
              <Ionicons name="person-remove" size={20} color="white" />
              <Text style={styles.currentActionText}>Absent</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.currentActionBtn, styles.closeBtn]}
              onPress={() =>
                closeTicket(currentTicket.id, currentTicket.number)
              }
            >
              <Ionicons name="checkmark-circle" size={20} color="white" />
              <Text style={styles.currentActionText}>Terminer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Call Next Button */}
      {!currentTicket && serviceStatus === "open" && (
        <TouchableOpacity
          style={[styles.callNextBtn, { backgroundColor: colors.primary }]}
          onPress={callNext}
          disabled={isActing || tickets.length === 0}
        >
          <Ionicons name="arrow-forward" size={24} color="white" />
          <Text style={styles.callNextText}>Appeler le suivant</Text>
          {tickets.length > 0 && (
            <View style={styles.queueBadge}>
              <Text style={styles.queueBadgeText}>{tickets.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Queue List */}
      <View style={styles.queueSection}>
        <View style={styles.queueHeader}>
          <Text style={[styles.queueTitle, { color: colors.textPrimary }]}>
            Prochains dans la file ({filteredTickets.length})
          </Text>
        </View>

        {/* Search Bar */}
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Rechercher un numéro..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons
                name="close-circle"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={filteredTickets.slice(0, 10)}
          renderItem={renderTicket}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchData();
              }}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons
                name="checkmark-circle-outline"
                size={64}
                color={colors.textSecondary}
              />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                File vide
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Aucun ticket en attente
              </Text>
            </View>
          }
          contentContainerStyle={styles.queueList}
        />
      </View>

      {AlertComponent}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    marginLeft: 8,
  },
  statusToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  statusToggleText: {
    color: "white",
    fontSize: 13,
    fontWeight: "600",
  },
  statsContainer: {
    flexDirection: "row",
    padding: 16,
    margin: 16,
    borderWidth: 1,
    borderRadius: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  currentTicketCard: {
    margin: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  currentTicketHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  currentTicketIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  currentTicketLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
  },
  currentTicketNumber: {
    color: "white",
    fontSize: 28,
    fontWeight: "800",
  },
  elapsedTime: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: "500",
    marginTop: 4,
  },
  presenceBadge: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  presenceBadgeText: {
    color: "#166534",
    fontSize: 12,
    fontWeight: "700",
  },
  currentTicketActions: {
    flexDirection: "row",
    gap: 8,
  },
  currentActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
  },
  closeBtn: {
    backgroundColor: "#22C55E",
  },
  currentActionText: {
    color: "white",
    fontSize: 13,
    fontWeight: "600",
  },
  callNextBtn: {
    margin: 16,
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  callNextText: {
    color: "white",
    fontSize: 17,
    fontWeight: "700",
  },
  queueBadge: {
    backgroundColor: "rgba(255,255,255,0.3)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  queueBadgeText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
  },
  queueSection: {
    flex: 1,
    padding: 16,
  },
  queueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    padding: 0,
  },
  queueTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  queueCount: {
    fontSize: 14,
  },
  queueList: {
    paddingBottom: 20,
  },
  ticketCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  ticketIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  ticketIconRank: {
    fontSize: 20,
    fontWeight: "800",
  },
  ticketContent: {
    flex: 1,
    justifyContent: "center",
  },
  ticketTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  ticketTitle: {
    fontSize: 17,
    fontWeight: "700",
    flex: 1,
  },
  ticketBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
    marginLeft: 8,
  },
  ticketBadgeText: {
    fontSize: 9,
    fontWeight: "700",
  },
  ticketInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  ticketInfoText: {
    fontSize: 13,
    marginLeft: 5,
  },
  ticketBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 8,
  },
  ticketWaitBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 5,
  },
  ticketWaitText: {
    fontSize: 11,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 4,
  },
});
