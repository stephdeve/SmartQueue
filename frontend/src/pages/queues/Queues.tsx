/**
 * Files d'attente (Agent/Admin)
 * - Sélection d'un service pour piloter la file d'attente
 * - Actions: appeler suivant, marquer absent, rappeler
 * - Écoute temps réel des évènements via Laravel Echo
 */
import React, { useEffect, useMemo, useRef, useState, type JSX } from "react";
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
  Smartphone,
  QrCode,
  UserCog,
  Monitor,
  Accessibility,
  Baby,
  HeartHandshake,
  Timer,
  Settings2,
  CalendarClock,
  CalendarCheck2,
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
  priority_reason?: string | null;
  source?: string | null;
  display_name?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  is_senior?: boolean;
  is_handicap?: boolean;
  is_pregnant?: boolean;
  en_route_at?: string | null;
  estimated_travel_minutes?: number | null;
  last_distance_m?: number | null;
  position?: number | null;
  called_at?: string | null;
  present_at?: string | null;
  response_received_at?: string | null;
  en_route_expires_at?: string | null;
  called_expires_at?: string | null;
  is_swapped?: boolean;
  deferred_at?: string | null;
  swapped_with_ticket_id?: number | null;
  auto_deferred?: boolean;
  defer_reason?: string | null;
  valid_date?: string | null;
  created_at?: string | null;
};

type DeferredTicket = {
  id: number;
  number: string;
  priority: string;
  priority_reason?: string | null;
  source?: string | null;
  display_name?: string | null;
  customer_name?: string | null;
  is_senior?: boolean;
  is_handicap?: boolean;
  is_pregnant?: boolean;
  position?: number | null;
  auto_deferred: boolean;
  defer_reason?: string | null;
  valid_date: string;
  created_at: string;
};

type DeferredDay = {
  date: string;
  count: number;
  tickets: DeferredTicket[];
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
  call_timeout_minutes?: number | null;
};

type Counter = {
  id: number;
  name: string;
  status: string;
  current_agent_id?: number | null;
};

/** Countdown hook — CORRIGÉ : meilleure gestion des dates et expiration */
function useCountdown(expiresAt?: string | null): number | null {
  const [seconds, setSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) {
      setSeconds(null);
      return;
    }

    const calc = () => {
      try {
        // Normalize MySQL-style "YYYY-MM-DD HH:MM:SS" (no TZ) to UTC ISO-8601.
        let str = expiresAt;
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(str)) {
          str = str.replace(' ', 'T') + 'Z';
        }
        const expiryDate = new Date(str);

        // Vérifier si la date est valide
        if (isNaN(expiryDate.getTime())) {
          return 0;
        }

        const now = new Date();
        const diff = expiryDate.getTime() - now.getTime();
        return Math.max(0, Math.floor(diff / 1000));
      } catch {
        return 0;
      }
    };

    setSeconds(calc());

    const id = setInterval(() => {
      setSeconds(calc());
    }, 1000);

    return () => clearInterval(id);
  }, [expiresAt]);

  return seconds;
}

