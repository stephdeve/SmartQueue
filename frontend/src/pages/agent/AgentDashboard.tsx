import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/axios";
import { useAppSelector } from "@/store";
import { toast } from "sonner";
import {
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  ListOrdered,
  UserX,
  Play,
  BarChart3,
  RefreshCw,
  Eye,
  ChevronRight,
  Zap,
  Star,
  Flame,
  Gauge,
  Lightbulb,
  Settings2,
  Timer,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AnalyticsCard } from "@/components/ui/analytics-card";
import { ChartContainer } from "@/components/ui/chart-container";
import { VerticalBarChart } from "@/components/ui/charts";

type TodayTicket = {
  id: number;
  number: string;
  status: string;
  priority: string;
  position: number | null;
  service_id: number;
  service_name: string;
  user_name: string | null;
  counter_name: string | null;
  called_at: string | null;
  closed_at: string | null;
  created_at: string;
};

type QueueTicket = {
  id: number;
  number: string;
  status: string;
  priority: string;
  position: number | null;
  service_id: number;
  service_name: string;
  user_name: string | null;
  wait_time_minutes: number;
  created_at: string;
  is_swapped?: boolean;
  deferred_at?: string | null;
  swapped_with_ticket_id?: number | null;
  called_at?: string | null;
  en_route_at?: string | null;
  present_at?: string | null;
  response_received_at?: string | null;
  en_route_expires_at?: string | null;
  estimated_travel_minutes?: number | null;
};

type ServiceInfo = {
  id: number;
  name: string;
  status: string;
  waiting_count: number;
};

type DailyStat = {
  date: string;
  total: number;
  closed: number;
  absent: number;
};

type Stats = {
  today_total: number;
  today_called: number;
  today_closed: number;
  today_waiting: number;
  today_absent: number;
  avg_service_time: number | null;
  avg_wait_time: number | null;
  tickets_per_day: number;
  active_services: number;
  current_queue_size: number;
};

