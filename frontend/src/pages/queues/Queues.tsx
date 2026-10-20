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
  Search,
  Filter,
  History,
  Clock,
  UserCircle,
  BarChart3,
  Info,
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
  deferral_count?: number;
  absent_level?: number;
  absent_expires_at?: string | null;
  max_call_attempts?: number;
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
        let str = expiresAt;
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(str)) {
          str = str.replace(" ", "T") + "Z";
        }
        const expiryDate = new Date(str);
        if (isNaN(expiryDate.getTime())) return 0;
        const now = new Date();
        const diff = expiryDate.getTime() - now.getTime();
        return Math.max(0, Math.floor(diff / 1000));
      } catch {
        return 0;
      }
    };

    setSeconds(calc());
    const id = setInterval(() => setSeconds(calc()), 1000);
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

/** Row countdown cell */
const CountdownCell: React.FC<{
  ticket: QueueTicket;
  onExpired?: (ticket: QueueTicket) => void;
}> = ({ ticket, onExpired }) => {
  const calledSeconds = useCountdown(
    ticket.status === "called" ? (ticket.called_expires_at ?? null) : null,
  );
  const enRouteSeconds = useCountdown(
    ticket.status === "en_route" ? (ticket.en_route_expires_at ?? null) : null,
  );

  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;
  const expiredFiredRef = useRef(false);

  useEffect(() => {
    expiredFiredRef.current = false;
  }, [ticket.id, ticket.called_expires_at, ticket.en_route_expires_at]);

  useEffect(() => {
    const activeSecs =
      ticket.status === "called"
        ? calledSeconds
        : ticket.status === "en_route"
          ? enRouteSeconds
          : null;
    if (activeSecs === 0 && !expiredFiredRef.current) {
      expiredFiredRef.current = true;
      onExpiredRef.current?.(ticket);
    }
  }, [calledSeconds, enRouteSeconds, ticket]);

  if (ticket.status === "called" && calledSeconds === null) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300 animate-pulse">
        <Timer className="h-3 w-3" />…
      </span>
    );
  }

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
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${expiring ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 animate-pulse" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200"}`}
      >
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
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${expiring ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 animate-pulse" : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-200"}`}
      >
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
  const [callTimeoutMinutes, setCallTimeoutMinutes] = useState<number | null>(
    null,
  );
  const [maxCallAttempts, setMaxCallAttempts] = useState<number>(2);
  const [enRouteGraceMinutes, setEnRouteGraceMinutes] = useState<number>(10);
  const [showTimeoutDialog, setShowTimeoutDialog] = useState(false);
  const [timeoutInput, setTimeoutInput] = useState("");
  const [maxAttemptsInput, setMaxAttemptsInput] = useState("");
  const [graceInput, setGraceInput] = useState("");
  const [isUpdatingTimeout, setIsUpdatingTimeout] = useState(false);
  const [queueView, setQueueView] = useState<"today" | "deferred">("today");
  const [deferredDays, setDeferredDays] = useState<DeferredDay[]>([]);
  const [deferredTotal, setDeferredTotal] = useState(0);
  const echo = getEcho();
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Recherche + Filtres
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Profil client
  const [clientProfileTicket, setClientProfileTicket] =
    useState<QueueTicket | null>(null);
  const [clientProfileData, setClientProfileData] = useState<any>(null);
  const [clientProfileLoading, setClientProfileLoading] = useState(false);

  // Fil d'activité
  type ActivityEvent = {
    id: string;
    type: string;
    ticket_number: string;
    message: string;
    timestamp: Date;
    status?: string;
  };
  const [activities, setActivities] = useState<ActivityEvent[]>([]);

  // Récupérer le nom du service sélectionné
  const selectedServiceName = useMemo(() => {
    if (!serviceId) return null;
    if (assignedServices && assignedServices.length > 0) {
      const found = assignedServices.find((s) => String(s.id) === serviceId);
      if (found) return found.name;
    }
    return stats?.service_name || `Service ${serviceId}`;
  }, [serviceId, assignedServices, stats]);

  // Default service selection from assigned services
  useEffect(() => {
    if (!serviceId && assignedServices && assignedServices.length > 0) {
      setServiceId(String(assignedServices[0].id));
    }
  }, [serviceId, assignedServices]);

  const enRouteCount = useMemo(
    () =>
      queue.filter(
        (ticket) =>
          (ticket.status === "en_route" || ticket.status === "present") &&
          !!ticket.en_route_at,
      ).length,
    [queue],
  );

  const parseDate = (date?: string | null): Date | null => {
    if (!date) return null;
    try {
      let normalized = date;
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
        normalized = normalized.replace(" ", "T") + "Z";
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
    if (data?.max_call_attempts != null)
      setMaxCallAttempts(Number(data.max_call_attempts));
    if (data?.en_route_grace_minutes != null)
      setEnRouteGraceMinutes(Number(data.en_route_grace_minutes));
    // Sync input fields with actual DB values
    setTimeoutInput(
      data?.call_timeout_minutes !== undefined
        ? String(data.call_timeout_minutes ?? "")
        : "",
    );
    setMaxAttemptsInput(
      data?.max_call_attempts != null ? String(data.max_call_attempts) : "2",
    );
    setGraceInput(
      data?.en_route_grace_minutes != null
        ? String(data.en_route_grace_minutes)
        : "10",
    );
    return data;
  };

  const updateCallTimeout = async () => {
    if (!serviceId) return;

    // Délai de priorité (vide = valeur par défaut)
    const parsedTimeout =
      timeoutInput.trim() === "" ? null : parseInt(timeoutInput, 10);
    if (
      parsedTimeout !== null &&
      (isNaN(parsedTimeout) || parsedTimeout < 1 || parsedTimeout > 60)
    ) {
      toast.error("Valeur invalide", {
        description:
          "Le délai de priorité doit être compris entre 1 et 60 minutes.",
      });
      return;
    }

    // Délai de présentation (en route → présent)
    const parsedGrace =
      graceInput.trim() === "" ? enRouteGraceMinutes : parseInt(graceInput, 10);
    if (isNaN(parsedGrace) || parsedGrace < 1 || parsedGrace > 60) {
      toast.error("Valeur invalide", {
        description:
          "Le délai de présentation doit être compris entre 1 et 60 minutes.",
      });
      return;
    }

    // Nombre de tentatives max (absences avant expiration définitive)
    const parsedAttempts =
      maxAttemptsInput.trim() === ""
        ? maxCallAttempts
        : parseInt(maxAttemptsInput, 10);
    if (isNaN(parsedAttempts) || parsedAttempts < 1 || parsedAttempts > 10) {
      toast.error("Valeur invalide", {
        description: "Le nombre de tentatives doit être compris entre 1 et 10.",
      });
      return;
    }

    setIsUpdatingTimeout(true);
    try {
      await api.patch(`/api/services/${Number(serviceId)}/call-timeout`, {
        call_timeout_minutes: parsedTimeout,
        en_route_grace_minutes: parsedGrace,
        max_call_attempts: parsedAttempts,
      });
      setCallTimeoutMinutes(parsedTimeout);
      setEnRouteGraceMinutes(parsedGrace);
      setMaxCallAttempts(parsedAttempts);
      setShowTimeoutDialog(false);
      toast.success("Paramètres mis à jour", {
        description: `Priorité : ${parsedTimeout ?? "défaut"} · Présentation : ${parsedGrace} min · Tentatives : ${parsedAttempts}`,
      });
      // Recharge la file pour propager max_call_attempts sur les boutons des tickets
      await refreshQueueAndStats(false);
    } catch (e: any) {
      toast.error("Erreur", {
        description: e?.response?.data?.message || e?.message,
      });
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
      const { data } = await api.get(
        `/api/services/${numericId}/deferred-queue`,
      );
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

  // Dans refreshQueueAndStats et dans le WebSocket, corrige le mapping :

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
        // CORRECTION: Récupère le nom du service depuis plusieurs sources possibles
        service_name: String(
          s?.service?.name || // Si la réponse a une propriété service avec name
            s?.name || // Si la réponse a directement un name
            s?.service_name || // Si la réponse a service_name
            assignedServices?.find((srv) => String(srv.id) === serviceId)
              ?.name || // Depuis les services assignés
            `Service ${serviceId}`, // Fallback
        ),
        waiting: Number(s?.people ?? s?.waiting ?? 0),
        processed: Number(s?.processed ?? 0),
        average_wait_time: String(s?.eta_avg ?? s?.average_wait_time ?? "—"),
      };
      setStats(mapped);

      const recentCalledTickets = queueData
        .filter(
          (t: QueueTicket) => t.status === "called" || t.status === "present",
        )
        .slice(0, 10)
        .map((t: QueueTicket) => ({
          id: t.id,
          ticket_number: t.number,
          status: t.status,
          created_at: t.called_at || new Date().toISOString(),
          service_id: Number(serviceId),
          service_name: mapped.service_name,
          priority: t.priority || "normal",
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

  // Mettre à jour le nom du service dans stats quand assignedServices change
  useEffect(() => {
    if (stats && assignedServices && serviceId) {
      const found = assignedServices.find((s) => String(s.id) === serviceId);
      if (found && found.name !== stats.service_name) {
        setStats((prev) =>
          prev ? { ...prev, service_name: found.name } : null,
        );
      }
    }
  }, [assignedServices, serviceId, stats]);

  const refreshQueueRef = useRef(refreshQueueAndStats);
  useEffect(() => {
    refreshQueueRef.current = refreshQueueAndStats;
  });

  const handleCountdownExpired = (expiredTicket: QueueTicket) => {
    toast.warning(`Ticket #${expiredTicket.number} expiré`, {
      description: "Le délai de priorité est écoulé. La file est actualisée.",
      duration: 6000,
    });
    setTimeout(() => refreshQueueRef.current(false), 2000);
  };

  const callNext = async () => {
    if (!serviceId) return;
    setIsActing(true);
    setError("");
    try {
      const numericCounterId = counterId ? Number(counterId) : null;
      const res = await api.post(`/api/services/${Number(serviceId)}/call-next`, {
        counter_id: numericCounterId,
      });
      if (res.status === 204) {
        toast.info("Aucun ticket en attente à appeler");
      } else if (res.data?.called_ticket?.number) {
        toast.success(`Ticket ${res.data.called_ticket.number} appelé`);
      }
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
      toast.error("Erreur", {
        description: e?.response?.data?.message || e?.message,
      });
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
      toast.error("Erreur", {
        description: e?.response?.data?.message || e?.message,
      });
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
      toast.error("Erreur", {
        description: e?.response?.data?.message || e?.message,
      });
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
      toast.error("Erreur", {
        description: e?.response?.data?.message || e?.message,
      });
    } finally {
      setIsActing(false);
    }
  };

  const markAbsent = async (ticket: QueueTicket) => {
    setIsActing(true);
    setError("");
    try {
      const { data } = await api.post(`/api/tickets/${ticket.id}/mark-absent`);
      const level = data?.absent_level ?? 1;
      const maxAttempts = ticket.max_call_attempts ?? 2;
      if (level < maxAttempts) {
        toast.warning(
          `Ticket #${ticket.number} — Absence ${level}/${maxAttempts}`,
          {
            description:
              level === 1
                ? "L'usager est absent. Vous pouvez le rappeler, ou cliquer à nouveau sur Absent pour une absence définitive."
                : `L'usager est absent (${level}/${maxAttempts}). Rappel possible.`,
            duration: 6000,
          },
        );
      } else {
        toast.error(`Ticket #${ticket.number} — Absence définitive`, {
          description:
            "Expiration automatique programmée. Le ticket sera supprimé à l'issue du délai.",
          duration: 7000,
        });
      }
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
    if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    refreshIntervalRef.current = setInterval(() => {
      if (serviceId && !isActing && !isLoading) refreshQueueAndStats(false);
    }, 10000);
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [serviceId, isActing, isLoading]);

  // WebSocket
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

        try {
          const q = await fetchQueue(serviceId);
          if (!cancelled) setQueue(Array.isArray(q?.tickets) ? q.tickets : []);
        } catch (e: any) {
          if (!cancelled) setError(e?.message || "Erreur");
        }

        if (!cancelled) fetchDeferredQueue(serviceId);

        try {
          const s = await fetchStats(serviceId);
          if (!cancelled) {
            setStats({
              service_id: Number(serviceId),
              service_name: String(
                s?.service?.name || s?.service_name || `Service ${serviceId}`,
              ),
              waiting: Number(s?.people ?? s?.waiting ?? 0),
              processed: Number(s?.processed ?? 0),
              average_wait_time: String(
                s?.eta_avg ?? s?.average_wait_time ?? "—",
              ),
            });
          }
        } catch (e: any) {
          console.warn("Erreur chargement stats initiales:", e);
        }

        if (!cancelled) setIsLoading(false);

        try {
          console.log(`[Queues] Connexion au canal service.${serviceId}`);
          if (echo) {
            // Canal de présence : le backend diffuse sur presence-service.{id}
            channel = echo.join(`service.${serviceId}`);
            if (channel) {
              channel
                .listen(".service.ticket.called", (e: any) => {
                  if (!cancelled) {
                    refreshQueueAndStats(false);
                    addActivity("called", e?.ticket_number || "?", "Appelé");
                  }
                })
                .listen(".service.ticket.enqueued", (e: any) => {
                  if (!cancelled) {
                    refreshQueueAndStats(false);
                    addActivity(
                      "enqueued",
                      e?.ticket_number || "?",
                      "Nouveau ticket en file",
                    );
                  }
                })
                .listen(".service.ticket.absent", (e: any) => {
                  if (!cancelled) {
                    refreshQueueAndStats(false);
                    const level = e?.absent_level ?? 1;
                    const max = e?.max_call_attempts ?? 2;
                    addActivity(
                      "absent",
                      e?.ticket_number || "?",
                      level >= max
                        ? "Absence définitive"
                        : "Absence temporaire",
                    );
                  }
                })
                .listen(".service.stats.updated", (e: any) => {
                  // Payload : { waiting_count }
                  if (!cancelled && e?.waiting_count != null) {
                    setStats((prev: any) =>
                      prev ? { ...prev, waiting: Number(e.waiting_count) } : prev,
                    );
                  }
                })
                .listen(".user.en_route", (e: any) => {
                  if (!cancelled) {
                    toast.success("Usager en route", {
                      description:
                        e.message || `Ticket ${e.ticket_number}: confirmé`,
                      duration: 5000,
                    });
                    refreshQueueAndStats(false);
                    addActivity(
                      "en_route",
                      e?.ticket_number || "?",
                      "En route vers le guichet",
                    );
                  }
                })
                .listen(".service.ticket.served", (e: any) => {
                  if (!cancelled) {
                    refreshQueueAndStats(false);
                    addActivity(
                      "closed",
                      e?.ticket_number || "?",
                      "Servi / Clôturé",
                    );
                  }
                })
                .listen(".ServiceConfigUpdated", (e: any) => {
                  if (!cancelled) {
                    if (e?.call_timeout_minutes !== undefined)
                      setCallTimeoutMinutes(e.call_timeout_minutes);
                    if (e?.max_call_attempts != null)
                      setMaxCallAttempts(Number(e.max_call_attempts));
                    if (e?.en_route_grace_minutes != null)
                      setEnRouteGraceMinutes(Number(e.en_route_grace_minutes));
                    // Also update the input fields if the dialog is open
                    setTimeoutInput(
                      e?.call_timeout_minutes !== undefined
                        ? String(e.call_timeout_minutes ?? "")
                        : timeoutInput,
                    );
                    setMaxAttemptsInput(
                      e?.max_call_attempts != null
                        ? String(e.max_call_attempts)
                        : maxAttemptsInput,
                    );
                    setGraceInput(
                      e?.en_route_grace_minutes != null
                        ? String(e.en_route_grace_minutes)
                        : graceInput,
                    );
                    toast.success("Configuration mise à jour", {
                      description: `Délai priorité: ${e.call_timeout_minutes ?? "défaut"} · Tentatives: ${e.max_call_attempts} · Présentation: ${e.en_route_grace_minutes} min`,
                      duration: 3000,
                    });
                  }
                });
              setIsConnected(true);
              console.log(`[Queues] ✓ Connecté au canal service.${serviceId}`);
              toast.success(
                `Connecté au service ${selectedServiceName || serviceId} en temps réel`,
              );
            } else {
              throw new Error("Impossible de créer le canal");
            }
          } else {
            throw new Error("Echo non initialisé");
          }
        } catch (wsError) {
          console.warn(
            "[Queues] WebSocket non disponible, mode polling actif:",
            wsError,
          );
          setIsConnected(false);
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
        // Les objets canal n'ont pas de méthode leave() : quitter via l'instance Echo
        if (channel && echo) echo.leave(`service.${serviceId}`);
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

  const fetchClientProfile = async (ticket: QueueTicket) => {
    setClientProfileTicket(ticket);
    setClientProfileLoading(true);
    setClientProfileData(null);
    try {
      const { data } = await api.get(
        `/api/tickets/${ticket.id}/client-profile`,
      );
      setClientProfileData(data);
    } catch (e: any) {
      toast.error("Erreur", {
        description: e?.response?.data?.message || e?.message,
      });
    } finally {
      setClientProfileLoading(false);
    }
  };

  // File filtrée (recherche + status + priorité)
  const filteredQueue = useMemo(() => {
    let items = queue;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (t) =>
          t.number.toLowerCase().includes(q) ||
          (t.customer_name || "").toLowerCase().includes(q) ||
          (t.customer_phone || "").toLowerCase().includes(q) ||
          (t.display_name || "").toLowerCase().includes(q),
      );
    }
    if (statusFilter.length > 0) {
      items = items.filter((t) => statusFilter.includes(t.status));
    }
    if (priorityFilter.length > 0) {
      items = items.filter((t) => priorityFilter.includes(t.priority));
    }
    return items;
  }, [queue, searchQuery, statusFilter, priorityFilter]);

  // Ajouter une activité
  const addActivity = (type: string, ticketNumber: string, message: string) => {
    setActivities((prev) => {
      const event: ActivityEvent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        ticket_number: ticketNumber,
        message,
        timestamp: new Date(),
      };
      const updated = [event, ...prev];
      if (updated.length > 200) return updated.slice(0, 200);
      return updated;
    });
  };

  const refreshData = () => {
    if (!serviceId) {
      toast.error("Aucun service sélectionné");
      return;
    }
    refreshQueueAndStats(true);
  };

  // Message de chargement amélioré avec nom du service
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
            Connexion au service{" "}
            <span className="font-semibold">
              {selectedServiceName || serviceId}
            </span>
            ...
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
      case "urgence":
        return "🚨";
      case "high":
        return "🔥";
      case "vip":
        return "⭐";
      default:
        return "📋";
    }
  };

  const SOURCE_CONFIG: Record<string, { label: string; Icon: React.FC<any> }> =
    {
      app: { label: "App", Icon: Smartphone },
      qr_scan: { label: "QR", Icon: QrCode },
      agent: { label: "Agent", Icon: UserCog },
      kiosk: { label: "Kiosk", Icon: Monitor },
      sms: { label: "SMS", Icon: Phone },
    };

  const ActionButton = ({
    onClick,
    disabled,
    icon: Icon,
    children,
    variant = "primary",
  }: any) => {
    const variants = {
      primary:
        "bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 hover:from-blue-700 hover:to-blue-800 shadow-sm",
      secondary:
        "bg-gray-100 dark:bg-gray-800 text-gray-700 py-3 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700",
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
            : variants[variant],
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
                  <span
                    className={`w-2 h-2 rounded-full mr-2 ${isConnected ? "bg-green-400 animate-pulse" : "bg-yellow-400"}`}
                  ></span>
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
                            {s.name} (
                            {s.status === "open" ? "🟢 Ouvert" : "🔴 Fermé"})
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
                      ? `✅ Connecté au service ${selectedServiceName || serviceId} (temps réel)`
                      : `⚠️ Mode hors ligne - mise à jour toutes les 10s`}
                  </span>
                </div>
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
                {/* Barre de recherche + Filtres */}
                <div className="mb-4 space-y-3">
                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Rechercher par n° ticket, nom ou téléphone…"
                        className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={cn(
                        "inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
                        showFilters
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-card text-foreground border-border hover:bg-muted",
                      )}
                    >
                      <Filter className="h-4 w-4" />
                      Filtres
                      {(statusFilter.length > 0 ||
                        priorityFilter.length > 0) && (
                        <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-500 text-white text-xs font-bold">
                          {statusFilter.length + priorityFilter.length}
                        </span>
                      )}
                    </button>
                  </div>
                  {showFilters && (
                    <div className="flex flex-col md:flex-row gap-4 p-4 rounded-lg border border-border bg-muted/30">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                          Statut
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {[
                            "waiting",
                            "called",
                            "en_route",
                            "present",
                            "absent",
                          ].map((s) => (
                            <button
                              key={s}
                              onClick={() =>
                                setStatusFilter((prev) =>
                                  prev.includes(s)
                                    ? prev.filter((v) => v !== s)
                                    : [...prev, s],
                                )
                              }
                              className={cn(
                                "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                                statusFilter.includes(s)
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "bg-card text-muted-foreground border-border hover:bg-muted",
                              )}
                            >
                              {s === "waiting"
                                ? "En attente"
                                : s === "called"
                                  ? "Appelé"
                                  : s === "en_route"
                                    ? "En route"
                                    : s === "present"
                                      ? "Présent"
                                      : "Absent"}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                          Priorité
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {["normal", "high", "vip", "urgence"].map((p) => (
                            <button
                              key={p}
                              onClick={() =>
                                setPriorityFilter((prev) =>
                                  prev.includes(p)
                                    ? prev.filter((v) => v !== p)
                                    : [...prev, p],
                                )
                              }
                              className={cn(
                                "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                                priorityFilter.includes(p)
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "bg-card text-muted-foreground border-border hover:bg-muted",
                              )}
                            >
                              {p === "urgence"
                                ? "🚨 Urgence"
                                : p === "vip"
                                  ? "⭐ VIP"
                                  : p === "high"
                                    ? "🔥 Haute"
                                    : "📋 Normal"}
                            </button>
                          ))}
                        </div>
                      </div>
                      {(statusFilter.length > 0 ||
                        priorityFilter.length > 0) && (
                        <button
                          onClick={() => {
                            setStatusFilter([]);
                            setPriorityFilter([]);
                          }}
                          className="text-xs text-red-600 hover:text-red-700 font-medium self-end"
                        >
                          Réinitialiser les filtres
                        </button>
                      )}
                    </div>
                  )}
                </div>

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
                      onClick={() => {
                        setTimeoutInput(
                          callTimeoutMinutes ? String(callTimeoutMinutes) : "",
                        );
                        setMaxAttemptsInput(String(maxCallAttempts));
                        setGraceInput(String(enRouteGraceMinutes));
                        setShowTimeoutDialog(true);
                      }}
                      disabled={!serviceId}
                      icon={Settings2}
                      variant="secondary"
                    >
                      {callTimeoutMinutes
                        ? `${callTimeoutMinutes} min`
                        : "Délais"}
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
                      <span
                        className={cn(
                          "ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold",
                          queueView === "today"
                            ? "bg-blue-500 text-white"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
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
                      <span
                        className={cn(
                          "ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold",
                          queueView === "deferred"
                            ? "bg-amber-500 text-white"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
                        )}
                      >
                        {deferredTotal}
                      </span>
                    )}
                  </button>
                </div>

                {/* VUE FILE DU JOUR */}
                {queueView === "today" &&
                  (queue.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-6 text-center bg-muted/40 rounded-xl border-2 border-dashed border-border">
                      Aucun ticket en attente aujourd'hui
                    </div>
                  ) : filteredQueue.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-6 text-center bg-muted/40 rounded-xl border-2 border-dashed border-border">
                      Aucun ticket ne correspond aux filtres sélectionnés
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
                                Tentatives
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
                            {filteredQueue.map((t) => {
                              const createdDate = parseDate(t.created_at);
                              return (
                                <tr
                                  key={t.id}
                                  className="hover:bg-muted/50 transition-colors cursor-pointer"
                                  onClick={() => fetchClientProfile(t)}
                                >
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="font-semibold text-foreground">
                                      {t.number}
                                    </div>
                                    {t.position && (
                                      <div className="text-xs text-muted-foreground">
                                        #{t.position}
                                      </div>
                                    )}
                                    {t.created_at && (
                                      <div className="text-xs text-muted-foreground">
                                        {createdDate
                                          ? createdDate.toLocaleTimeString(
                                              "fr-FR",
                                              {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                              },
                                            )
                                          : "—"}
                                      </div>
                                    )}
                                    {t.absent_level != null &&
                                      t.absent_level > 0 && (
                                        <div
                                          className={cn(
                                            "text-xs font-medium mt-1",
                                            t.absent_level >=
                                              (t.max_call_attempts ?? 2)
                                              ? "text-red-600 dark:text-red-400"
                                              : "text-amber-600 dark:text-amber-400",
                                          )}
                                        >
                                          Absence {t.absent_level}/
                                          {t.max_call_attempts ?? 2}
                                          {t.absent_level >=
                                            (t.max_call_attempts ?? 2) &&
                                            t.absent_expires_at && (
                                              <span className="ml-1">
                                                — Expiration auto
                                              </span>
                                            )}
                                        </div>
                                      )}
                                    {t.absent_level == null &&
                                      t.deferral_count != null &&
                                      t.deferral_count > 0 && (
                                        <div className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-1">
                                          Rappel {t.deferral_count}/
                                          {t.max_call_attempts ?? 2}
                                        </div>
                                      )}
                                  </td>
                                  <td className="px-6 py-4">
                                    {t.display_name || t.customer_name ? (
                                      <div className="text-sm font-medium text-foreground">
                                        {t.display_name || t.customer_name}
                                      </div>
                                    ) : (
                                      <div className="text-xs text-muted-foreground">
                                        —
                                      </div>
                                    )}
                                    {t.source && SOURCE_CONFIG[t.source] && (
                                      <div className="flex items-center gap-1 mt-0.5">
                                        <span
                                          title={SOURCE_CONFIG[t.source].label}
                                        >
                                          {React.createElement(
                                            SOURCE_CONFIG[t.source].Icon,
                                            {
                                              className:
                                                "h-3 w-3 text-muted-foreground",
                                            },
                                          )}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          {SOURCE_CONFIG[t.source].label}
                                        </span>
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
                                      {t.status === "absent" &&
                                        (t.absent_level != null &&
                                        t.absent_level >=
                                          (t.max_call_attempts ?? 2)
                                          ? "Absent définitif"
                                          : "Absent (rappel)")}
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
                                        {t.priority === "urgence" &&
                                          "🚨 Urgence"}
                                        {t.priority === "vip" && "⭐ VIP"}
                                        {t.priority === "high" && "🔥 Haute"}
                                        {t.priority === "normal" && "📋 Normal"}
                                      </span>
                                      {t.priority_reason && (
                                        <span className="text-xs text-muted-foreground">
                                          {t.priority_reason}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    {(() => {
                                      const maxAtt = t.max_call_attempts ?? 2;
                                      const used =
                                        t.absent_level ??
                                        (t.status === "absent" ? 1 : 0);
                                      const remaining = Math.max(
                                        0,
                                        maxAtt - used,
                                      );
                                      const isDefinitive =
                                        t.status === "absent" && used >= maxAtt;
                                      const isLastChance =
                                        !isDefinitive && remaining <= 1;
                                      return (
                                        <span
                                          className={cn(
                                            "font-medium",
                                            isDefinitive
                                              ? "text-red-600 dark:text-red-400"
                                              : isLastChance
                                                ? "text-amber-600 dark:text-amber-400"
                                                : "text-muted-foreground",
                                          )}
                                        >
                                          {isDefinitive
                                            ? "Absence définitive"
                                            : isLastChance
                                              ? "Dernière tentative"
                                              : "Rappel disponible"}
                                        </span>
                                      );
                                    })()}
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
                                          {formatTime(
                                            t.response_received_at ??
                                              t.en_route_at,
                                          )}
                                        </div>
                                        {t.called_at && (
                                          <div className="text-xs text-muted-foreground">
                                            Appelé à {formatTime(t.called_at)}
                                          </div>
                                        )}
                                        {t.en_route_expires_at &&
                                          t.status === "en_route" && (
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <div className="text-xs font-medium text-amber-700 dark:text-amber-300">
                                                Priorité jusqu&apos;à{" "}
                                                {formatTime(
                                                  t.en_route_expires_at,
                                                )}
                                              </div>
                                              <CountdownCell
                                                ticket={t}
                                                onExpired={
                                                  handleCountdownExpired
                                                }
                                              />
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
                                          <CountdownCell
                                            ticket={t}
                                            onExpired={handleCountdownExpired}
                                          />
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
                                        disabled={
                                          isActing || t.status !== "waiting"
                                        }
                                        className={cn(
                                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                                          isActing || t.status !== "waiting"
                                            ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
                                            : "bg-green-600 text-white hover:bg-green-700 shadow-sm",
                                        )}
                                        title="Appeler ce ticket"
                                      >
                                        <Phone className="h-3.5 w-3.5" />
                                        Appeler
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => recall(Number(t.id))}
                                        disabled={
                                          isActing ||
                                          t.status === "waiting" ||
                                          t.status === "closed" ||
                                          (t.status === "absent" &&
                                            (t.absent_level ?? 0) >=
                                              (t.max_call_attempts ?? 2))
                                        }
                                        className={cn(
                                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                                          isActing ||
                                            t.status === "waiting" ||
                                            t.status === "closed" ||
                                            (t.status === "absent" &&
                                              (t.absent_level ?? 0) >=
                                                (t.max_call_attempts ?? 2))
                                            ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
                                            : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
                                        )}
                                        title={
                                          t.status === "absent" &&
                                          (t.absent_level ?? 0) >=
                                            (t.max_call_attempts ?? 2)
                                            ? "Absence définitive — rappel impossible"
                                            : t.status === "absent"
                                              ? "Rappeler (dernière chance — expiration auto ensuite)"
                                              : "Rappeler ce ticket"
                                        }
                                      >
                                        <Volume2 className="h-3.5 w-3.5" />
                                        Rappel
                                      </button>

                                      {/* Absent button — two-level system:
                                        · Level 0 (called) : orange, 1st chance
                                        · Level 1 (absent)  : red, 2nd and definitive chance
                                        · Level 2 (absent)  : disabled, definitive */}
                                      {(() => {
                                        const absentLevel = t.absent_level ?? 0;
                                        const maxAttempts =
                                          t.max_call_attempts ?? 2;
                                        const isAbsentDefinitive =
                                          t.status === "absent" &&
                                          absentLevel >= maxAttempts;
                                        const isSecondAbsence =
                                          t.status === "absent" &&
                                          absentLevel < maxAttempts &&
                                          absentLevel > 0;
                                        const canMarkAbsent =
                                          !isActing &&
                                          !isAbsentDefinitive &&
                                          (t.status === "called" ||
                                            isSecondAbsence);
                                        return (
                                          <button
                                            type="button"
                                            onClick={() => markAbsent(t)}
                                            disabled={!canMarkAbsent}
                                            className={cn(
                                              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                                              !canMarkAbsent
                                                ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
                                                : isSecondAbsence
                                                  ? "bg-red-500 text-white hover:bg-red-600 shadow-sm"
                                                  : "bg-orange-500 text-white hover:bg-orange-600 shadow-sm",
                                            )}
                                            title={
                                              isAbsentDefinitive
                                                ? "Absence définitive — expiration automatique en cours"
                                                : isSecondAbsence
                                                  ? `Absence ${absentLevel + 1}/${maxAttempts} — définitive, expiration programmée`
                                                  : `Marquer absent (${absentLevel + 1}/${maxAttempts} — rappel possible)`
                                            }
                                          >
                                            <UserX className="h-3.5 w-3.5" />
                                            {isSecondAbsence
                                              ? "Absent définitif"
                                              : "Absent"}
                                          </button>
                                        );
                                      })()}

                                      <button
                                        type="button"
                                        onClick={() =>
                                          closeTicket(Number(t.id))
                                        }
                                        disabled={
                                          isActing || t.status !== "called"
                                        }
                                        className={cn(
                                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                                          isActing || t.status !== "called"
                                            ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
                                            : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
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
                {queueView === "deferred" &&
                  (deferredDays.length === 0 ? (
                    <div className="py-10 text-center bg-muted/40 rounded-xl border-2 border-dashed border-border">
                      <CalendarClock className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
                      <p className="text-sm font-medium text-foreground">
                        Aucun ticket reporté
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Les tickets créés hors horaires apparaîtront ici.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {deferredDays.map((day) => (
                        <div
                          key={day.date}
                          className="rounded-xl border border-amber-200 dark:border-amber-900/40 overflow-hidden"
                        >
                          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-900/40">
                            <CalendarClock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                              {new Date(
                                day.date + "T00:00:00",
                              ).toLocaleDateString("fr-FR", {
                                weekday: "long",
                                day: "2-digit",
                                month: "long",
                              })}
                            </span>
                            <span className="ml-auto text-xs font-bold bg-amber-200 dark:bg-amber-800/50 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full">
                              {day.count} ticket{day.count > 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-border">
                              <thead className="bg-muted/60">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                                    Ticket
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                                    Client
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                                    Priorité
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                                    Source
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                                    Créé le
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                                    Raison
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-card divide-y divide-border">
                                {day.tickets.map((t) => {
                                  const createdDate = parseDate(t.created_at);
                                  return (
                                    <tr
                                      key={t.id}
                                      className="hover:bg-amber-50/40 dark:hover:bg-amber-900/10 transition-colors"
                                    >
                                      <td className="px-4 py-3">
                                        <div className="font-bold text-foreground">
                                          {t.number}
                                        </div>
                                        {t.position && (
                                          <div className="text-xs text-muted-foreground">
                                            #{t.position}
                                          </div>
                                        )}
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="text-sm text-foreground">
                                          {t.display_name ??
                                            t.customer_name ??
                                            "—"}
                                        </div>
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
                                        <span
                                          className={cn(
                                            "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                                            t.priority === "urgence" &&
                                              "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
                                            t.priority === "vip" &&
                                              "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200",
                                            t.priority === "high" &&
                                              "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200",
                                            t.priority === "normal" &&
                                              "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
                                          )}
                                        >
                                          {t.priority === "urgence"
                                            ? "🚨 Urgence"
                                            : t.priority === "vip"
                                              ? "⭐ VIP"
                                              : t.priority === "high"
                                                ? "🔥 Prioritaire"
                                                : "Normal"}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3">
                                        {t.source && SOURCE_CONFIG[t.source] ? (
                                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <span
                                              title={
                                                SOURCE_CONFIG[t.source].label
                                              }
                                            >
                                              {React.createElement(
                                                SOURCE_CONFIG[t.source].Icon,
                                                { className: "h-3 w-3" },
                                              )}
                                            </span>
                                            {SOURCE_CONFIG[t.source].label}
                                          </div>
                                        ) : (
                                          <span className="text-xs text-muted-foreground">
                                            —
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-4 py-3 text-xs text-muted-foreground">
                                        {createdDate
                                          ? createdDate.toLocaleString(
                                              "fr-FR",
                                              {
                                                day: "2-digit",
                                                month: "2-digit",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                              },
                                            )
                                          : "—"}
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                          <CalendarClock className="h-3 w-3" />
                                          {t.defer_reason === "past_cutoff"
                                            ? "Hors délai"
                                            : t.defer_reason ===
                                                "non_working_day"
                                              ? "Jour non ouvrable"
                                              : t.defer_reason === "holiday"
                                                ? "Jour férié"
                                                : t.defer_reason ===
                                                    "critical_zone"
                                                  ? "Zone critique"
                                                  : t.defer_reason ===
                                                      "exceptional_closure"
                                                    ? "Fermeture exceptionnelle"
                                                    : t.defer_reason ===
                                                        "outside_hours"
                                                      ? "Hors horaires"
                                                      : "Reporté automatiquement"}
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
                  ))}
              </div>
            )}

            {/* Fil d'activité en direct */}
            {serviceId && activities.length > 0 && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-foreground flex items-center mb-3">
                  <History className="mr-2 text-blue-600" />
                  Fil d'activité en direct
                  {isConnected && (
                    <span className="ml-2 w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
                  )}
                </h2>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-card">
                  <div className="divide-y divide-border">
                    {activities.slice(0, 50).map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted/30"
                      >
                        <span className="text-xs text-muted-foreground font-mono shrink-0 w-12">
                          {event.timestamp.toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold shrink-0",
                            event.type === "called" &&
                              "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
                            event.type === "enqueued" &&
                              "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
                            event.type === "absent" &&
                              event.message.includes("définitive")
                              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                              : "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
                            event.type === "en_route" &&
                              "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
                            event.type === "closed" &&
                              "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
                            event.type === "recalled" &&
                              "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
                          )}
                        >
                          <Clock className="h-3 w-3" />
                          {event.ticket_number}
                        </span>
                        <span className="text-foreground">{event.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
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
                                {createdDate
                                  ? createdDate.toLocaleTimeString()
                                  : "—"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {createdDate
                                  ? createdDate.toLocaleDateString()
                                  : "—"}
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

      {/* Modal Profil Client */}
      {clientProfileTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setClientProfileTicket(null);
            setClientProfileData(null);
          }}
        >
          <div
            className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <UserCircle className="h-8 w-8" />
                  <div>
                    <h3 className="text-lg font-bold">
                      {clientProfileTicket.customer_name ||
                        clientProfileTicket.display_name ||
                        `Ticket #${clientProfileTicket.number}`}
                    </h3>
                    <p className="text-blue-100 text-sm">
                      Ticket {clientProfileTicket.number}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setClientProfileTicket(null);
                    setClientProfileData(null);
                  }}
                  className="p-1 hover:bg-blue-700 rounded-full transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {clientProfileLoading ? (
              <div className="p-8 text-center">
                <div className="inline-block h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-sm text-muted-foreground">
                  Chargement du profil…
                </p>
              </div>
            ) : clientProfileData ? (
              <div className="p-5 space-y-5">
                {/* Coordonnées */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground uppercase font-semibold">
                      Téléphone
                    </p>
                    <p className="text-base font-medium text-foreground">
                      {clientProfileData.customer_phone || "Non renseigné"}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground uppercase font-semibold">
                      Visites
                    </p>
                    <p className="text-base font-medium text-foreground">
                      {clientProfileData.total_visits}
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40">
                    <div className="flex items-center gap-2">
                      <UserX className="h-4 w-4 text-orange-600" />
                      <p className="text-xs text-orange-600 dark:text-orange-400 uppercase font-semibold">
                        Absences
                      </p>
                    </div>
                    <p className="text-xl font-bold text-orange-700 dark:text-orange-300">
                      {clientProfileData.absent_count}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-blue-600" />
                      <p className="text-xs text-blue-600 dark:text-blue-400 uppercase font-semibold">
                        Tps service moy.
                      </p>
                    </div>
                    <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                      {clientProfileData.avg_service_seconds != null
                        ? `${Math.floor(clientProfileData.avg_service_seconds / 60)} min ${clientProfileData.avg_service_seconds % 60}s`
                        : "—"}
                    </p>
                  </div>
                </div>

                {/* Tickets récents */}
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-muted-foreground" />
                    Historique des tickets
                    <span className="text-xs text-muted-foreground font-normal">
                      ({clientProfileData.recent_tickets.length} derniers)
                    </span>
                  </h4>
                  <div className="max-h-52 overflow-y-auto space-y-1">
                    {clientProfileData.recent_tickets.map((t: any) => {
                      const statusLabel =
                        t.status === "closed"
                          ? "Servi"
                          : t.status === "absent" &&
                              t.absent_level >=
                                clientProfileTicket.max_call_attempts
                            ? "Absent définitif"
                            : t.status === "absent"
                              ? "Absent (rappel)"
                              : t.status === "called"
                                ? "Appelé"
                                : t.status === "en_route"
                                  ? "En route"
                                  : t.status === "present"
                                    ? "Présent"
                                    : t.status === "waiting"
                                      ? "En attente"
                                      : t.status;
                      const statusColor =
                        t.status === "closed"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                          : t.status === "absent"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                            : t.status === "called"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                              : t.status === "en_route"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                : t.status === "present"
                                  ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300";
                      return (
                        <div
                          key={t.id}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-foreground">
                              {t.number}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {t.service_name || "—"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {t.counter_name && (
                              <span className="text-xs text-muted-foreground">
                                Guichet {t.counter_name}
                              </span>
                            )}
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded text-xs font-medium",
                                statusColor,
                              )}
                            >
                              {statusLabel}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bouton fermer */}
                <button
                  onClick={() => {
                    setClientProfileTicket(null);
                    setClientProfileData(null);
                  }}
                  className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <div className="p-8 text-center">
                <Info className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Impossible de charger le profil.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dialog de configuration des délais & tentatives du service */}
      {showTimeoutDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowTimeoutDialog(false)}
        >
          <div
            className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600">
                <Settings2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Paramètres d'absence du service
                </h3>
                <p className="text-xs text-muted-foreground">
                  Délais et tentatives avant expiration
                </p>
              </div>
            </div>

            {/* Délai de priorité */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-1">
                Délai de priorité
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Temps accordé après l'appel d'un ticket avant le marquage absent
                automatique.
              </p>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={timeoutInput}
                  onChange={(e) => setTimeoutInput(e.target.value)}
                  placeholder="10 min par défaut"
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-base font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 pr-14"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                  min
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Laissez vide pour la valeur par défaut · 1 à 60 min
              </p>
            </div>

            {/* Délai de présentation (en route → présent) */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-1">
                Délai de présentation
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Temps accordé à l'usager pour se présenter après avoir confirmé
                « Je suis en route ».
              </p>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={graceInput}
                  onChange={(e) => setGraceInput(e.target.value)}
                  placeholder="10"
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-base font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 pr-14"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                  min
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                1 à 60 min
              </p>
            </div>

            {/* Nombre de tentatives max */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-foreground mb-1">
                Tentatives max avant expiration
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Nombre d'absences tolérées avant l'expiration définitive du
                ticket.
              </p>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={maxAttemptsInput}
                  onChange={(e) => setMaxAttemptsInput(e.target.value)}
                  placeholder="2"
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-base font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 pr-20"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                  absences
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">1 à 10</p>
            </div>

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
