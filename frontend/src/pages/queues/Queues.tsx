/**
 * Files d'attente (Agent/Admin)
 * - Sélection d'un service pour piloter la file d'attente
 * - Actions: appeler suivant, marquer absent, rappeler
 * - Écoute temps réel des évènements via Laravel Echo
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  Ticket,
  User,
  Users,
  TrendingUp,
  RefreshCw,
  Phone,
  PhoneOff,
  UserX,
  CheckCircle,
  Volume2,
  X,
} from "lucide-react";
import { getEcho } from "@/api/echo";
import { cn } from "@/lib/utils";
import { api } from "@/api/axios";
import { useAppSelector } from "@/store";
import { toast } from "sonner";

type Ticket = {
  id: number;
  ticket_number: string;
  status: string;
  created_at: string;
  service_id: number;
  service_name: string;
  priority: string;
  client_name?: string;
};

type QueueTicket = {
  id: number;
  number: string;
  status: string;
  priority: string;
  en_route_at?: string | null;
  estimated_travel_minutes?: number | null;
  position?: number | null;
  called_at?: string | null;
  present_at?: string | null;
  response_received_at?: string | null;
  en_route_expires_at?: string | null;
  is_swapped?: boolean;
  deferred_at?: string | null;
  swapped_with_ticket_id?: number | null;
};

type ServiceStats = {
  service_id: number;
  service_name: string;
  waiting: number;
  processed: number;
  average_wait_time: string;
};

type AssignedService = {
  id: number;
  name: string;
  status: string;
  avg_service_time_minutes?: number;
  priority_support?: boolean;
  capacity?: number | null;
};

type Counter = {
  id: number;
  name: string;
  status: string;
  current_agent_id?: number | null;
};

const Queues: React.FC = () => {
  const { user } = useAppSelector((s) => s.auth);
  const assignedServices = (user as any)?.services as
    | AssignedService[]
    | undefined;
  const counters = (user as any)?.counters as Counter[] | undefined;

  const [serviceId, setServiceId] = useState<string>("");
  const [counterId, setCounterId] = useState<string>("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [queue, setQueue] = useState<QueueTicket[]>([]);
  const [stats, setStats] = useState<ServiceStats | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isActing, setIsActing] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const echo = getEcho();

  // Default service selection from assigned services
  useEffect(() => {
    if (!serviceId && assignedServices && assignedServices.length > 0) {
      setServiceId(String(assignedServices[0].id));
    }
  }, [serviceId, assignedServices]);

  const fetchService = async (id: string) => {
    const numericId = Number(id);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      throw new Error("Identifiant de service invalide");
    }
    const { data } = await api.get(`/api/services/${numericId}`);
    return data;
  };

  const fetchQueue = async (id: string) => {
    const numericId = Number(id);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      throw new Error("Identifiant de service invalide");
    }
    const { data } = await api.get(`/api/services/${numericId}/queue`);
    return data;
  };

  const refreshQueueAndStats = async () => {
    if (!serviceId) return;
    try {
      const [q, s] = await Promise.all([
        fetchQueue(serviceId),
        fetchStats(serviceId),
      ]);
      setQueue(Array.isArray(q?.tickets) ? q.tickets : []);
      const mapped: ServiceStats = {
        service_id: Number(serviceId),
        service_name: String(
          s?.service?.name || s?.service_name || `Service ${serviceId}`,
        ),
        waiting: Number(s?.people ?? s?.waiting ?? 0),
        processed: Number(s?.processed ?? 0),
        average_wait_time: String(s?.eta_avg ?? s?.average_wait_time ?? "—"),
      };
      setStats(mapped);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e: any) {
      setError(e?.message || "Erreur");
    }
  };

  const callNext = async () => {
    if (!serviceId) return;
    setIsActing(true);
    setError("");
    try {
      const numericCounterId = counterId ? Number(counterId) : null;
      await api.post(`/api/services/${Number(serviceId)}/call-next`, {
        counter_id: numericCounterId,
      });
      await refreshQueueAndStats();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Erreur");
    } finally {
      setIsActing(false);
    }
  };

  const openService = async () => {
    if (!serviceId) return;
    setIsActing(true);
    setError("");
    try {
      await api.post(`/api/services/${Number(serviceId)}/open`);
      await refreshQueueAndStats();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Erreur");
    } finally {
      setIsActing(false);
    }
  };

  const closeService = async () => {
    if (!serviceId) return;
    setIsActing(true);
    setError("");
    try {
      await api.post(`/api/services/${Number(serviceId)}/close`);
      await refreshQueueAndStats();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Erreur");
    } finally {
      setIsActing(false);
    }
  };

  const openCounter = async () => {
    if (!counterId) return;
    setIsActing(true);
    setError("");
    try {
      await api.post(`/api/counters/${Number(counterId)}/open`);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Erreur");
    } finally {
      setIsActing(false);
    }
  };

  const closeCounter = async () => {
    if (!counterId) return;
    setIsActing(true);
    setError("");
    try {
      await api.post(`/api/counters/${Number(counterId)}/close`);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Erreur");
    } finally {
      setIsActing(false);
    }
  };

  const markAbsent = async (ticketId: number) => {
    setIsActing(true);
    setError("");
    try {
      await api.post(`/api/tickets/${ticketId}/mark-absent`);
      toast.success("Ticket marqué absent", {
        description: "L'usager a été notifié",
      });
      await refreshQueueAndStats();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Erreur");
      toast.error("Erreur", {
        description: e?.response?.data?.message || e?.message,
      });
    } finally {
      setIsActing(false);
    }
  };

  const recall = async (ticketId: number) => {
    setIsActing(true);
    setError("");
    try {
      await api.post(`/api/tickets/${ticketId}/recall`);
      toast.success("Rappel envoyé", { description: "L'usager a été notifié" });
      await refreshQueueAndStats();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Erreur");
      toast.error("Erreur", {
        description: e?.response?.data?.message || e?.message,
      });
    } finally {
      setIsActing(false);
    }
  };

  const closeTicket = async (ticketId: number) => {
    setIsActing(true);
    setError("");
    try {
      await api.post(`/api/tickets/${ticketId}/close`);
      toast.success("Ticket clôturé", { description: "Le ticket a été fermé" });
      await refreshQueueAndStats();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Erreur");
      toast.error("Erreur", {
        description: e?.response?.data?.message || e?.message,
      });
    } finally {
      setIsActing(false);
    }
  };

  const fetchStats = async (id: string) => {
    const numericId = Number(id);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      throw new Error("Identifiant de service invalide");
    }
    const { data } = await api.get(`/api/services/${numericId}/affluence`);
    return data;
  };

  useEffect(() => {
    if (!serviceId) return;

    let cancelled = false;
    let channel: any = null;

    // Réinitialiser l'état lors du changement de service
    setTickets([]);
    setStats(null);
    setIsLoading(true);
    setIsConnected(false);
    setError("");

    (async () => {
      try {
        await fetchService(serviceId);
        if (cancelled) return;

        // Initial load (queue + stats)
        try {
          const q = await fetchQueue(serviceId);
          if (!cancelled) {
            setQueue(Array.isArray(q?.tickets) ? q.tickets : []);
          }
        } catch (e: any) {
          if (!cancelled) setError(e?.message || "Erreur");
        }

        // Charger les stats initiales
        try {
          const s = await fetchStats(serviceId);
          if (!cancelled) {
            const mapped: ServiceStats = {
              service_id: Number(serviceId),
              service_name: String(
                s?.service?.name || s?.service_name || `Service ${serviceId}`,
              ),
              waiting: Number(s?.people ?? s?.waiting ?? 0),
              processed: Number(s?.processed ?? 0),
              average_wait_time: String(
                s?.eta_avg ?? s?.average_wait_time ?? "—",
              ),
            };
            setStats(mapped);
          }
        } catch (e: any) {
          console.warn("Erreur chargement stats initiales:", e);
        }

        // Arrêter le loading - les données sont chargées
        if (!cancelled) {
          setIsLoading(false);
        }

        // S'abonner au canal de présence pour le service (optionnel)
        try {
          console.log(
            `[Queues] Tentative de connexion au canal service.${serviceId}`,
          );
          channel = echo.join(`service.${serviceId}`);

          channel
            .subscribed(() => {
              console.log(
                `[Queues] ✓ Abonné au canal presence-service.${serviceId}`,
              );
              setIsConnected(true);
              setLastUpdated(new Date().toLocaleTimeString());
              toast.success(`Connecté au service ${serviceId}`);
            })
            .here((users: any[]) => {
              console.log(
                `[Queues] Utilisateurs présents sur le canal:`,
                users,
              );
            })
            .joining((user: any) => {
              console.log(`[Queues] Utilisateur rejoint:`, user);
            })
            .leaving((user: any) => {
              console.log(`[Queues] Utilisateur part:`, user);
            })
            .listen(".service.ticket.called", (e: any) => {
              console.log("[Queues] Ticket appelé reçu:", e);
              setTickets((prevTickets) =>
                [
                  {
                    id: e.ticket.id,
                    ticket_number: e.ticket.ticket_number,
                    status: e.ticket.status,
                    created_at: e.ticket.created_at,
                    service_id: e.ticket.service_id,
                    service_name: e.ticket.service_name,
                    priority: e.ticket.priority,
                    client_name: e.ticket.client_name,
                  },
                  ...prevTickets,
                ].slice(0, 10),
              );
              setLastUpdated(new Date().toLocaleTimeString());
              refreshQueueAndStats();
            })
            .listen(".service.ticket.enqueued", () => {
              if (cancelled) return;
              refreshQueueAndStats();
            })
            .listen(".service.ticket.absent", () => {
              if (cancelled) return;
              refreshQueueAndStats();
            })
            .listen(".service.stats.updated", (e: any) => {
              console.log("Statistiques mises à jour:", e);
              setStats(e.stats);
              setLastUpdated(new Date().toLocaleTimeString());
            })
            .listen(".user.en_route", (e: any) => {
              console.log("[Queues] ✓✓✓ UserEnRoute reçu:", e);
              console.log(
                "[Queues] ticket_id:",
                e.ticket_id,
                "ticket_number:",
                e.ticket_number,
              );
              console.log(
                "[Queues] Appel toast.success avec message:",
                e.message,
              );
              try {
                toast.success("Usager en route", {
                  description:
                    e.message ||
                    `Ticket ${e.ticket_number}: l'usager a confirmé sa présence`,
                  duration: 5000,
                });
                console.log("[Queues] Toast appelé avec succès");
              } catch (err) {
                console.error("[Queues] Erreur toast:", err);
              }
              // Update the queue to show en_route status
              setQueue((prevQueue) =>
                prevQueue.map((t) =>
                  t.id === e.ticket_id
                    ? {
                        ...t,
                        en_route_at: new Date().toISOString(),
                        estimated_travel_minutes: e.estimated_minutes ?? null,
                      }
                    : t,
                ),
              );
              setLastUpdated(new Date().toLocaleTimeString());
            })
            .error((err: any) => {
              console.warn("Erreur WebSocket:", err);
              setIsConnected(false);
            });
        } catch (wsError) {
          console.warn(
            "WebSocket non disponible, fonctionnement en mode polling:",
            wsError,
          );
          setIsConnected(false);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Erreur lors de la connexion au service:", error);
          toast.error("Erreur de configuration du service");
          setIsConnected(false);
          setIsLoading(false);
        }
      }
    })();

    // Cleanup function
    return () => {
      cancelled = true;
      try {
        if (channel) {
          channel.stopListening(".service.ticket.called");
          channel.stopListening(".service.ticket.enqueued");
          channel.stopListening(".service.ticket.absent");
          channel.stopListening(".service.stats.updated");
          channel.stopListening(".user.en_route");
        }
      } catch (error) {
        console.error("Erreur lors du nettoyage du canal:", error);
      }
    };
  }, [echo, serviceId]);

  const handleServiceIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceId.trim()) {
      toast.error("Veuillez entrer un identifiant de service");
      return;
    }
    setIsLoading(true);
    setTickets([]);
    setStats(null);
    setError("");

    fetchStats(serviceId)
      .then((data) => {
        const mapped: ServiceStats = {
          service_id: Number(serviceId),
          service_name: String(
            data?.service?.name || data?.service_name || `Service ${serviceId}`,
          ),
          waiting: Number(data?.people ?? data?.waiting ?? 0),
          processed: Number(data?.processed ?? 0),
          average_wait_time: String(
            data?.eta_avg ?? data?.average_wait_time ?? "—",
          ),
        };
        setStats(mapped);
        setLastUpdated(new Date().toLocaleTimeString());
      })
      .catch((err: any) => {
        setError(err?.message || "Erreur");
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const refreshData = () => {
    if (!serviceId) {
      toast.error("Aucun service sélectionné");
      return;
    }
    setIsLoading(true);
    toast.info("Reconnexion en cours...");
    // La reconnexion se fera automatiquement via l'effet
  };

  if (isLoading && serviceId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <div className="text-center bg-card p-8 rounded-xl shadow-lg max-w-md w-full border border-border">
          <div className="flex justify-center mb-4">
            <div className="relative h-8 w-8">
              <div className="absolute inset-0 rounded-full border-4 " />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Connexion en cours
          </h2>
          <p className="text-muted-foreground mb-6">
            Connexion au service {serviceId}...
          </p>
          <div className="w-full bg-muted rounded-full h-2">
            <div className="bg-primary h-2 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  const enRouteCount = useMemo(
    () =>
      queue.filter(
        (ticket) =>
          (ticket.status === "en_route" || ticket.status === "present") &&
          !!ticket.en_route_at,
      ).length,
    [queue],
  );

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800/30";
      case "vip":
        return "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-800/30";
      default:
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800/30";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "high":
        return "🔥";
      case "vip":
        return "⭐";
      default:
        return "📋";
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className=" mx-auto">
        <div className="bg-card rounded-2xl shadow-xl overflow-hidden mb-8 border border-border">
          {/* En-tête */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6 text-white">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">
                  Tableau de bord des files d'attente
                </h1>
                <p className="text-blue-100 mt-1">
                  Surveillez en temps réel l'activité de vos services
                </p>
              </div>
              {lastUpdated && (
                <div className="mt-4 md:mt-0 text-sm bg-blue-700 bg-opacity-50 px-3 py-1.5 rounded-full inline-flex items-center">
                  <span className="w-2 h-2 rounded-full bg-green-400 mr-2"></span>
                  <span>Mis à jour à {lastUpdated}</span>
                </div>
              )}
            </div>
          </div>

          {/* Sélection du service */}
          <div className="p-6 border-b border-border">
            <form onSubmit={handleServiceIdSubmit}>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-grow">
                  <label
                    htmlFor="serviceId"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    Service
                  </label>
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Ticket className="h-5 w-5 text-blue-500" />
                    </div>
                    {assignedServices && assignedServices.length > 0 ? (
                      <select
                        id="serviceId"
                        value={serviceId}
                        onChange={(e) => setServiceId(e.target.value)}
                        className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 pr-12 border-border rounded-lg text-base bg-background"
                      >
                        {assignedServices.map((s) => (
                          <option key={s.id} value={String(s.id)}>
                            {s.name} ({s.status})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        id="serviceId"
                        value={serviceId}
                        onChange={(e) => setServiceId(e.target.value)}
                        placeholder="Entrez l'ID du service"
                        className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 pr-12 border-border rounded-lg text-base bg-background placeholder:text-muted-foreground"
                      />
                    )}
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                      <button
                        type="submit"
                        className="p-2 text-blue-600 rounded-full hover:text-blue-800 focus:outline-none hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        title="Actualiser"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full md:w-auto px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 flex items-center justify-center"
                  >
                    <TrendingUp className="mr-2" />
                    Afficher les statistiques
                  </button>
                </div>
              </div>
            </form>

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/30 dark:bg-red-900/20 dark:text-red-200">
                {error}
              </div>
            )}

            {serviceId && (
              <div className="mt-4 flex items-center">
                <div
                  className={`h-3 w-3 rounded-full mr-2 ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`}
                ></div>
                <span className="text-sm font-medium text-foreground">
                  {isConnected
                    ? `Connecté au service ${serviceId}`
                    : "Déconnecté"}
                </span>
                {isConnected && (
                  <button
                    onClick={refreshData}
                    className="ml-4 text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded transition-colors"
                  >
                    <RefreshCw className="mr-1 h-3.5 w-3.5" />
                    Actualiser
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Cartes de statistiques */}
          {stats && (
            <div className="p-6 border-b border-border bg-blue-50/50 dark:bg-blue-900/10">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                <TrendingUp className="mr-2 text-blue-600" />
                Aperçu des performances
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-card p-5 rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center">
                    <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mr-4">
                      <User className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        En attente
                      </p>
                      <p className="text-2xl font-bold text-foreground">
                        {stats.waiting}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Service: {stats.service_name}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-card p-5 rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center">
                    <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mr-4">
                      <Ticket className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Traités
                      </p>
                      <p className="text-2xl font-bold text-foreground">
                        {stats.processed}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-xs text-muted-foreground">
                      <span>Service: {stats.service_name}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-card p-5 rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center">
                    <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 mr-4">
                      <Users className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Temps d'attente
                      </p>
                      <p className="text-2xl font-bold text-foreground">
                        {stats.average_wait_time}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-xs text-muted-foreground">
                      <span>Moyenne pour {stats.service_name}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Derniers tickets appelés */}
          <div className="p-6">
            {serviceId && (
              <>
                <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                        Confirmation de présence usager
                      </h3>
                      <p className="text-sm text-emerald-700/90 dark:text-emerald-200/80">
                        Les tickets appelés qui ont répondu affichent désormais
                        un indicateur visible dans la file.
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                      <CheckCircle className="h-4 w-4" />
                      {enRouteCount} usager{enRouteCount > 1 ? "s" : ""} en
                      route
                    </div>
                  </div>
                </div>
                <div className="mb-6 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={callNext}
                      disabled={!isConnected || isActing}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
                        !isConnected || isActing
                          ? "bg-muted text-muted-foreground border-border"
                          : "bg-primary text-primary-foreground border-primary hover:bg-primary/90",
                      )}
                    >
                      Appeler suivant
                    </button>
                    <button
                      type="button"
                      onClick={openService}
                      disabled={!serviceId || isActing}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
                        !serviceId || isActing
                          ? "bg-muted text-muted-foreground border-border"
                          : "bg-card text-foreground border-border hover:bg-muted",
                      )}
                    >
                      Ouvrir service
                    </button>
                    <button
                      type="button"
                      onClick={closeService}
                      disabled={!serviceId || isActing}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
                        !serviceId || isActing
                          ? "bg-muted text-muted-foreground border-border"
                          : "bg-card text-foreground border-border hover:bg-muted",
                      )}
                    >
                      Fermer service
                    </button>
                    <button
                      type="button"
                      onClick={refreshQueueAndStats}
                      disabled={!serviceId || isActing}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
                        !serviceId || isActing
                          ? "bg-muted text-muted-foreground border-border"
                          : "bg-card text-foreground border-border hover:bg-muted",
                      )}
                    >
                      Rafraîchir la file
                    </button>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {isActing ? "Action en cours…" : ""}
                  </div>
                </div>
              </>
            )}

            {counters && counters.length > 0 && (
              <div className="mb-6 flex flex-col md:flex-row gap-3 md:items-center">
                <div className="w-full md:w-96">
                  <label
                    htmlFor="counterId"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    Guichet
                  </label>
                  <select
                    id="counterId"
                    value={counterId}
                    onChange={(e) => setCounterId(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">— Aucun guichet —</option>
                    {counters.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name} ({c.status})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 items-end">
                  <button
                    type="button"
                    onClick={openCounter}
                    disabled={!counterId || isActing}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
                      !counterId || isActing
                        ? "bg-muted text-muted-foreground border-border"
                        : "bg-card text-foreground border-border hover:bg-muted",
                    )}
                  >
                    Ouvrir guichet
                  </button>
                  <button
                    type="button"
                    onClick={closeCounter}
                    disabled={!counterId || isActing}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
                      !counterId || isActing
                        ? "bg-muted text-muted-foreground border-border"
                        : "bg-card text-foreground border-border hover:bg-muted",
                    )}
                  >
                    Fermer guichet
                  </button>
                </div>
              </div>
            )}

            {serviceId && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-foreground mb-3">
                  File actuelle
                </h2>
                {queue.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Aucun ticket en waiting/called/absent
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-border">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-border">
                        <thead className="bg-muted">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Ticket
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Statut
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Priorité
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Présence usager
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-card divide-y divide-border">
                          {queue.map((t) => (
                            <tr
                              key={t.id}
                              className="hover-card transition-colors"
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="font-semibold text-foreground">
                                  {t.number}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                  className={cn(
                                    "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold",
                                    t.status === "waiting" &&
                                      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200",
                                    t.status === "called" &&
                                      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
                                    t.status === "en_route" &&
                                      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
                                    t.status === "present" &&
                                      "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200",
                                    t.status === "absent" &&
                                      "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200",
                                    t.status === "closed" &&
                                      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
                                  )}
                                >
                                  {t.is_swapped &&
                                    t.status === "waiting" &&
                                    "Laisser passer"}
                                  {t.status === "waiting" &&
                                    !t.is_swapped &&
                                    "En attente"}
                                  {t.status === "called" && "Appelé"}
                                  {t.status === "en_route" && "En route"}
                                  {t.status === "present" && "Présent"}
                                  {t.status === "absent" && "Absent"}
                                  {t.status === "closed" && "Clôturé"}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                                    t.priority === "vip" &&
                                      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200",
                                    t.priority === "high" &&
                                      "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
                                    t.priority === "normal" &&
                                      "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
                                  )}
                                >
                                  {t.priority === "vip" && "⭐ VIP"}
                                  {t.priority === "high" && "🔥 Haute"}
                                  {t.priority === "normal" && "📋 Normal"}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {(t.status === "called" ||
                                  t.status === "en_route" ||
                                  t.status === "present") &&
                                t.en_route_at ? (
                                  <div className="space-y-1">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                                      <CheckCircle className="h-3.5 w-3.5" />
                                      {t.status === "present"
                                        ? "Présent sur place"
                                        : t.estimated_travel_minutes != null
                                          ? `En route · ≈ ${t.estimated_travel_minutes} min`
                                          : "Présence confirmée"}
                                    </span>
                                    <div className="text-xs text-muted-foreground">
                                      Réponse reçue à{" "}
                                      {new Date(
                                        t.response_received_at ?? t.en_route_at,
                                      ).toLocaleTimeString()}
                                    </div>
                                    {t.called_at && (
                                      <div className="text-xs text-muted-foreground">
                                        Appelé à{" "}
                                        {new Date(
                                          t.called_at,
                                        ).toLocaleTimeString()}
                                      </div>
                                    )}
                                    {t.en_route_expires_at &&
                                      t.status === "en_route" && (
                                        <div className="text-xs font-medium text-amber-700 dark:text-amber-300">
                                          Priorité valable jusqu&apos;à{" "}
                                          {new Date(
                                            t.en_route_expires_at,
                                          ).toLocaleTimeString()}
                                        </div>
                                      )}
                                  </div>
                                ) : t.status === "called" ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                                    <Phone className="h-3.5 w-3.5" />
                                    En attente de réponse
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    —
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex gap-2">
                                  {/* Call button - only for waiting tickets */}
                                  <button
                                    type="button"
                                    onClick={() => callNext()}
                                    disabled={
                                      isActing || t.status !== "waiting"
                                    }
                                    className={cn(
                                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                                      isActing || t.status !== "waiting"
                                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                                        : "bg-green-600 text-white hover:bg-green-700 shadow-sm hover:shadow",
                                    )}
                                    title="Appeler ce ticket"
                                  >
                                    <Phone className="h-3.5 w-3.5" />
                                    Appeler
                                  </button>

                                  {/* Recall button - for called/absent tickets */}
                                  <button
                                    type="button"
                                    onClick={() => recall(Number(t.id))}
                                    disabled={
                                      isActing ||
                                      t.status === "waiting" ||
                                      t.status === "closed"
                                    }
                                    className={cn(
                                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                                      isActing ||
                                        t.status === "waiting" ||
                                        t.status === "closed"
                                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                                        : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow",
                                    )}
                                    title="Rappeler ce ticket"
                                  >
                                    <Volume2 className="h-3.5 w-3.5" />
                                    Rappel
                                  </button>

                                  {/* Absent button - for called tickets */}
                                  <button
                                    type="button"
                                    onClick={() => markAbsent(Number(t.id))}
                                    disabled={isActing || t.status !== "called"}
                                    className={cn(
                                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                                      isActing || t.status !== "called"
                                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                                        : "bg-orange-600 text-white hover:bg-orange-700 shadow-sm hover:shadow",
                                    )}
                                    title="Marquer comme absent"
                                  >
                                    <UserX className="h-3.5 w-3.5" />
                                    Absent
                                  </button>

                                  {/* Close button - for called tickets */}
                                  <button
                                    type="button"
                                    onClick={() => closeTicket(Number(t.id))}
                                    disabled={isActing || t.status !== "called"}
                                    className={cn(
                                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                                      isActing || t.status !== "called"
                                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                                        : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm hover:shadow",
                                    )}
                                    title="Clôturer le ticket"
                                  >
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    Servi
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center">
                <Ticket className="mr-2 text-blue-600" />
                Derniers tickets appelés
              </h2>
              {tickets.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  Affichage des {Math.min(tickets.length, 10)} derniers
                </span>
              )}
            </div>

            {tickets.length === 0 ? (
              <div className="text-center py-12 bg-muted/50 rounded-xl border-2 border-dashed border-border">
                <Ticket className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <h3 className="text-lg font-medium text-foreground">
                  Aucun ticket récent
                </h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
                  Aucun ticket n'a été appelé récemment pour ce service. Les
                  tickets apparaîtront ici en temps réel.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted">
                      <tr>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                        >
                          Détails
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                        >
                          Statut
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                        >
                          Heure
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                        >
                          Heure
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                      {tickets.map((ticket, index) => (
                        <tr
                          key={`${ticket.id}-${index}`}
                          className="hover-card transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className="text-2xl mr-3">
                                {getPriorityIcon(ticket.priority)}
                              </span>
                              <div>
                                <div className="font-bold text-foreground">
                                  {ticket.ticket_number}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  #{ticket.id}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-foreground font-medium">
                              {ticket.service_name}
                            </div>
                            {ticket.client_name && (
                              <div className="text-sm text-muted-foreground">
                                {ticket.client_name}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getPriorityColor(ticket.priority)}`}
                            >
                              {ticket.priority === "high"
                                ? "Haute priorité"
                                : ticket.priority === "vip"
                                  ? "VIP"
                                  : "Standard"}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                            <div className="font-medium">
                              {new Date(ticket.created_at).toLocaleTimeString()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(ticket.created_at).toLocaleDateString()}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="text-center mt-6 text-sm text-muted-foreground">
          <p>
            Système de gestion de file d'attente en temps réel •{" "}
            {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Queues;