type Performance = {
  days: number;
  daily: DailyStat[];
  total: number;
  total_called: number;
  total_closed: number;
  total_absent: number;
  avg_service_time: number | null;
};

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  waiting: {
    label: "En attente",
    color: "text-yellow-700",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
  },
  created: {
    label: "Créé",
    color: "text-yellow-700",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
  },
  called: {
    label: "Appelé",
    color: "text-blue-700",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  en_route: {
    label: "En route",
    color: "text-amber-700",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
  present: {
    label: "Présent",
    color: "text-violet-700",
    bgColor: "bg-violet-100 dark:bg-violet-900/30",
  },
  closed: {
    label: "Clôturé",
    color: "text-green-700",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  absent: {
    label: "Absent",
    color: "text-orange-700",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
  },
  expired: {
    label: "Expiré",
    color: "text-red-700",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
  canceled: {
    label: "Annulé",
    color: "text-gray-700",
    bgColor: "bg-gray-100 dark:bg-gray-800",
  },
  cancelled: {
    label: "Annulé",
    color: "text-gray-700",
    bgColor: "bg-gray-100 dark:bg-gray-800",
  },
};

const PRIORITY_CONFIG: Record<string, { label: string; icon: any }> = {
  normal: { label: "Normal", icon: ListOrdered },
  high: { label: "Haute", icon: Flame },
  vip: { label: "VIP", icon: Star },
  urgence: { label: "Urgence", icon: AlertTriangle },
};

const PRIORITY_COLORS: Record<
  string,
  { bar: string; text: string; bg: string }
> = {
  normal: {
    bar: "bg-blue-500",
    text: "text-blue-700",
    bg: "bg-blue-100 dark:bg-blue-900/30",
  },
  high: {
    bar: "bg-amber-500",
    text: "text-amber-700",
    bg: "bg-amber-100 dark:bg-amber-900/30",
  },
  vip: {
    bar: "bg-purple-500",
    text: "text-purple-700",
    bg: "bg-purple-100 dark:bg-purple-900/30",
  },
  urgence: {
    bar: "bg-red-500",
    text: "text-red-700",
    bg: "bg-red-100 dark:bg-red-900/30",
  },
};

/** Jours couverts par la courbe de performance selon la période choisie. */
const PERIOD_DAYS = { today: 7, "7days": 7, "30days": 30 } as const;

export default function AgentDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [todayTickets, setTodayTickets] = useState<TodayTicket[]>([]);
  const [currentQueue, setCurrentQueue] = useState<{
    services: ServiceInfo[];
    tickets: QueueTicket[];
    total_waiting: number;
  } | null>(null);
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [agentPeriod, setAgentPeriod] = useState<"today" | "7days" | "30days">(
    "today",
  );
  const [overviewAffluence, setOverviewAffluence] = useState<any>(null);
  const [affluenceService, setAffluenceService] = useState<ServiceInfo | null>(
    null,
  );
  const [affluenceData, setAffluenceData] = useState<any>(null);
  const [affluenceLoading, setAffluenceLoading] = useState(false);
  const user = useAppSelector((s) => s.auth.user);
  const [serviceConfigs, setServiceConfigs] = useState<
    Record<
      number,
      {
        call_timeout_minutes: number | null;
        max_call_attempts: number;
        en_route_grace_minutes: number;
      }
    >
  >({});

  const loadAll = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [statsRes, ticketsRes, queueRes, perfRes] = await Promise.all([
        api.get("/api/agent/dashboard/stats"),
        api.get("/api/agent/dashboard/today-tickets"),
        api.get("/api/agent/dashboard/current-queue"),
        api.get("/api/agent/dashboard/performance", {
          params: { days: PERIOD_DAYS[agentPeriod] },
        }),
      ]);

      setStats(statsRes.data);
      setTodayTickets(ticketsRes.data);
      setCurrentQueue(queueRes.data);
      setPerformance(perfRes.data);

      const firstServiceId = queueRes.data?.services?.[0]?.id;
      if (firstServiceId) {
        try {
          const { data } = await api.get(
            `/api/services/${firstServiceId}/affluence`,
          );
          setOverviewAffluence(data);
        } catch {
          setOverviewAffluence(null);
        }
      }

      // Load service configurations (call_timeout, max_call_attempts, en_route_grace_minutes)
      if (queueRes.data?.services?.length > 0) {
        const configPromises = queueRes.data.services.map(
          async (svc: ServiceInfo) => {
            try {
              const res = await api.get(`/api/services/${svc.id}`);
              // ServiceResource : la réponse est enveloppée dans { data: {...} }
              const data = res.data?.data ?? res.data;
              return {
                id: svc.id,
                config: {
                  call_timeout_minutes: data?.call_timeout_minutes ?? null,
                  max_call_attempts: data?.max_call_attempts ?? 2,
                  en_route_grace_minutes: data?.en_route_grace_minutes ?? 10,
                },
              };
            } catch {
              return {
                id: svc.id,
                config: {
                  call_timeout_minutes: null,
                  max_call_attempts: 2,
                  en_route_grace_minutes: 10,
                },
              };
            }
          },
        );
        const configResults = await Promise.all(configPromises);
        const configMap: Record<number, any> = {};
        configResults.forEach((r) => {
          configMap[r.id] = r.config;
        });
        setServiceConfigs(configMap);
      } else {
        setServiceConfigs({});
      }
    } catch (error: any) {
      const status = error?.response?.status;
      const detail =
        error?.response?.data?.message || error?.message || "Erreur inconnue";
      toast.error(`Erreur (${status}): ${detail}`);
      console.error("Erreur lors du chargement des données agent:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Période 7/30 jours : seule la performance dépend de la période
  useEffect(() => {
    let alive = true;
    api
      .get("/api/agent/dashboard/performance", { params: { days: PERIOD_DAYS[agentPeriod] } })
      .then((res) => alive && setPerformance(res.data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [agentPeriod]);

  const performanceChartData = useMemo(() => {
    if (!performance?.daily) return [];
    return performance.daily.map((d) => ({
      name: new Date(d.date).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
      }),
      value: d.closed,
      color: "#22c55e",
    }));
  }, [performance]);

  const yesterdayChange = useMemo(() => {
    if (!performance?.daily || performance.daily.length < 2) return null;
    const days = performance.daily;
    const today = days[days.length - 1].closed;
    const yesterday = days[days.length - 2].closed;
    if (yesterday === 0) return today > 0 ? 100 : 0;
    return Math.round(((today - yesterday) / yesterday) * 100);
  }, [performance]);

  const slaPercent = useMemo(() => {
    if (!currentQueue?.tickets || currentQueue.tickets.length === 0)
      return null;
    const total = currentQueue.tickets.length;
    const under15 = currentQueue.tickets.filter(
      (t) => t.wait_time_minutes < 15,
    ).length;
    return Math.round((under15 / total) * 100);
  }, [currentQueue]);

  const efficiencyScore = useMemo(() => {
    if (!stats || stats.today_total === 0) return null;
    return Math.round((stats.today_closed / stats.today_total) * 100);
  }, [stats]);

  const performanceScore = useMemo(() => {
    if (!performance) return 0;
    const total = performance.total_closed + performance.total_absent;
    if (total === 0) return 0;
    return Math.round((performance.total_closed / total) * 100);
  }, [performance]);

  const highPriorityCount = useMemo(() => {
    if (!currentQueue?.tickets) return 0;
    return currentQueue.tickets.filter(
      (t) => t.priority === "high" || t.priority === "vip" || t.priority === "urgence",
    ).length;
  }, [currentQueue]);

  const kpiValues = useMemo(() => {
    const todayKpis = {
      waiting: stats?.today_waiting ?? 0,
      called: stats?.today_called ?? 0,
      closed: stats?.today_closed ?? 0,
      absent: stats?.today_absent ?? 0,
      total: stats?.today_total ?? 0,
    };
    if (agentPeriod === "today") return todayKpis;
    // Totaux réels de la période (7 ou 30 jours), calculés par l'API
    return {
      waiting: currentQueue?.total_waiting ?? 0,
      called: performance?.total_called ?? 0,
      closed: performance?.total_closed ?? 0,
      absent: performance?.total_absent ?? 0,
      total: performance?.total ?? 0,
    };
  }, [agentPeriod, stats, performance, currentQueue]);

  const avgServiceTime = useMemo(() => {
    if (agentPeriod === "today") return stats?.avg_service_time;
    return performance?.avg_service_time;
  }, [agentPeriod, stats, performance]);

  const avgWaitTime = useMemo(() => {
    return stats?.avg_wait_time;
  }, [stats]);

  const dailyAverage = useMemo(() => {
    if (agentPeriod === "today") return stats?.tickets_per_day;
    const days = performance?.days || PERIOD_DAYS[agentPeriod];
    return Math.round(((performance?.total_closed ?? 0) / days) * 10) / 10;
  }, [agentPeriod, stats, performance]);

  const priorityDistribution = useMemo(() => {
    if (!currentQueue?.tickets || currentQueue.tickets.length === 0) return [];
    const counts: Record<string, number> = {};
    currentQueue.tickets.forEach((t) => {
      const key = t.priority || "normal";
      counts[key] = (counts[key] || 0) + 1;
    });
    const total = currentQueue.tickets.length;
    const order = ["urgence", "vip", "high", "normal"];
    return order
      .map((key) => {
        const config = PRIORITY_CONFIG[key];
        if (!config) return null;
        const count = counts[key] || 0;
        return {
          key,
          label: config.label,
          icon: config.icon,
          count,
          percentage: total > 0 ? Math.round((count / total) * 100) : 0,
          color: PRIORITY_COLORS[key],
        };
      })
      .filter(Boolean);
  }, [currentQueue]);

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || {
      label: status,
      color: "text-gray-700",
      bgColor: "bg-gray-100 dark:bg-gray-800",
    };
    return (
      <Badge
        className={cn(config.bgColor, config.color, "font-medium text-xs")}
      >
        {config.label}
      </Badge>
    );
  };

  const getTicketBadge = (ticket: any) => {
    if (ticket.is_swapped && ticket.status === "waiting") {
      return (
        <Badge className={cn("bg-gray-100 text-gray-700 font-medium text-xs")}>
          Laisser passer
        </Badge>
      );
    }

    if (ticket.status === "called" && !ticket.response_received_at) {
      return (
        <Badge className={cn("bg-blue-100 text-blue-700 font-medium text-xs")}>
          Appelé - aucune réponse
        </Badge>
      );
    }

    if (ticket.status === "en_route") {
      return (
        <Badge
          className={cn("bg-amber-100 text-amber-700 font-medium text-xs")}
        >
          En route
        </Badge>
      );
    }

    if (ticket.status === "present") {
      return (
        <Badge
          className={cn("bg-violet-100 text-violet-700 font-medium text-xs")}
        >
          Présent
        </Badge>
      );
    }

    return getStatusBadge(ticket.status);
  };

  const getPriorityBadge = (priority: string) => {
    const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.normal;
    const Icon = config.icon;
    return <Icon className="h-3 w-3" />;
  };

  const getSlaColor = (minutes: number) => {
    if (minutes < 10) return "bg-green-500";
    if (minutes < 20) return "bg-amber-500";
    return "bg-red-500";
  };

  const getHealthColor = (count: number) => {
    if (count < 5) return "bg-green-500";
    if (count <= 15) return "bg-amber-500";
    return "bg-red-500";
  };

  const openAffluence = async (service: ServiceInfo) => {
    setAffluenceService(service);
    setAffluenceData(null);
    setAffluenceLoading(true);
    try {
      const { data } = await api.get(`/api/services/${service.id}/affluence`);
      setAffluenceData(data);
    } catch {
      setAffluenceData(null);
    } finally {
      setAffluenceLoading(false);
    }
  };

  const getAffluenceBadge = (count: number) => {
    if (count >= 10)
      return {
        label: "Élevée",
        className:
          "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200",
      };
    if (count >= 5)
      return {
        label: "Modérée",
        className:
          "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200",
      };
    return {
      label: "Faible",
      className:
        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200",
    };
  };

  const getGaugeColor = (score: number) => {
    if (score >= 75) return "#22c55e";
    if (score >= 50) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Espace Agent
            </h1>
            <p className="text-muted-foreground mt-1">
              Bienvenue {user?.name}, voici votre activité du jour
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-background rounded-md border border-border overflow-hidden flex">
              {(["today", "7days", "30days"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setAgentPeriod(p)}
                  className={cn(
                    "px-2.5 py-2 text-xs font-medium transition-all",
                    agentPeriod === p
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p === "today"
                    ? "Aujourd'hui"
                    : p === "7days"
                      ? "7 jrs"
                      : "30 jrs"}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadAll(true)}
              disabled={refreshing}
            >
              <RefreshCw
                className={cn(
                  "h-3.5 w-3.5 mr-1.5",
                  refreshing && "animate-spin",
                )}
              />
              Actualiser
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <AnalyticsCard
            title="En attente"
            value={kpiValues.waiting}
            icon={Clock}
            className="bg-card"
          />
          <AnalyticsCard
            title="Appelés"
            value={kpiValues.called}
            icon={Activity}
            className="bg-card"
          />
          <AnalyticsCard
            title="Clôturés"
            value={kpiValues.closed}
            icon={CheckCircle}
            className="bg-card"
          />
          <AnalyticsCard
            title="Absents"
            value={kpiValues.absent}
            icon={UserX}
            className="bg-card"
          />
          <AnalyticsCard
            title={agentPeriod === "today" ? "Total du jour" : "Total période"}
            value={kpiValues.total}
            icon={TrendingUp}
            className="bg-card"
          />
        </div>

        {/* Smart Insights */}
        {yesterdayChange !== null &&
          slaPercent !== null &&
          efficiencyScore !== null && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "p-2 rounded-lg",
                        yesterdayChange >= 0
                          ? "bg-green-100 dark:bg-green-900/30"
                          : "bg-red-100 dark:bg-red-900/30",
                      )}
                    >
                      {yesterdayChange >= 0 ? (
                        <TrendingUp
                          className={cn(
                            "h-5 w-5",
                            yesterdayChange >= 0
                              ? "text-green-600"
                              : "text-red-600",
                          )}
                        />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">
                        Tendance vs hier
                      </p>
                      <p
                        className={cn(
                          "text-lg font-bold",
                          yesterdayChange >= 0
                            ? "text-green-600"
                            : "text-red-600",
                        )}
                      >
                        {yesterdayChange >= 0 ? "↑" : "↓"}{" "}
                        {Math.abs(yesterdayChange)}% de tickets traités
                      </p>
                      {agentPeriod === "today" && (
                        <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                          <span>
                            Attente: {stats?.avg_wait_time ?? "—"} min
                          </span>
                          <span className="text-border">|</span>
                          <span>
                            Service: {stats?.avg_service_time ?? "—"} min
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "p-2 rounded-lg",
                        slaPercent >= 80
                          ? "bg-green-100 dark:bg-green-900/30"
                          : slaPercent >= 60
                            ? "bg-amber-100 dark:bg-amber-900/30"
                            : "bg-red-100 dark:bg-red-900/30",
                      )}
                    >
                      <Clock
                        className={cn(
                          "h-5 w-5",
                          slaPercent >= 80
                            ? "text-green-600"
                            : slaPercent >= 60
                              ? "text-amber-600"
                              : "text-red-600",
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">
                        File actuelle
                      </p>
                      <p
                        className={cn(
                          "text-lg font-bold",
                          slaPercent >= 80
                            ? "text-green-600"
                            : slaPercent >= 60
                              ? "text-amber-600"
                              : "text-red-600",
                        )}
                      >
                        {slaPercent}% attendent depuis moins de 15 min
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "p-2 rounded-lg",
                        efficiencyScore >= 80
                          ? "bg-green-100 dark:bg-green-900/30"
                          : efficiencyScore >= 60
                            ? "bg-amber-100 dark:bg-amber-900/30"
                            : "bg-red-100 dark:bg-red-900/30",
                      )}
                    >
                      <Star
                        className={cn(
                          "h-5 w-5",
                          efficiencyScore >= 80
                            ? "text-green-600"
                            : efficiencyScore >= 60
                              ? "text-amber-600"
                              : "text-red-600",
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">
                        Score d'efficacité
                      </p>
                      <p
                        className={cn(
                          "text-lg font-bold",
                          efficiencyScore >= 80
                            ? "text-green-600"
                            : efficiencyScore >= 60
                              ? "text-amber-600"
                              : "text-red-600",
                        )}
                      >
                        {efficiencyScore}/100
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

        {/* Quick Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Temps moyen de service
                  </p>
                  <p className="text-2xl font-bold">
                    {avgServiceTime ? `${avgServiceTime} min` : "—"}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Temps moyen d'attente
                  </p>
                  <p className="text-2xl font-bold">
                    {avgWaitTime ? `${avgWaitTime} min` : "—"}
                  </p>
                </div>
                <Users className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {agentPeriod === "today" ? "Tickets / jour (7 j)" : "Clôturés / jour"}
                  </p>
                  <p className="text-2xl font-bold">
                    {dailyAverage ? `${dailyAverage}` : "—"}
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          {/* Performance Pulse */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex flex-col items-center gap-1">
                  <div className="relative w-16 h-16">
                    <div
                      className="w-16 h-16 rounded-full"
                      style={{
                        background: `conic-gradient(${getGaugeColor(performanceScore)} 0% ${performanceScore}%, #e5e7eb ${performanceScore}% 100%)`,
                      }}
                    >
                      <div className="absolute inset-[3px] rounded-full bg-card flex items-center justify-center">
                        <span className="text-sm font-bold">
                          {performanceScore}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Performance</p>
                </div>
                <Gauge className="h-8 w-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current Queue - Takes 2 columns */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ListOrdered className="h-5 w-5" />
                  File d'attente actuelle
                </CardTitle>
                <CardDescription>
                  {currentQueue?.total_waiting ?? 0} ticket(s) en attente
                </CardDescription>
              </div>
              <Link to="/dashboard/queues">
                <Button variant="outline" size="sm">
                  Voir tout
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {currentQueue?.tickets && currentQueue.tickets.length > 0 ? (
                <div className="space-y-3">
                  {currentQueue.tickets.slice(0, 10).map((ticket) => (
                    <div
                      key={ticket.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-1 h-10 rounded-full shrink-0",
                            getSlaColor(ticket.wait_time_minutes),
                          )}
                        />
                        <div className="flex items-center gap-2">
                          {getPriorityBadge(ticket.priority)}
                          <span className="font-semibold text-lg">
                            {ticket.number}
                          </span>
                        </div>
                        <div className="hidden md:block">
                          <p className="text-sm text-muted-foreground">
                            {ticket.service_name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {ticket.wait_time_minutes} min
                          </p>
                          <p className="text-xs text-muted-foreground">
                            d'attente
                          </p>
                        </div>
                        <div className="text-right">
                          {ticket.is_swapped && ticket.status === "waiting" ? (
                            <Badge
                              className={cn(
                                "bg-gray-100 text-gray-700 font-medium text-xs",
                              )}
                            >
                              Laisser passer
                            </Badge>
                          ) : (
                            getTicketBadge(ticket)
                          )}

                          <div className="text-xs text-muted-foreground mt-1">
                            {ticket.response_received_at ? (
                              <span>
                                Réponse à{" "}
                                {new Date(
                                  ticket.response_received_at,
                                ).toLocaleTimeString("fr-FR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}{" "}
                                (
                                {Math.floor(
                                  (Date.now() -
                                    new Date(
                                      ticket.response_received_at,
                                    ).getTime()) /
                                    60000,
                                )}{" "}
                                min)
                              </span>
                            ) : ticket.called_at ? (
                              <span>
                                Appelé à{" "}
                                {new Date(ticket.called_at).toLocaleTimeString(
                                  "fr-FR",
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                              </span>
                            ) : null}

                            {ticket.status === "en_route" &&
                              ticket.estimated_travel_minutes && (
                                <div>
                                  ETA ~{ticket.estimated_travel_minutes} min
                                </div>
                              )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>Aucun ticket en attente</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Services Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Services actifs
              </CardTitle>
              <CardDescription>
                {stats?.active_services ?? 0} service(s) ouvert(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentQueue?.services && currentQueue.services.length > 0 ? (
                <div className="space-y-3">
                  {currentQueue.services.map((service) => (
                    <div
                      key={service.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full",
                            service.status === "open"
                              ? "bg-green-500"
                              : "bg-gray-400",
                          )}
                        />
                        <span className="font-medium">{service.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full",
                            getHealthColor(service.waiting_count),
                          )}
                        />
                        <Badge
                          variant={
                            service.waiting_count > 0 ? "default" : "secondary"
                          }
                        >
                          {service.waiting_count} en attente
                        </Badge>
                        <Badge
                          className={cn(
                            "border text-xs",
                            getAffluenceBadge(service.waiting_count).className,
                          )}
                          variant="outline"
                        >
                          {getAffluenceBadge(service.waiting_count).label}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openAffluence(service)}
                          title="Voir les créneaux d'affluence"
                        >
                          <BarChart3 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-muted-foreground">
                  Aucun service assigné
                </p>
              )}
            </CardContent>
          </Card>

          {/* Priority Distribution */}
          {priorityDistribution.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Répartition par priorité
                </CardTitle>
                <CardDescription>
                  {currentQueue?.tickets.length ?? 0} ticket(s) dans la file
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {priorityDistribution.map((item: any) => (
                    <div key={item.key}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {item.icon && (
                            <item.icon
                              className={cn("h-3.5 w-3.5", item.color.text)}
                            />
                          )}
                          <span className="text-sm font-medium">
                            {item.label}
                          </span>
                        </div>
                        <span className="text-sm font-bold">
                          {item.count} ({item.percentage}%)
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            item.color.bar,
                          )}
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recent Tickets & Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Tickets */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Tickets récents du jour</CardTitle>
              <Link to="/dashboard/tickets">
                <Button variant="outline" size="sm">
                  Voir tout
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {todayTickets.length > 0 ? (
                <div className="space-y-3">
                  {todayTickets.slice(0, 8).map((ticket) => (
                    <div
                      key={ticket.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full",
                            ticket.status === "waiting" && "bg-yellow-500",
                            ticket.status === "called" && "bg-blue-500",
                            ticket.status === "en_route" && "bg-amber-500",
                            ticket.status === "present" && "bg-violet-500",
                            ticket.status === "closed" && "bg-green-500",
                            ticket.status === "absent" && "bg-orange-500",
                          )}
                        />
                        <div>
                          <p className="font-medium">{ticket.number}</p>
                          <p className="text-xs text-muted-foreground">
                            {ticket.service_name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getTicketBadge(ticket)}
                        <span className="text-xs text-muted-foreground">
                          {new Date(ticket.created_at).toLocaleTimeString(
                            "fr-FR",
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-muted-foreground">
                  Aucun ticket aujourd'hui
                </p>
              )}
            </CardContent>
          </Card>

          {/* Performance Chart */}
          <Card>
            <CardHeader>
              <CardTitle>
                {agentPeriod === "today"
                  ? "Performance (7 derniers jours)"
                  : agentPeriod === "7days"
                    ? "Performance - 7 jours"
                    : "Performance - 30 jours"}
              </CardTitle>
              <CardDescription>
                {performance?.total_closed ?? 0} tickets clôturés
              </CardDescription>
            </CardHeader>
            <CardContent>
              {performanceChartData.length > 0 ? (
                <ChartContainer title="" description="">
                  <VerticalBarChart data={performanceChartData} height={200} />
                </ChartContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Aucune donnée
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {performance?.total_closed ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Clôturés</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">
                    {performance?.total_absent ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Absents</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Service Configuration Card */}
        {serviceConfigs && Object.keys(serviceConfigs).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Configuration des services
              </CardTitle>
              <CardDescription>
                Paramètres d'absence et délais appliqués
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {currentQueue?.services.map((service) => {
                  const config = serviceConfigs[service.id];
                  if (!config) return null;
                  return (
                    <div
                      key={service.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full",
                            service.status === "open"
                              ? "bg-green-500"
                              : "bg-gray-400",
                          )}
                        />
                        <span className="font-medium">{service.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span
                          className="text-muted-foreground"
                          title="Délai de priorité"
                        >
                          <Timer className="h-3.5 w-3.5 inline mr-1" />
                          {config.call_timeout_minutes != null
                            ? `${config.call_timeout_minutes} min`
                            : "par défaut"}
                        </span>
                        <span
                          className="text-muted-foreground"
                          title="Tentatives max"
                        >
                          <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
                          {config.max_call_attempts} max
                        </span>
                        <span
                          className="text-muted-foreground"
                          title="Délai de présentation"
                        >
                          <Clock className="h-3.5 w-3.5 inline mr-1" />
                          {config.en_route_grace_minutes} min
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions rapides</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link to="/dashboard/queues">
                <Button
                  className="w-full h-15 flex gap-2 items-center"
                  variant="default"
                >
                  <Play className="h-6 w-6 mb-1" />
                  <span className="text-sm">
                    Gérer la file ({currentQueue?.total_waiting ?? 0} en
                    attente)
                  </span>
                </Button>
              </Link>
              <Link to="/dashboard/tickets">
                <Button
                  className="w-full h-15 flex gap-2 items-center"
                  variant="secondary"
                >
                  <Eye className="h-6 w-6 mb-1" />
                  <span className="text-sm">
                    Voir tickets ({stats?.today_total ?? 0})
                  </span>
                </Button>
              </Link>
              <Link to="/dashboard/queues/called">
                <Button
                  className="w-full h-15 flex gap-2 items-center"
                  variant="outline"
                >
                  <Activity className="h-6 w-6 mb-1" />
                  <span className="text-sm">
                    Tickets appelés ({stats?.today_called ?? 0})
                  </span>
                </Button>
              </Link>
              <Link to="/dashboard/queues/priority">
                <Button
                  className="w-full h-15 flex gap-2 items-center"
                  variant="destructive"
                >
                  <AlertTriangle className="h-6 w-6 mb-1" />
                  <span className="text-sm">
                    Prioritaires ({highPriorityCount})
                  </span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Créneaux d'affluence */}
        {overviewAffluence && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Créneaux d'affluence
              </CardTitle>
              <CardDescription>
                Basé sur l'historique des 30 derniers jours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      overviewAffluence.level === "high"
                        ? "bg-red-500"
                        : overviewAffluence.level === "medium"
                          ? "bg-amber-500"
                          : "bg-green-500",
                    )}
                  />
                  <div className="flex-1">
                    <p className="font-medium">
                      Affluence{" "}
                      {overviewAffluence.level === "high"
                        ? "élevée"
                        : overviewAffluence.level === "medium"
                          ? "modérée"
                          : "faible"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {overviewAffluence.people ?? 0} en attente · ~
                      {overviewAffluence.eta_avg ?? "--"} min
                    </p>
                  </div>
                </div>

                {overviewAffluence.peak_hours?.high?.length > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">
                      Heures de pointe 🔴
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {overviewAffluence.peak_hours.high
                        .map((h: number) => `${String(h).padStart(2, "0")}h`)
                        .join(", ")}
                    </p>
                  </div>
                )}

                {overviewAffluence.peak_hours?.low?.length > 0 && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">
                      Heures calmes 🟢
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {overviewAffluence.peak_hours.low
                        .map((h: number) => `${String(h).padStart(2, "0")}h`)
                        .join(", ")}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Affluence Dialog */}
      <Dialog
        open={!!affluenceService}
        onOpenChange={(open) => {
          if (!open) setAffluenceService(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Affluence — {affluenceService?.name}</DialogTitle>
            <DialogDescription>
              Distribution horaire des tickets sur les 30 derniers jours
            </DialogDescription>
          </DialogHeader>
          {affluenceLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : affluenceData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/30 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold">
                    {affluenceData.people ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">En attente</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold">
                    ~{affluenceData.eta_avg ?? "--"} min
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Attente moyenne
                  </p>
                </div>
                <div className="bg-muted/30 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div
                      className={cn(
                        "w-3 h-3 rounded-full",
                        affluenceData.level === "high"
                          ? "bg-red-500"
                          : affluenceData.level === "medium"
                            ? "bg-amber-500"
                            : "bg-green-500",
                      )}
                    />
                    <p className="text-2xl font-bold">
                      {affluenceData.level === "high"
                        ? "Élevée"
                        : affluenceData.level === "medium"
                          ? "Modérée"
                          : "Faible"}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Niveau d'affluence
                  </p>
                </div>
              </div>

              {affluenceData.hourly_data &&
                affluenceData.hourly_data.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">
                      Créneaux horaires (30 jours)
                    </h4>
                    <ChartContainer title="" description="">
                      <VerticalBarChart
                        data={affluenceData.hourly_data.map((pt: any) => ({
                          name: `${String(pt.hour).padStart(2, "0")}h`,
                          value: pt.count,
                          color: affluenceData.peak_hours?.high?.includes(
                            pt.hour,
                          )
                            ? "#ef4444"
                            : affluenceData.peak_hours?.medium?.includes(
                                  pt.hour,
                                )
                              ? "#f59e0b"
                              : "#22c55e60",
                        }))}
                        height={220}
                      />
                    </ChartContainer>
                    <div className="flex items-center justify-center gap-6 mt-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="text-xs text-muted-foreground">
                          Peak
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-amber-500" />
                        <span className="text-xs text-muted-foreground">
                          Moyen
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-green-500/40" />
                        <span className="text-xs text-muted-foreground">
                          Calme
                        </span>
                      </div>
                    </div>
                  </div>
                )}

              {affluenceData.peak_hours?.high?.length > 0 && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Heures de pointe :{" "}
                    {affluenceData.peak_hours.high
                      .map((h: number) => `${String(h).padStart(2, "0")}h`)
                      .join(", ")}
                    . Prévoyez des ressources supplémentaires sur ces créneaux.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">
              Impossible de charger les données d'affluence.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
