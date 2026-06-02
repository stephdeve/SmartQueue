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
  daily: DailyStat[];
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
};

const PRIORITY_CONFIG: Record<string, { label: string; icon: any }> = {
  normal: { label: "Normal", icon: ListOrdered },
  high: { label: "Haute", icon: Flame },
  vip: { label: "VIP", icon: Star },
};

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
  const user = useAppSelector((s) => s.auth.user);

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
        api.get("/api/agent/dashboard/performance"),
      ]);

      setStats(statsRes.data);
      setTodayTickets(ticketsRes.data);
      setCurrentQueue(queueRes.data);
      setPerformance(perfRes.data);
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
  }, []);

  // Performance chart data
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

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.waiting;
    return (
      <Badge
        className={cn(config.bgColor, config.color, "font-medium text-xs")}
      >
        {config.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.normal;
    const Icon = config.icon;
    return <Icon className="h-3 w-3" />;
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

          <Button
            variant="outline"
            onClick={() => loadAll(true)}
            disabled={refreshing}
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")}
            />
            Actualiser
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <AnalyticsCard
            title="En attente"
            value={stats?.today_waiting ?? 0}
            icon={Clock}
            className="bg-card"
          />
          <AnalyticsCard
            title="Appelés"
            value={stats?.today_called ?? 0}
            icon={Activity}
            className="bg-card"
          />
          <AnalyticsCard
            title="Clôturés"
            value={stats?.today_closed ?? 0}
            icon={CheckCircle}
            className="bg-card"
          />
          <AnalyticsCard
            title="Absents"
            value={stats?.today_absent ?? 0}
            icon={UserX}
            className="bg-card"
          />
          <AnalyticsCard
            title="Total du jour"
            value={stats?.today_total ?? 0}
            icon={TrendingUp}
            className="bg-card"
          />
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Temps moyen de service
                  </p>
                  <p className="text-2xl font-bold">
                    {stats?.avg_service_time
                      ? `${stats.avg_service_time} min`
                      : "—"}
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
                    {stats?.avg_wait_time ? `${stats.avg_wait_time} min` : "—"}
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
                    Moyenne journalière
                  </p>
                  <p className="text-2xl font-bold">
                    {stats?.tickets_per_day ? `${stats.tickets_per_day}` : "—"}
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-purple-500" />
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
                        {getStatusBadge(ticket.status)}
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
                      className="flex items-center justify-between p-3 rounded-lg border"
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
                      <Badge
                        variant={
                          service.waiting_count > 0 ? "default" : "secondary"
                        }
                      >
                        {service.waiting_count} en attente
                      </Badge>
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
                        {getStatusBadge(ticket.status)}
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
              <CardTitle>Performance (7 derniers jours)</CardTitle>
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

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions rapides</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link to="/dashboard/queues">
                <Button className="w-full h-20 flex flex-col" variant="default">
                  <Play className="h-6 w-6 mb-1" />
                  <span className="text-sm">Gérer la file</span>
                </Button>
              </Link>
              <Link to="/dashboard/tickets">
                <Button className="w-full h-20 flex flex-col" variant="outline">
                  <Eye className="h-6 w-6 mb-1" />
                  <span className="text-sm">Voir tickets</span>
                </Button>
              </Link>
              <Link to="/dashboard/queues/called">
                <Button className="w-full h-20 flex flex-col" variant="outline">
                  <Activity className="h-6 w-6 mb-1" />
                  <span className="text-sm">Tickets appelés</span>
                </Button>
              </Link>
              <Link to="/dashboard/queues/priority">
                <Button className="w-full h-20 flex flex-col" variant="outline">
                  <AlertTriangle className="h-6 w-6 mb-1" />
                  <span className="text-sm">Prioritaires</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