function fmtCountdown(s: number): string {
  if (s <= 0) return "Expiré";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** Row countdown cell — isolated so only the row re-renders per tick */
const CountdownCell: React.FC<{ ticket: QueueTicket; onExpired?: (ticket: QueueTicket) => void }> = ({ ticket, onExpired }) => {
  const calledSeconds = useCountdown(ticket.status === "called" ? (ticket.called_expires_at ?? null) : null);
  const enRouteSeconds = useCountdown(ticket.status === "en_route" ? (ticket.en_route_expires_at ?? null) : null);

  // Keep onExpired stable via ref to avoid triggering the effect on every parent re-render
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;
  const expiredFiredRef = useRef(false);
  // Reset when a new expiry timestamp arrives (ticket recalled / re-called)
  useEffect(() => { expiredFiredRef.current = false; }, [ticket.id, ticket.called_expires_at, ticket.en_route_expires_at]);
  useEffect(() => {
    const activeSecs = ticket.status === "called" ? calledSeconds
                     : ticket.status === "en_route" ? enRouteSeconds
                     : null;
    if (activeSecs === 0 && !expiredFiredRef.current) {
      expiredFiredRef.current = true;
      onExpiredRef.current?.(ticket);
    }
  }, [calledSeconds, enRouteSeconds, ticket]);

  if (ticket.status === "called" && calledSeconds !== null) {
    const expiring = calledSeconds <= 30;
    const isExpired = calledSeconds === 0;

    if (isExpired) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white dark:bg-red-700">
          <Timer className="h-3 w-3" />
          EXPIRÉ
        </span>
      );
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${expiring ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 animate-pulse" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200"}`}>
        <Timer className="h-3 w-3" />
        {fmtCountdown(calledSeconds)}
      </span>
    );
  }

  if (ticket.status === "en_route" && enRouteSeconds !== null) {
    const expiring = enRouteSeconds <= 60;
    const isExpired = enRouteSeconds === 0;

    if (isExpired) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white dark:bg-red-700">
          <Timer className="h-3 w-3" />
          EXPIRÉ
        </span>
      );
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${expiring ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 animate-pulse" : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-200"}`}>
        <Timer className="h-3 w-3" />
        {fmtCountdown(enRouteSeconds)}
      </span>
    );
  }
  return null;
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
  const [callTimeoutMinutes, setCallTimeoutMinutes] = useState<number | null>(null);
  const [showTimeoutDialog, setShowTimeoutDialog] = useState(false);
  const [timeoutInput, setTimeoutInput] = useState("");
  const [isUpdatingTimeout, setIsUpdatingTimeout] = useState(false);
  const [queueView, setQueueView] = useState<"today" | "deferred">("today");
  const [deferredDays, setDeferredDays] = useState<DeferredDay[]>([]);
  const [deferredTotal, setDeferredTotal] = useState(0);
  const echo = getEcho();
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Default service selection from assigned services
  useEffect(() => {
    if (!serviceId && assignedServices && assignedServices.length > 0) {
      setServiceId(String(assignedServices[0].id));
    }
  }, [serviceId, assignedServices]);

  //MemoEnroute
  const enRouteCount = useMemo(
    () =>
      queue.filter(
        (ticket) =>
          (ticket.status === "en_route" || ticket.status === "present") &&
          !!ticket.en_route_at,
      ).length,
    [queue],
  );

  // Fonctions de date sécurisées - CORRECTION
  const parseDate = (date?: string | null): Date | null => {
    if (!date) return null;
    try {
      let normalized = date;
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
        normalized = normalized.replace(' ', 'T') + 'Z';
      }
      const parsedDate = new Date(normalized);
      if (isNaN(parsedDate.getTime())) return null;
      return parsedDate;
    } catch {
      return null;
    }
  };

  const formatTime = (date?: string | null): string => {
    const parsedDate = parseDate(date);
    if (!parsedDate) return "—";
    try {
      return new Intl.DateTimeFormat("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(parsedDate);
    } catch {
      return "—";
    }
  };

  const fetchService = async (id: string) => {
    const numericId = Number(id);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      throw new Error("Identifiant de service invalide");
    }
    const { data } = await api.get(`/api/services/${numericId}`);
    if (data?.call_timeout_minutes !== undefined) {
      setCallTimeoutMinutes(data.call_timeout_minutes ?? null);
    }
    return data;
  };

  const updateCallTimeout = async () => {
    if (!serviceId) return;
    const parsed = timeoutInput.trim() === "" ? null : parseInt(timeoutInput, 10);
    if (parsed !== null && (isNaN(parsed) || parsed < 1 || parsed > 60)) {
      toast.error("Valeur invalide", { description: "Le délai doit être compris entre 1 et 60 minutes." });
      return;
    }
    setIsUpdatingTimeout(true);
    try {
      await api.patch(`/api/services/${Number(serviceId)}/call-timeout`, {
        call_timeout_minutes: parsed,
      });
      setCallTimeoutMinutes(parsed);
      setShowTimeoutDialog(false);
      toast.success("Délai mis à jour", {
        description: parsed ? `Délai de priorité : ${parsed} min` : "Délai par défaut rétabli",
      });
    } catch (e: any) {
      toast.error("Erreur", { description: e?.response?.data?.message || e?.message });
    } finally {
      setIsUpdatingTimeout(false);
    }
  };

  const fetchQueue = async (id: string) => {
    const numericId = Number(id);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      throw new Error("Identifiant de service invalide");
    }
    const { data } = await api.get(`/api/services/${numericId}/queue`);
    return data;
  };

  const fetchDeferredQueue = async (id: string) => {
    const numericId = Number(id);
    if (!Number.isFinite(numericId) || numericId <= 0) return;
    try {
      const { data } = await api.get(`/api/services/${numericId}/deferred-queue`);
      setDeferredDays(data?.days ?? []);
      setDeferredTotal(data?.total ?? 0);
    } catch {
      // Non bloquant
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

  const refreshQueueAndStats = async (showToast = false) => {
    if (!serviceId) return;
    if (showToast) toast.info("Rafraîchissement en cours...");

    try {
      const [q, s] = await Promise.all([
        fetchQueue(serviceId),
        fetchStats(serviceId),
      ]);

      const queueData = Array.isArray(q?.tickets) ? q.tickets : [];
      setQueue(queueData);

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

      // CORRECTION: Extraire les tickets appelés récemment depuis la queue
      const recentCalledTickets = queueData
        .filter((t: QueueTicket) => t.status === "called" || t.status === "present")
        .slice(0, 10)
        .map((t: QueueTicket) => ({
          id: t.id,
          ticket_number: t.number,
          status: t.status,
          created_at: t.called_at || new Date().toISOString(),
          service_id: Number(serviceId),
          service_name: mapped.service_name,
          priority: t.priority || 'normal',
          client_name: t.customer_name || t.display_name || undefined,
        }));

      setTickets(recentCalledTickets);
      setLastUpdated(new Date().toLocaleTimeString());
      fetchDeferredQueue(serviceId);
      if (showToast) toast.success("Données mises à jour");
    } catch (e: any) {
      setError(e?.message || "Erreur");
      if (showToast) toast.error("Erreur lors du rafraîchissement");
    }
  };

  // Ref so CountdownCell's onExpired always sees the latest version (avoids stale closure)
  const refreshQueueRef = useRef(refreshQueueAndStats);
  useEffect(() => { refreshQueueRef.current = refreshQueueAndStats; });

  const handleCountdownExpired = (expiredTicket: QueueTicket) => {
    toast.warning(`Ticket #${expiredTicket.number} expiré`, {
      description: "Le délai de priorité est écoulé. La file est actualisée.",
      duration: 6000,
    });
    // Small delay so the backend scheduler has time to mark the ticket absent
    setTimeout(() => refreshQueueRef.current(false), 2000);
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
      toast.error("Erreur", { description: e?.response?.data?.message || e?.message });
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
      toast.success("Service ouvert");
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Erreur");
      toast.error("Erreur", { description: e?.response?.data?.message || e?.message });
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
      toast.success("Service fermé");
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Erreur");
      toast.error("Erreur", { description: e?.response?.data?.message || e?.message });
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
      toast.success("Guichet ouvert");
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Erreur");
      toast.error("Erreur", { description: e?.response?.data?.message || e?.message });
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
      toast.success("Guichet fermé");
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Erreur");
      toast.error("Erreur", { description: e?.response?.data?.message || e?.message });
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

  // Rafraîchissement automatique (polling de secours)
  useEffect(() => {
    if (!serviceId) return;

    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    refreshIntervalRef.current = setInterval(() => {
      if (serviceId && !isActing && !isLoading) {
        refreshQueueAndStats(false);
      }
    }, 10000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [serviceId, isActing, isLoading]);

  // CORRECTION 2: WebSocket avec meilleure gestion d'erreur
  useEffect(() => {
    if (!serviceId) return;

    let cancelled = false;
    let channel: any = null;

    setQueue([]);
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

        // Charger les tickets reportés
        if (!cancelled) fetchDeferredQueue(serviceId);

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

        // WebSocket connection - Utilisation de channel au lieu de join pour éviter les erreurs d'authentification
        try {
          console.log(`[Queues] Connexion au canal service.${serviceId}`);

          if (echo) {
            channel = echo.channel(`service.${serviceId}`);

            if (channel) {
              channel
                .listen('.service.ticket.called', () => {
                  if (!cancelled) refreshQueueAndStats(false);
                })
                .listen('.service.ticket.enqueued', () => {
                  if (!cancelled) refreshQueueAndStats(false);
                })
                .listen('.service.ticket.absent', () => {
                  if (!cancelled) refreshQueueAndStats(false);
                })
                .listen('.service.stats.updated', (e: any) => {
                  if (!cancelled && e.stats) setStats(e.stats);
                })
                .listen('.user.en_route', (e: any) => {
                  if (!cancelled) {
                    toast.success("Usager en route", {
                      description: e.message || `Ticket ${e.ticket_number}: confirmé`,
                      duration: 5000,
                    });
                    refreshQueueAndStats(false);
                  }
                });

              setIsConnected(true);
              console.log(`[Queues] ✓ Connecté au canal service.${serviceId}`);
              toast.success(`Connecté au service ${serviceId} en temps réel`);
            } else {
              throw new Error("Impossible de créer le canal");
            }
          } else {
            throw new Error("Echo non initialisé");
          }
        } catch (wsError) {
          console.warn("[Queues] WebSocket non disponible, mode polling actif:", wsError);
          setIsConnected(false);
          // Pas de toast d'erreur pour ne pas spammer l'utilisateur
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[Queues] Erreur:", error);
          setIsConnected(false);
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        if (channel && typeof channel.leave === 'function') {
          channel.leave();
        }
      } catch (error) {
        console.error("[Queues] Erreur nettoyage canal:", error);
      }
    };
  }, [serviceId]);

  const handleServiceIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceId.trim()) {
      toast.error("Veuillez entrer un identifiant de service");
      return;
    }
    refreshQueueAndStats(true);
  };

  // CORRECTION 3: refreshData simplifié - pas de bouton séparé
  const refreshData = () => {
    if (!serviceId) {
      toast.error("Aucun service sélectionné");
      return;
    }
    refreshQueueAndStats(true);
  };

  if (isLoading && serviceId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <div className="text-center bg-card p-8 rounded-xl shadow-lg max-w-md w-full border border-border">
          <div className="flex justify-center mb-4">
            <div className="relative h-8 w-8">
              <div className="absolute inset-0 rounded-full border-4 border-muted" />
              <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin" />
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgence":
        return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800/30";
      case "high":
        return "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800/30";
      case "vip":
        return "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-800/30";
      default:
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800/30";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgence": return "🚨";
      case "high": return "🔥";
      case "vip": return "⭐";
      default: return "📋";
    }
  };

  const SOURCE_CONFIG: Record<string, { label: string; Icon: React.FC<any> }> = {
    app: { label: "App", Icon: Smartphone },
    qr_scan: { label: "QR", Icon: QrCode },
    agent: { label: "Agent", Icon: UserCog },
    kiosk: { label: "Kiosk", Icon: Monitor },
    sms: { label: "SMS", Icon: Phone },
  };

  const ActionButton = ({ onClick, disabled, icon: Icon, children, variant = "primary" }: any) => {
    const variants = {
      primary: "bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 hover:from-blue-700 hover:to-blue-800 shadow-sm",
      secondary: "bg-gray-100 dark:bg-gray-800 text-gray-700 py-3 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700",
      danger: "bg-red-600 text-white hover:bg-red-700 py-3 shadow-sm",
      success: "bg-green-600 text-white hover:bg-green-700 py-3 shadow-sm",
      warning: "bg-amber-600 text-white hover:bg-amber-700 py-3 shadow-sm",
    };

    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
          disabled
            ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed border border-gray-200 dark:border-gray-700"
            : variants[variant]
        )}
      >
        {Icon && <Icon className="h-4 w-4" />}
        {children}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="mx-auto">
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
                  <span className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`}></span>
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
                  <ActionButton
                    onClick={() => refreshData()}
                    disabled={false}
                    icon={TrendingUp}
                    variant="primary"
                  >
                    Afficher les statistiques
                  </ActionButton>
                </div>
              </div>
            </form>

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/30 dark:bg-red-900/20 dark:text-red-200">
                {error}
              </div>
            )}

            {serviceId && (
              <div className="mt-4 flex items-center gap-4">
                <div className="flex items-center">
                  <div
                    className={`h-3 w-3 rounded-full mr-2 ${isConnected ? "bg-green-500 animate-pulse" : "bg-yellow-500"}`}
                  ></div>
                  <span className="text-sm font-medium text-foreground">
                    {isConnected
                      ? `✅ Connecté au service ${serviceId} (temps réel)`
                      : `⚠️ Mode hors ligne - mise à jour toutes les 10s`}
                  </span>
                </div>
                {/* Bouton Actualiser maintenant retiré comme demandé */}
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

          {/* File d'attente */}
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
                  <div className="flex flex-wrap gap-2">
                    <ActionButton
                      onClick={callNext}
                      disabled={!serviceId || isActing}
                      icon={Phone}
                      variant="success"
                    >
                      Appeler suivant
                    </ActionButton>
                    <ActionButton
                      onClick={openService}
                      disabled={!serviceId || isActing}
                      icon={CheckCircle}
                      variant="primary"
                    >
                      Ouvrir service
                    </ActionButton>
                    <ActionButton
                      onClick={closeService}
                      disabled={!serviceId || isActing}
                      icon={X}
                      variant="secondary"
                    >
                      Fermer service
                    </ActionButton>
                    <ActionButton
                      onClick={refreshData}
                      disabled={!serviceId || isActing}
                      icon={RefreshCw}
                      variant="secondary"
                    >
                      Rafraîchir
                    </ActionButton>
                    <ActionButton
                      onClick={() => { setTimeoutInput(callTimeoutMinutes ? String(callTimeoutMinutes) : ""); setShowTimeoutDialog(true); }}
                      disabled={!serviceId}
                      icon={Timer}
                      variant="secondary"
                    >
                      {callTimeoutMinutes ? `${callTimeoutMinutes} min` : "Délai"}
                    </ActionButton>
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
                  <ActionButton
                    onClick={openCounter}
                    disabled={!counterId || isActing}
                    icon={CheckCircle}
                    variant="primary"
                  >
                    Ouvrir guichet
                  </ActionButton>
                  <ActionButton
                    onClick={closeCounter}
                    disabled={!counterId || isActing}
                    icon={X}
                    variant="secondary"
                  >
                    Fermer guichet
                  </ActionButton>
                </div>
              </div>
            )}

            {serviceId && (
              <div className="mb-8">
                {/* Onglets File du jour / Reportés */}
                <div className="flex items-center gap-2 mb-4">
                  <button
                    onClick={() => setQueueView("today")}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
                      queueView === "today"
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-card text-foreground border-border hover:bg-muted",
                    )}
                  >
                    <CalendarCheck2 className="h-4 w-4" />
                    File du jour
                    {queue.length > 0 && (
                      <span className={cn("ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold", queueView === "today" ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground")}>
                        {queue.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setQueueView("deferred")}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
                      queueView === "deferred"
                        ? "bg-amber-600 text-white border-amber-600"
                        : "bg-card text-foreground border-border hover:bg-muted",
                    )}
                  >
                    <CalendarClock className="h-4 w-4" />
                    Reportés
                    {deferredTotal > 0 && (
                      <span className={cn("ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold", queueView === "deferred" ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300")}>
                        {deferredTotal}
                      </span>
                    )}
                  </button>
                </div>

                {/* VUE FILE DU JOUR */}
                {queueView === "today" && (queue.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-6 text-center bg-muted/40 rounded-xl border-2 border-dashed border-border">
                    Aucun ticket en attente aujourd'hui
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
                              Client
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
                          {queue.map((t) => {
                            const createdDate = parseDate(t.created_at);
                            return (
                              <tr
                                key={t.id}
                                className="hover:bg-muted/50 transition-colors"
                              >
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="font-semibold text-foreground">
                                    {t.number}
                                  </div>
                                  {t.position && (
                                    <div className="text-xs text-muted-foreground">#{t.position}</div>
                                  )}
                                  {t.created_at && (
                                    <div className="text-xs text-muted-foreground">
                                      {createdDate ? createdDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                                    </div>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  {(t.display_name || t.customer_name) ? (
                                    <div className="text-sm font-medium text-foreground">{t.display_name || t.customer_name}</div>
                                  ) : (
                                    <div className="text-xs text-muted-foreground">—</div>
                                  )}
                                  {t.source && SOURCE_CONFIG[t.source] && (
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <span title={SOURCE_CONFIG[t.source].label}>
                                        {React.createElement(SOURCE_CONFIG[t.source].Icon, { className: "h-3 w-3 text-muted-foreground" })}
                                      </span>
                                      <span className="text-xs text-muted-foreground">{SOURCE_CONFIG[t.source].label}</span>
                                    </div>
                                  )}
                                  <div className="flex gap-1 mt-0.5 flex-wrap">
                                    {t.is_senior && (
                                      <span title="Senior">
                                        <Accessibility className="h-3.5 w-3.5 text-blue-500" />
                                      </span>
                                    )}
                                    {t.is_handicap && (
                                      <span title="Handicap">
                                        <HeartHandshake className="h-3.5 w-3.5 text-purple-500" />
                                      </span>
                                    )}
                                    {t.is_pregnant && (
                                      <span title="Femme enceinte">
                                        <Baby className="h-3.5 w-3.5 text-pink-500" />
                                      </span>
                                    )}
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
                                  <div className="flex flex-col gap-1">
                                    <span
                                      className={cn(
                                        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium w-fit",
                                        t.priority === "urgence" &&
                                        "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
                                        t.priority === "vip" &&
                                        "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200",
                                        t.priority === "high" &&
                                        "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200",
                                        t.priority === "normal" &&
                                        "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
                                      )}
                                    >
                                      {t.priority === "urgence" && "🚨 Urgence"}
                                      {t.priority === "vip" && "⭐ VIP"}
                                      {t.priority === "high" && "🔥 Haute"}
                                      {t.priority === "normal" && "📋 Normal"}
                                    </span>
                                    {t.priority_reason && (
                                      <span className="text-xs text-muted-foreground">{t.priority_reason}</span>
                                    )}
                                  </div>
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
                                            ? `En route · ≈ ${t.estimated_travel_minutes} min${t.last_distance_m != null ? ` · ${(t.last_distance_m / 1000).toFixed(1)} km` : ""}`
                                            : "Présence confirmée"}
                                      </span>
                                      <div className="text-xs text-muted-foreground">
                                        Réponse reçue à{" "}
                                        {formatTime(t.response_received_at ?? t.en_route_at)}
                                      </div>
                                      {t.called_at && (
                                        <div className="text-xs text-muted-foreground">
                                          Appelé à{" "}
                                          {formatTime(t.called_at)}
                                        </div>
                                      )}
                                      {t.en_route_expires_at &&
                                        t.status === "en_route" && (
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <div className="text-xs font-medium text-amber-700 dark:text-amber-300">
                                              Priorité jusqu&apos;à {formatTime(t.en_route_expires_at)}
                                            </div>
                                            <CountdownCell ticket={t} onExpired={handleCountdownExpired} />
                                          </div>
                                        )}
                                    </div>
                                  ) : t.status === "called" ? (
                                    <div className="space-y-1">
                                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                                        <Phone className="h-3.5 w-3.5" />
                                        En attente de réponse
                                      </span>
                                      <div className="flex items-center gap-1">
                                        <CountdownCell ticket={t} onExpired={handleCountdownExpired} />
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      —
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => callNext()}
                                      disabled={isActing || t.status !== "waiting"}
                                      className={cn(
                                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                                        isActing || t.status !== "waiting"
                                          ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
                                          : "bg-green-600 text-white hover:bg-green-700 shadow-sm"
                                      )}
                                      title="Appeler ce ticket"
                                    >
                                      <Phone className="h-3.5 w-3.5" />
                                      Appeler
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => recall(Number(t.id))}
                                      disabled={isActing || t.status === "waiting" || t.status === "closed"}
                                      className={cn(
                                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                                        isActing || t.status === "waiting" || t.status === "closed"
                                          ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
                                          : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                                      )}
                                      title="Rappeler ce ticket"
                                    >
                                      <Volume2 className="h-3.5 w-3.5" />
                                      Rappel
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => markAbsent(Number(t.id))}
                                      disabled={isActing || t.status !== "called"}
                                      className={cn(
                                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                                        isActing || t.status !== "called"
                                          ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
                                          : "bg-orange-600 text-white hover:bg-orange-700 shadow-sm"
                                      )}
                                      title="Marquer comme absent"
                                    >
                                      <UserX className="h-3.5 w-3.5" />
                                      Absent
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => closeTicket(Number(t.id))}
                                      disabled={isActing || t.status !== "called"}
                                      className={cn(
                                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                                        isActing || t.status !== "called"
                                          ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
                                          : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                                      )}
                                      title="Clôturer le ticket"
                                    >
                                      <CheckCircle className="h-3.5 w-3.5" />
                                      Servi
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

                {/* VUE TICKETS REPORTÉS */}
                {queueView === "deferred" && (
                  deferredDays.length === 0 ? (
                    <div className="py-10 text-center bg-muted/40 rounded-xl border-2 border-dashed border-border">
                      <CalendarClock className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
                      <p className="text-sm font-medium text-foreground">Aucun ticket reporté</p>
                      <p className="text-xs text-muted-foreground mt-1">Les tickets créés hors horaires apparaîtront ici.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {deferredDays.map((day) => (
                        <div key={day.date} className="rounded-xl border border-amber-200 dark:border-amber-900/40 overflow-hidden">
                          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-900/40">
                            <CalendarClock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                              {new Date(day.date + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" })}
                            </span>
                            <span className="ml-auto text-xs font-bold bg-amber-200 dark:bg-amber-800/50 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full">
                              {day.count} ticket{day.count > 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-border">
                              <thead className="bg-muted/60">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Ticket</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Client</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Priorité</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Source</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Créé le</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Raison</th>
                                </tr>
                              </thead>
                              <tbody className="bg-card divide-y divide-border">
                                {day.tickets.map((t) => {
                                  const createdDate = parseDate(t.created_at);
                                  return (
                                    <tr key={t.id} className="hover:bg-amber-50/40 dark:hover:bg-amber-900/10 transition-colors">
                                      <td className="px-4 py-3">
                                        <div className="font-bold text-foreground">{t.number}</div>
                                        {t.position && <div className="text-xs text-muted-foreground">#{t.position}</div>}
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="text-sm text-foreground">{t.display_name ?? t.customer_name ?? "—"}</div>
                                        <div className="flex gap-1 mt-0.5">
                                          {t.is_senior && (
                                            <span title="Senior">
                                              <Accessibility className="h-3 w-3 text-blue-500" />
                                            </span>
                                          )}
                                          {t.is_handicap && (
                                            <span title="Handicap">
                                              <HeartHandshake className="h-3 w-3 text-purple-500" />
                                            </span>
                                          )}
                                          {t.is_pregnant && (
                                            <span title="Femme enceinte">
                                              <Baby className="h-3 w-3 text-pink-500" />
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                                          t.priority === "urgence" && "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
                                          t.priority === "vip" && "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200",
                                          t.priority === "high" && "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200",
                                          t.priority === "normal" && "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
                                        )}>
                                          {t.priority === "urgence" ? "🚨 Urgence" : t.priority === "vip" ? "⭐ VIP" : t.priority === "high" ? "🔥 Prioritaire" : "Normal"}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3">
                                        {t.source && SOURCE_CONFIG[t.source] ? (
                                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <span title={SOURCE_CONFIG[t.source].label}>
                                              {React.createElement(SOURCE_CONFIG[t.source].Icon, { className: "h-3 w-3" })}
                                            </span>
                                            {SOURCE_CONFIG[t.source].label}
                                          </div>
                                        ) : <span className="text-xs text-muted-foreground">—</span>}
                                      </td>
                                      <td className="px-4 py-3 text-xs text-muted-foreground">
                                        {createdDate ? createdDate.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                          <CalendarClock className="h-3 w-3" />
                                          {t.defer_reason === "past_cutoff" ? "Hors délai" :
                                            t.defer_reason === "non_working_day" ? "Jour non ouvrable" :
                                              t.defer_reason === "holiday" ? "Jour férié" :
                                                t.defer_reason === "critical_zone" ? "Zone critique" :
                                                  t.defer_reason === "exceptional_closure" ? "Fermeture exceptionnelle" :
                                                    t.defer_reason === "outside_hours" ? "Hors horaires" :
                                                      "Reporté automatiquement"}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
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
                  Aucun ticket n'a été appelé récemment pour ce service.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Détails
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Service
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Priorité
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Heure
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                      {tickets.map((ticket, index) => {
                        const createdDate = parseDate(ticket.created_at);
                        return (
                          <tr
                            key={`${ticket.id}-${index}`}
                            className="hover:bg-muted/50 transition-colors"
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
                                {ticket.priority === "urgence"
                                  ? "🚨 Urgence"
                                  : ticket.priority === "high"
                                    ? "Haute priorité"
                                    : ticket.priority === "vip"
                                      ? "VIP"
                                      : "Standard"}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                              <div className="font-medium">
                                {createdDate ? createdDate.toLocaleTimeString() : "—"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {createdDate ? createdDate.toLocaleDateString() : "—"}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
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

      {/* Dialog de configuration du délai de priorité */}
      {showTimeoutDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowTimeoutDialog(false)}>
          <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600">
                <Timer className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Délai de priorité</h3>
                <p className="text-xs text-muted-foreground">Durée avant marquage absent automatique</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Après l'appel d'un ticket, l'usager dispose de ce délai pour se présenter. Passé ce délai, il est automatiquement marqué absent.
            </p>
            <div className="relative mb-2">
              <input
                type="number"
                min={1}
                max={60}
                value={timeoutInput}
                onChange={(e) => setTimeoutInput(e.target.value)}
                placeholder="10 min par défaut"
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-xl font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 pr-16"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">min</span>
            </div>
            <p className="text-xs text-muted-foreground mb-6">Laissez vide pour la valeur par défaut · Entre 1 et 60 minutes</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowTimeoutDialog(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={updateCallTimeout}
                disabled={isUpdatingTimeout}
                className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                {isUpdatingTimeout ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Queues;