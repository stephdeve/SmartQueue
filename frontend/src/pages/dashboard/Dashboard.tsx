import { useEffect, useMemo, useState } from 'react'
import { api } from '@/api/axios'
import { useAppSelector } from '@/store'
import { toast } from 'sonner'
import {
  Ticket,
  CheckCircle,
  UserX,
  PieChartIcon,
  Clock,
  Users,
  Building2,
  Activity,
  TrendingUp,
  Calendar as CalendarIcon,
  Bell,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  UserPlus,
  Settings,
  Mail,
  Phone,
  Search,
  Filter,
  MoreHorizontal,
  RefreshCw,
  Eye,
  Edit3,
  Trash2,
  Download,
  BarChart3,
  LineChart as LineChartIcon,
  Lightbulb,
  Gauge,
  List,
  Timer,
  AlertCircle,
  Target,
  Zap,
  BrainCircuit,
  UserCheck,
} from 'lucide-react'
import { AnalyticsCard } from '@/components/ui/analytics-card'
import { ChartContainer } from '@/components/ui/chart-container'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DonutChart, LineChartComponent, VerticalBarChart } from '@/components/ui/charts'
import { cn, downloadBlob, localDateString } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'

const STATUS_LABELS: Record<string, string> = {
  waiting: 'En attente',
  called: 'Appelé',
  en_route: 'En route',
  present: 'Présent',
  closed: 'Clôturé',
  absent: 'Absent',
  expired: 'Expiré',
  canceled: 'Annulé',
  cancelled: 'Annulé',
}

function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status
}

function statusVariant(status: string): 'secondary' | 'default' | 'outline' | 'destructive' {
  if (status === 'waiting') return 'secondary'
  if (['called', 'en_route', 'present'].includes(status)) return 'default'
  if (status === 'closed') return 'outline'
  return 'destructive'
}

function statusDot(status: string) {
  if (status === 'waiting') return 'bg-yellow-500'
  if (['called', 'en_route', 'present'].includes(status)) return 'bg-blue-500'
  if (status === 'closed') return 'bg-green-500'
  if (status === 'canceled' || status === 'cancelled') return 'bg-gray-400'
  return 'bg-red-500'
}

/** Variation réelle vs la période précédente (undefined sans référence). */
function periodChange(current: number, previous: number | null | undefined, lowerIsBetter = false) {
  if (!previous) return undefined
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return { value: 0, type: 'neutral' as const }
  return {
    value: Math.abs(pct),
    type: pct > 0 ? ('increase' as const) : ('decrease' as const),
    positive: lowerIsBetter ? pct < 0 : pct > 0,
  }
}

function getAffluenceBadge(count: number) {
  if (count >= 10) return { label: 'Élevée', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200' }
  if (count >= 5) return { label: 'Modérée', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200' }
  return { label: 'Faible', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200' }
}

const openAffluence = async (service: any, setService: any, setData: any, setLoading: any) => {
  setService(service);
  setData(null);
  setLoading(true);
  try {
    const { data } = await api.get(`/api/services/${service.id}/affluence`);
    setData(data);
  } catch {
    setData(null);
  } finally {
    setLoading(false);
  }
};

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<any>(null)
  const [prevStats, setPrevStats] = useState<any>(null)
  const [liveQueue, setLiveQueue] = useState<any[]>([])
  const [series, setSeries] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [serviceDistribution, setServiceDistribution] = useState<any[]>([])
  const [agentsDistribution, setAgentsDistribution] = useState<any[]>([])
  const [overviewAffluence, setOverviewAffluence] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [seriesLoading, setSeriesLoading] = useState(false)
  const [servicesLoading, setServicesLoading] = useState(false)
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week')

  // Nouveaux états pour les fonctionnalités supplémentaires
  const [agents, setAgents] = useState<any[]>([])
  const [agentsLoading, setAgentsLoading] = useState(false)
  const [recentTickets, setRecentTickets] = useState<any[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [serviceStats, setServiceStats] = useState<Record<number, any>>({})
  const [activeTab, setActiveTab] = useState('overview')
  const [affluenceService, setAffluenceService] = useState<any>(null)
  const [affluenceData, setAffluenceData] = useState<any>(null)
  const [affluenceLoading, setAffluenceLoading] = useState(false)

  const role = useAppSelector((s) => s.auth.user?.role)
  const user = useAppSelector((s) => s.auth.user)

  // Période affichée et période précédente de même durée (pour les variations)
  const { from, to, prevFrom, prevTo, fromDate, toDate } = useMemo(() => {
    const end = new Date()
    const start = new Date(end)
    let lengthMs: number
    if (timeRange === 'day') {
      start.setHours(0, 0, 0, 0)
      lengthMs = 86400000
    } else if (timeRange === 'week') {
      start.setDate(end.getDate() - 7)
      lengthMs = 7 * 86400000
    } else {
      start.setDate(end.getDate() - 30)
      lengthMs = 30 * 86400000
    }

    return {
      from: start.toISOString(),
      to: end.toISOString(),
      prevFrom: new Date(start.getTime() - lengthMs).toISOString(),
      prevTo: new Date(end.getTime() - lengthMs).toISOString(),
      fromDate: localDateString(start),
      toDate: localDateString(end),
    }
  }, [timeRange])

  const loadStats = async () => {
    if (role !== 'admin') return

    setLoading(true)
    try {
      const [response, previous] = await Promise.all([
        api.get('/api/admin/stats/overview', { params: { from, to } }),
        api.get('/api/admin/stats/overview', { params: { from: prevFrom, to: prevTo } }).catch(() => null),
      ])
      setStats(response.data)
      setPrevStats(previous?.data ?? null)
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401) {
        toast.error('Session expirée. Veuillez vous reconnecter.')
      } else if (status === 403) {
        toast.error('Accès refusé. Permissions administrateur requises.')
      } else if (status === 404) {
        toast.error('Endpoint non trouvé. Vérifiez l\'API.')
      } else if (status >= 500) {
        toast.error('Erreur serveur. Contactez l\'administrateur.')
      } else {
        toast.error('Impossible de charger les statistiques')
      }
      console.error('Erreur lors du chargement des statistiques:', error)
      setStats(null)
    } finally {
      setLoading(false)
    }
  }

  const loadSeries = async () => {
    if (role !== 'admin') return
    setSeriesLoading(true)
    try {
      const response = await api.get('/api/admin/stats/series', {
        params: { from, to, bucket: 'day' },
      })
      setSeries(Array.isArray(response.data?.series) ? response.data.series : [])
    } catch (error: any) {
      console.error('Erreur lors du chargement de la série:', error)
      setSeries([])
    } finally {
      setSeriesLoading(false)
    }
  }

  const loadServices = async () => {
    if (!user?.establishment_id) return
    setServicesLoading(true)
    try {
      const servicesResponse = await api.get(`/api/establishments/${user.establishment_id}/services`, {
        params: { per_page: 50 }
      })
      const servicesData = servicesResponse.data.data || servicesResponse.data || []
      setServices(servicesData)
      prepareServicesCharts(servicesData)
    } catch (error: any) {
      console.error('Erreur lors du chargement des services:', error)
      setServices([])
      setServiceDistribution([])
      setAgentsDistribution([])
    } finally {
      setServicesLoading(false)
    }
  }

  const prepareServicesCharts = async (servicesData: any[]) => {
    try {
      const distribution = servicesData.map((service: any) => ({
        name: service.name,
        value: service.people_waiting || 0
      })).filter((item: any) => item.value > 0)

      setServiceDistribution(distribution)

      const agentsDist = servicesData
        .map((service: any) => ({
          name: service.name,
          value: Number(service.agents_count ?? 0),
          color: '#3b82f6',
        }))
        .filter((row: any) => Number(row.value) > 0)
      setAgentsDistribution(agentsDist)

      servicesData.forEach(async (service) => {
        try {
          const statsRes = await api.get(`/api/admin/stats/services/${service.id}`, {
            params: { from, to }
          })
          setServiceStats(prev => ({
            ...prev,
            [service.id]: statsRes.data
          }))
        } catch (e) {
          console.warn(`Erreur chargement stats service ${service.id}:`, e)
        }
      })

      if (servicesData.length > 0) {
        const firstService = servicesData[0]
        try {
          const { data } = await api.get(`/api/services/${firstService.id}/affluence`)
          setOverviewAffluence(data)
        } catch {
          setOverviewAffluence(null)
        }
      }
    } catch (error) {
      console.error('Erreur lors de la préparation des graphiques:', error)
    }
  }

  const loadAgents = async () => {
    if (role !== 'admin' || !user?.establishment_id) return
    setAgentsLoading(true)
    try {
      const { data } = await api.get('/api/admin/agents', {
        params: { per_page: 50 }
      })
      const agentsData = data.data || data || []
      setAgents(agentsData)
    } catch (error) {
      console.error('Erreur chargement agents:', error)
      setAgents([])
    } finally {
      setAgentsLoading(false)
    }
  }

  const loadRecentTickets = async () => {
    if (role !== 'admin') return
    setTicketsLoading(true)
    try {
      const [{ data }, queue] = await Promise.all([
        api.get('/api/admin/tickets', { params: { per_page: 20, from: fromDate, to: toDate } }),
        // File réelle (ordre d'appel) : la liste « récents » est triée par date de création
        api.get('/api/agent/dashboard/current-queue').catch(() => null),
      ])
      const ticketsData = data.data || data || []
      setRecentTickets(ticketsData)
      setLiveQueue(Array.isArray(queue?.data?.tickets) ? queue!.data.tickets.slice(0, 5) : [])
    } catch (error) {
      console.error('Erreur chargement tickets:', error)
      setRecentTickets([])
    } finally {
      setTicketsLoading(false)
    }
  }

  const loadNotifications = async () => {
    if (role !== 'admin') return
    setNotificationsLoading(true)
    try {
      const { data } = await api.get('/api/notifications', {
        params: { per_page: 5 }
      })
      const notifData = data.data || data || []
      setNotifications(notifData)
    } catch (error) {
      console.error('Erreur chargement notifications:', error)
      setNotifications([])
    } finally {
      setNotificationsLoading(false)
    }
  }

  const refreshAll = () => {
    loadStats()
    loadSeries()
    loadServices()
    loadAgents()
    loadRecentTickets()
    loadNotifications()
  }

  useEffect(() => {
    refreshAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, from, to, user?.establishment_id])

  const exportActivity = async () => {
    if (!user?.establishment_id) return
    try {
      const { data } = await api.get(`/api/admin/establishments/${user.establishment_id}/reports/activity.csv`, {
        params: { from: fromDate, to: toDate },
        responseType: 'blob',
      })
      downloadBlob(data, `activite_${fromDate}_${toDate}.csv`)
    } catch {
      toast.error("Impossible d'exporter le rapport d'activité")
    }
  }

  const lineData = useMemo(() => {
    if (!Array.isArray(series) || series.length === 0) return []

    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
    return series
      .map((row: any) => {
        const raw = row?.bucket
        const bucket = typeof raw === 'string' ? raw : raw ? String(raw) : ''
        const d = new Date(bucket)
        if (!bucket || isNaN(d.getTime())) return null

        return {
          date: bucket,
          name: days[d.getDay()],
          tickets: Number(row.created ?? 0),
          resolved: Number(row.closed ?? 0),
          absent: Number(row.absent ?? 0),
        }
      })
      .filter(Boolean) as any[]
  }, [series])

  const hasSeriesData = useMemo(() => {
    if (!Array.isArray(lineData) || lineData.length === 0) return false
    return lineData.some((r: any) => Number(r?.tickets ?? 0) > 0 || Number(r?.resolved ?? 0) > 0 || Number(r?.absent ?? 0) > 0)
  }, [lineData])

  const pieData = useMemo(() => {
    const created = Number(stats?.tickets?.created ?? 0)
    const closed = Number(stats?.tickets?.closed ?? 0)
    const absent = Number(stats?.tickets?.absent ?? 0)
    const pending = Math.max(created - closed - absent, 0)
    const total = created > 0 ? created : closed + absent + pending

    const toPercent = (v: number) => {
      if (total <= 0) return 0
      return Math.round((v / total) * 100)
    }

    return [
      { name: 'En cours / autres', value: toPercent(pending), color: '#3b82f6', count: pending },
      { name: 'Résolus', value: toPercent(closed), color: '#10b981', count: closed },
      { name: 'Absents', value: toPercent(absent), color: '#f59e0b', count: absent },
    ]
  }, [stats])

  const donutData = useMemo(() => {
    return pieData.map((p) => ({ name: p.name, value: p.value, color: p.color }))
  }, [pieData])

  const hasDonutData = useMemo(() => {
    return donutData.some((d) => Number(d.value) > 0)
  }, [donutData])

  // ─── Smart Insights ─────────────────────────────────────────────────────────
  const insights = useMemo(() => {
    const list: { type: 'positive' | 'warning' | 'negative' | 'info'; icon: any; title: string; description: string }[] = []

    if (!stats) return list

    const created = Number(stats.tickets?.created ?? 0)
    const closed = Number(stats.tickets?.closed ?? 0)
    const absent = Number(stats.tickets?.absent ?? 0)
    const waitAvg = Number(stats.tickets?.wait_avg_minutes ?? 0)
    const resolutionRate = created > 0 ? Math.round((closed / created) * 100) : 0
    const absenceRate = created > 0 ? Math.round((absent / created) * 100) : 0

    // Résolution rate
    if (resolutionRate >= 90) {
      list.push({ type: 'positive', icon: Zap, title: 'Taux de résolution excellent', description: `${resolutionRate}% des tickets ont été traités avec succès sur cette période.` })
    } else if (resolutionRate >= 70) {
      list.push({ type: 'info', icon: Activity, title: 'Taux de résolution correct', description: `${resolutionRate}% de tickets résolus. Objectif : 90%.` })
    } else {
      list.push({ type: 'warning', icon: AlertCircle, title: 'Taux de résolution faible', description: `Seulement ${resolutionRate}% des tickets résolus. Peut-être plus d'agents nécessaires ?` })
    }

    // Temps d'attente
    if (waitAvg > 0) {
      if (waitAvg <= 10) {
        list.push({ type: 'positive', icon: Timer, title: 'Temps d\'attente rapide', description: `Moyenne de ${waitAvg} min — les clients sont servis rapidement.` })
      } else if (waitAvg <= 25) {
        list.push({ type: 'info', icon: Timer, title: 'Temps d\'attente modéré', description: `Moyenne de ${waitAvg} min. Objectif < 15 min.` })
      } else {
        list.push({ type: 'negative', icon: Clock, title: 'Temps d\'attente élevé', description: `Moyenne de ${waitAvg} min — envisagez d'ouvrir plus de guichets.` })
      }
    }

    // Taux d'absence
    if (absenceRate > 20) {
      list.push({ type: 'warning', icon: UserX, title: 'Taux d\'absence anormal', description: `${absenceRate}% des clients ne se sont pas présentés. Envisagez un système de rappel SMS.` })
    } else if (absenceRate > 10) {
      list.push({ type: 'info', icon: UserX, title: 'Taux d\'absence modéré', description: `${absenceRate}% d'absents. Dans la moyenne.` })
    }

    // Volume de tickets
    if (created > 50) {
      list.push({ type: 'info', icon: TrendingUp, title: 'Volume de tickets élevé', description: `${created} tickets créés sur la période — activité soutenue.` })
    }

    // Comparaison créés / fermés
    if (created > 0 && closed > created) {
      list.push({ type: 'positive', icon: CheckCircle, title: 'Rattrapage en cours', description: `Plus de tickets fermés (${closed}) que créés (${created}) — la file se réduit.` })
    } else if (created > 0 && closed < created * 0.5) {
      list.push({ type: 'warning', icon: AlertTriangle, title: 'Accumulation de tickets', description: `Seulement ${closed} fermés pour ${created} créés — la file d'attente s'allonge.` })
    }

    // Services insights
    if (services.length > 0) {
      const servicesWithWait = Object.values(serviceStats).filter((s: any) => s?.tickets?.wait_avg_minutes > 0) as any[]
      if (servicesWithWait.length > 0) {
        const maxWaitService = servicesWithWait.reduce((a: any, b: any) =>
          (a.tickets.wait_avg_minutes || 0) > (b.tickets.wait_avg_minutes || 0) ? a : b
        )
        if (maxWaitService.tickets.wait_avg_minutes > 30) {
          const svc = services.find((s: any) => s.id === Number(Object.keys(serviceStats).find(k => serviceStats[k] === maxWaitService)))
          list.push({ type: 'negative', icon: AlertCircle, title: 'Goulot d\'étranglement', description: `Le service "${svc?.name || 'Inconnu'}" a un temps d'attente moyen de ${maxWaitService.tickets.wait_avg_minutes} min.` })
        }
      }
    }

    return list
  }, [stats, services, serviceStats])

  // ─── SLA Metrics ────────────────────────────────────────────────────────────
  // Attente réelle (création → appel) mesurée par service sur la période
  const slaData = useMemo(() => {
    return services.map((svc: any) => {
      const sStats = (serviceStats as any)[svc.id]?.tickets
      const avgWait = Number(sStats?.wait_avg_minutes ?? 0)
      const targetMin = 15 // SLA target in minutes
      const status: 'healthy' | 'warning' | 'critical' = avgWait <= targetMin ? 'healthy' : avgWait <= targetMin * 1.5 ? 'warning' : 'critical'
      return { ...svc, avgWait, targetMin, status }
    }).filter((s: any) => s.avgWait > 0)
  }, [services, serviceStats])

  // Préparer les données pour le graphique à barres des services
  const barChartData = useMemo(() => {
    return serviceDistribution.map((s, idx) => ({
      name: s.name,
      value: s.value,
      color: `hsl(var(--chart-${(idx % 5) + 1}))`,
    }))
  }, [serviceDistribution])

  return (
    <div className="space-y-6">
      {/* En-tête sans ombre */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Tableau de bord
          </h1>
          <p className="mt-2 text-muted-foreground">
            Bienvenue {user?.name}, voici un aperçu de vos performances
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            className="hidden sm:flex"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
          <div className="inline-flex rounded-lg border border-border p-1 bg-card">
            {(['day', 'week', 'month'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-md transition-all duration-200",
                  timeRange === range
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {range === 'day' ? 'Aujourd\'hui' : range === 'week' ? '7 jours' : '30 jours'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-5">
          <TabsTrigger value="overview">Vue générale</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="activity" className="hidden lg:flex">Activité</TabsTrigger>
        </TabsList>

        {/* ==================== ONGLET OVERVIEW ==================== */}
        <TabsContent value="overview" className="space-y-6">
          {/* Actions rapides */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigate('/dashboard/queues')} size="sm">
              <Ticket className="h-4 w-4 mr-2" />
              Nouveau Ticket
            </Button>
            <Button onClick={() => navigate('/dashboard/agents')} variant="outline" size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Ajouter Agent
            </Button>
            <Button onClick={() => navigate('/dashboard/services')} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau Service
            </Button>
            <Button onClick={() => navigate('/dashboard/push')} variant="outline" size="sm">
              <Mail className="h-4 w-4 mr-2" />
              Notification
            </Button>
          </div>

          {/* Cartes de statistiques — avec comparaison dynamique */}
          {(() => {
            const created = Number(stats?.tickets?.created ?? 0)
            const closed = Number(stats?.tickets?.closed ?? 0)
            const waitAvg = Number(stats?.tickets?.wait_avg_minutes ?? 0)
            const absent = Number(stats?.tickets?.absent ?? 0)
            const effectiveRate = created > 0 ? Math.round((closed / created) * 100) : 0
            const absRate = created > 0 ? Math.round((absent / created) * 100) : 0
            const prevCreated = Number(prevStats?.tickets?.created ?? 0)
            const prevAbsRate = prevCreated > 0 ? Math.round((Number(prevStats?.tickets?.absent ?? 0) / prevCreated) * 100) : null
            const prevWait = Number(prevStats?.tickets?.wait_avg_minutes ?? 0)
            return (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <AnalyticsCard
                  title="Tickets créés"
                  value={created}
                  change={periodChange(created, prevCreated)}
                  icon={Ticket}
                  description="Nouveaux tickets cette période"
                />
                <AnalyticsCard
                  title="Tickets résolus"
                  value={closed}
                  change={periodChange(closed, Number(prevStats?.tickets?.closed ?? 0))}
                  icon={CheckCircle}
                  description={`${effectiveRate}% de taux de résolution`}
                />
                <AnalyticsCard
                  title="Temps d'attente moyen"
                  value={waitAvg > 0 ? `${waitAvg} min` : '—'}
                  change={waitAvg > 0 ? periodChange(waitAvg, prevWait, true) : undefined}
                  icon={Clock}
                  description={waitAvg <= 0 ? 'Aucun appel sur la période' : waitAvg <= 15 ? 'Objectif < 15 min atteint' : 'Au-dessus de l\'objectif de 15 min'}
                />
                <AnalyticsCard
                  title="Taux d'absence"
                  value={created > 0 ? `${absRate}%` : '—'}
                  change={created > 0 ? periodChange(absRate, prevAbsRate, true) : undefined}
                  icon={UserX}
                  description={`${absent} absents sur ${created} tickets`}
                />
              </div>
            )
          })()}

          {/* Smart Insights */}
          {insights.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {insights.slice(0, 4).map((insight, idx) => {
                const Icon = insight.icon
                const borderColor = insight.type === 'positive' ? 'border-emerald-200 dark:border-emerald-900/40'
                  : insight.type === 'warning' ? 'border-amber-200 dark:border-amber-900/40'
                  : insight.type === 'negative' ? 'border-red-200 dark:border-red-900/40'
                  : 'border-blue-200 dark:border-blue-900/40'
                const bgColor = insight.type === 'positive' ? 'bg-emerald-50 dark:bg-emerald-950/20'
                  : insight.type === 'warning' ? 'bg-amber-50 dark:bg-amber-950/20'
                  : insight.type === 'negative' ? 'bg-red-50 dark:bg-red-950/20'
                  : 'bg-blue-50 dark:bg-blue-950/20'
                const iconColor = insight.type === 'positive' ? 'text-emerald-600'
                  : insight.type === 'warning' ? 'text-amber-600'
                  : insight.type === 'negative' ? 'text-red-600'
                  : 'text-blue-600'
                return (
                  <div key={idx} className={`rounded-xl border p-4 ${borderColor} ${bgColor}`}>
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${insight.type === 'positive' ? 'bg-emerald-100 dark:bg-emerald-900/30'
                        : insight.type === 'warning' ? 'bg-amber-100 dark:bg-amber-900/30'
                        : insight.type === 'negative' ? 'bg-red-100 dark:bg-red-900/30'
                        : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                        <Icon className={`h-5 w-5 ${iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{insight.description}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* SLA + Live Queue row */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* SLA Monitoring */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="h-5 w-5" />
                    SLA — Temps d'attente
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">Objectif &lt; 15 min</Badge>
                </div>
                <CardDescription>Respect des objectifs de temps d'attente par service</CardDescription>
              </CardHeader>
              <CardContent>
                {slaData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Aucune donnée SLA disponible.</p>
                ) : (
                  <div className="space-y-3">
                    {slaData.map((svc: any) => {
                      const rawPct = Math.round((svc.avgWait / svc.targetMin) * 100)
                      const pct = Math.min(100, rawPct)
                      return (
                        <div key={svc.id} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-foreground">{svc.name}</span>
                            <span className={cn(
                              "font-semibold",
                              svc.status === 'healthy' && "text-emerald-600",
                              svc.status === 'warning' && "text-amber-600",
                              svc.status === 'critical' && "text-red-600"
                            )}>
                              {svc.avgWait} min
                            </span>
                          </div>
                          <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn(
                                "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
                                svc.status === 'healthy' && "bg-emerald-500",
                                svc.status === 'warning' && "bg-amber-500",
                                svc.status === 'critical' && "bg-red-500"
                              )}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>SLA cible : {svc.targetMin} min</span>
                            <span>{rawPct > 100 ? 'Dépassé' : `${pct}%`}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Mini File Live */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <List className="h-5 w-5" />
                    File d'attente en direct
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/queues')}>
                    Voir tout
                    <ArrowUpRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
                <CardDescription>Les 5 prochains tickets en attente</CardDescription>
              </CardHeader>
              <CardContent>
                {liveQueue.length === 0 ? (
                  <div className="text-center py-6">
                    <Ticket className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Aucun ticket en attente</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {liveQueue.map((ticket: any) => {
                      const elapsed = Number(ticket.wait_time_minutes ?? 0)
                      const isLongWait = elapsed > 15
                      return (
                        <div key={ticket.id} className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                              ticket.priority === 'urgence' ? 'bg-red-100 text-red-700' :
                                ticket.priority === 'vip' ? 'bg-purple-100 text-purple-700' :
                                ticket.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                'bg-blue-100 text-blue-700'
                            )}>
                              {ticket.number?.replace(/[^0-9]/g, '').slice(-2) || '?'}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground leading-tight">
                                {ticket.number}
                                <span className="ml-2 text-xs text-muted-foreground font-normal">
                                  {ticket.user_name || '—'}
                                </span>
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {ticket.service?.name || ticket.service_name || '—'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-xs font-semibold",
                              isLongWait ? 'text-red-600' : elapsed > 10 ? 'text-amber-600' : 'text-muted-foreground'
                            )}>
                              {elapsed} min
                            </span>
                            <Badge variant={ticket.priority === 'urgence' ? 'destructive' : ticket.priority === 'vip' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                              {ticket.priority === 'urgence' ? 'URG' : ticket.priority === 'vip' ? 'VIP' : ticket.priority === 'high' ? 'PRIO' : ''}
                            </Badge>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Graphiques */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Graphique linéaire - Activité des tickets */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChartIcon className="h-5 w-5" />
                  Activité des tickets
                </CardTitle>
                <CardDescription>Évolution des tickets créés / résolus / absents</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[320px]">
                  {seriesLoading ? (
                    <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">Chargement…</div>
                  ) : !hasSeriesData ? (
                    <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
                      Aucune donnée pour la période sélectionnée.
                    </div>
                  ) : (
                    <LineChartComponent
                      data={lineData}
                      lines={[
                        { dataKey: 'tickets', name: 'Tickets créés', stroke: '#3b82f6' },
                        { dataKey: 'resolved', name: 'Tickets résolus', stroke: '#10b981' },
                        { dataKey: 'absent', name: 'Absents', stroke: '#f59e0b' },
                      ]}
                      xAxisDataKey="date"
                    />
                  )}
                </div>
                {/* Légende du graphique linéaire */}
                <div className="flex flex-wrap justify-center gap-4 mt-4 pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-xs text-muted-foreground">Tickets créés</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-xs text-muted-foreground">Tickets résolus</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="text-xs text-muted-foreground">Absents</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Graphique Donut - Répartition des tickets */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Répartition des tickets
                </CardTitle>
                <CardDescription>Distribution par statut</CardDescription>
              </CardHeader>
              <CardContent>
                {hasDonutData ? (
                  <>
                    <div className="h-[240px]">
                      <DonutChart data={donutData} height={240} />
                    </div>
                    {/* Légende avec valeurs réelles */}
                    <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t">
                      {pieData.map((item) => (
                        <div key={item.name} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/30">
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-xs font-medium">{item.name}</span>
                          </div>
                          <span className="text-lg font-bold">{item.value}%</span>
                          <span className="text-xs text-muted-foreground">({item.count} tickets)</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-[320px] w-full flex items-center justify-center text-sm text-muted-foreground">
                    Aucune donnée pour la période sélectionnée.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Section inférieure: Tickets récents et Activité */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Tickets récents */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Ticket className="h-5 w-5" />
                    Tickets récents
                  </CardTitle>
                  <CardDescription>Les derniers tickets créés sur la période</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/tickets')}>
                  Voir tout
                  <ArrowUpRight className="h-4 w-4 ml-1" />
                </Button>
              </CardHeader>
              <CardContent>
                {ticketsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Chargement...</div>
                ) : recentTickets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Aucun ticket récent</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N°</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentTickets.slice(0, 5).map((ticket: any) => (
                        <TableRow key={ticket.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/dashboard/tickets?ticket=${ticket.id}`)}>
                          <TableCell className="font-medium">{ticket.number || `#${ticket.id}`}</TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(ticket.status)}>{statusLabel(ticket.status)}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {ticket.service?.name || ticket.service_name || '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {new Date(ticket.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Flux d'activité / Notifications */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Activité récente
                  </CardTitle>
                  <CardDescription>Notifications et événements récents</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/notifications')}>
                  Voir tout
                  <ArrowUpRight className="h-4 w-4 ml-1" />
                </Button>
              </CardHeader>
              <CardContent>
                {notificationsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Chargement...</div>
                ) : notifications.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Aucune activité récente</div>
                ) : (
                  <div className="space-y-4">
                    {notifications.slice(0, 5).map((notif: any) => (
                      <div key={notif.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate('/dashboard/notifications')}>
                        <div className={cn(
                          "w-2 h-2 rounded-full mt-2 flex-shrink-0",
                          notif.data?.type === 'error' || notif.type === 'error' ? "bg-red-500" :
                            notif.data?.type === 'warning' || notif.type === 'warning' ? "bg-orange-500" :
                              notif.data?.type === 'success' || notif.type === 'success' ? "bg-green-500" : "bg-blue-500"
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {notif.data?.title || notif.data?.subject || 'Notification'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {notif.data?.message || notif.data?.body || ''}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(notif.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ==================== ONGLET TICKETS ==================== */}
        <TabsContent value="tickets" className="space-y-6">
          {/* Cartes de statistiques Tickets */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total tickets</CardDescription>
                <CardTitle className="text-3xl">{stats?.tickets?.created ?? 0}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Sur la période</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>En attente</CardDescription>
                <CardTitle className="text-3xl text-orange-500">{stats?.services?.waiting ?? 0}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Dans la file du jour</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Traités</CardDescription>
                <CardTitle className="text-3xl text-green-500">{stats?.tickets?.closed ?? 0}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Tickets clos sur la période</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Absents</CardDescription>
                <CardTitle className="text-3xl text-red-500">{stats?.tickets?.absent ?? 0}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Clients non présents</p>
              </CardContent>
            </Card>
          </div>

          {/* Graphiques Tickets */}
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartContainer
              title="Évolution des tickets"
              description="Données réelles de la base (série temporelle)"
              actions={
                <Button variant="outline" size="sm" onClick={() => { loadStats(); loadSeries(); }}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Actualiser
                </Button>
              }
            >
              <div className="h-[320px]">
                {seriesLoading ? (
                  <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">Chargement…</div>
                ) : !hasSeriesData ? (
                  <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
                    Aucune donnée pour la période sélectionnée.
                  </div>
                ) : (
                  <VerticalBarChart
                    data={lineData.map((r: any) => ({
                      name: String(r.name ?? ''),
                      value: Number(r.tickets ?? 0),
                      color: '#3b82f6',
                    }))}
                  />
                )}
              </div>
              {/* Légende graphique à barres */}
              <div className="flex justify-center gap-4 mt-4 pt-3 border-t">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-xs text-muted-foreground">Tickets créés</span>
                </div>
              </div>
            </ChartContainer>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Répartition par statut
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="font-medium">En attente</span>
                    </div>
                    <span className="text-xl font-bold">{stats?.services?.waiting || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="font-medium">Traités</span>
                    </div>
                    <span className="text-xl font-bold">{stats?.tickets?.closed || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-orange-500" />
                      <span className="font-medium">Absents</span>
                    </div>
                    <span className="text-xl font-bold">{stats?.tickets?.absent || 0}</span>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Temps d'attente moyen</span>
                    <span className="font-medium">{stats?.tickets?.wait_avg_minutes ? `${stats.tickets.wait_avg_minutes} min` : '—'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tickets récents et Performance */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Ticket className="h-5 w-5" />
                    Tickets récents
                  </CardTitle>
                  <CardDescription>Les derniers tickets de l'établissement</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/tickets')}>
                  Voir tout
                  <ArrowUpRight className="h-4 w-4 ml-1" />
                </Button>
              </CardHeader>
              <CardContent>
                {ticketsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Chargement...</div>
                ) : recentTickets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Aucun ticket récent</div>
                ) : (
                  <div className="space-y-3">
                    {recentTickets.slice(0, 5).map((ticket: any) => (
                      <div key={ticket.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate(`/dashboard/tickets?ticket=${ticket.id}`)}>
                        <div className="flex items-center gap-3">
                          <div className={cn("w-2 h-2 rounded-full", statusDot(ticket.status))} />
                          <div>
                            <p className="font-medium">Ticket {ticket.number || `#${ticket.id}`}</p>
                            <p className="text-sm text-muted-foreground">{ticket.service?.name || ticket.service_name || 'Service inconnu'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={statusVariant(ticket.status)}>{statusLabel(ticket.status)}</Badge>
                          <p className="text-xs text-muted-foreground mt-1">{new Date(ticket.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Performance par service
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {services.slice(0, 5).map((service: any) => {
                    const sStats = serviceStats[service.id]?.tickets
                    const total = sStats?.created || service.people_waiting || 0
                    const closed = sStats?.closed || 0
                    const rate = total > 0 ? Math.round((closed / total) * 100) : 0

                    return (
                      <div key={service.id} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{service.name}</span>
                          <span className="text-muted-foreground">{rate}% traités</span>
                        </div>
                        <Progress value={rate} className="h-2" />
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{service.people_waiting || 0} en attente</span>
                          <Badge variant="outline" className={cn('text-xs', getAffluenceBadge(service.people_waiting || 0).className)}>
                            {getAffluenceBadge(service.people_waiting || 0).label}
                          </Badge>
                          <span>{service.agents_count || 0} agents</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => navigate('/dashboard/queues')}>
              <Ticket className="mr-2 h-4 w-4" />
              Gérer les tickets
            </Button>
          </div>
        </TabsContent>

        {/* ==================== ONGLET SERVICES ==================== */}
        <TabsContent value="services" className="space-y-6">
          {/* Services Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <AnalyticsCard
              title="Services Actifs"
              value={stats?.services?.active || 0}
              icon={Activity}
            />
            <AnalyticsCard
              title="Total Agents"
              value={stats?.services?.agents || 0}
              icon={Users}
            />
            <AnalyticsCard
              title="Tickets en Attente"
              value={stats?.services?.waiting || 0}
              icon={Clock}
            />
            <AnalyticsCard
              title="Temps Moyen"
              value={`${stats?.services?.avgTime || 0}min`}
              icon={TrendingUp}
            />
          </div>

          {/* Services Table with Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Services List */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Services de l'établissement
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={() => navigate('/dashboard/services')}>
                    <ArrowUpRight className="h-4 w-4 mr-1" />
                    Voir tout
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {services?.map((service: any) => (
                      <div key={service.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`w-3 h-3 rounded-full ${service.status === 'open' ? 'bg-green-500' : 'bg-gray-400'}`} />
                          <div>
                            <h4 className="font-semibold">{service.name}</h4>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {service.agents_count || 0} agents
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {service.avg_service_time_minutes}min
                              </span>
                              <span className="flex items-center gap-1">
                                <Ticket className="h-3 w-3" />
                                {service.people_waiting || 0} en attente
                              </span>
                              <Badge variant="outline" className={cn('text-xs', getAffluenceBadge(service.people_waiting || 0).className)}>
                                {getAffluenceBadge(service.people_waiting || 0).label}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={service.status === 'open' ? 'default' : 'secondary'}>
                            {service.status === 'open' ? 'Ouvert' : 'Fermé'}
                          </Badge>
                          {service.priority_support && (
                            <Badge variant="outline" className="border-orange-500 text-orange-500">
                              Prioritaire
                            </Badge>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openAffluence(service, setAffluenceService, setAffluenceData, setAffluenceLoading)} title="Voir les créneaux d'affluence">
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Service Distribution Chart */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5" />
                    Distribution des tickets
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    title="Répartition des Services"
                    config={{
                      tickets: {
                        label: "Tickets",
                        color: "hsl(var(--chart-1))",
                      },
                    }}
                    className="h-fit"
                  >
                    {serviceDistribution.length > 0 ? (
                      <DonutChart
                        data={serviceDistribution.map((d: any, index: number) => ({
                          name: String(d.name ?? ''),
                          value: Number(d.value ?? 0),
                          color: `hsl(var(--chart-${index + 1}))`,
                        }))}
                        height={300}
                      />
                    ) : (
                      <div className="h-[300px] w-full flex items-center justify-center text-sm text-muted-foreground">
                        Aucune donnée.
                      </div>
                    )}
                  </ChartContainer>
                  {/* Légende de la répartition des services */}
                  <div className="mt-4 space-y-2 pt-3 border-t">
                    {serviceDistribution.map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full bg-chart-${index + 1}`} style={{ backgroundColor: `hsl(var(--chart-${index + 1}))` }} />
                          <span>{item.name}</span>
                        </div>
                        <span className="font-medium">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Agents Assignment - Graphique à barres */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Répartition des Agents par Service
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                title="Répartition des Agents par Service"
                className="h-fit"
              >
                {agentsDistribution.length > 0 ? (
                  <VerticalBarChart data={agentsDistribution as any} height={300} />
                ) : (
                  <div className="h-[300px] w-full flex items-center justify-center text-sm text-muted-foreground">
                    Aucune donnée.
                  </div>
                )}
              </ChartContainer>
              {/* Légende graphique à barres agents */}
              <div className="flex justify-center gap-4 mt-4 pt-3 border-t">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-xs text-muted-foreground">Nombre d'agents</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Time-based Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Évolution des tickets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  {hasSeriesData ? (
                    <LineChartComponent
                      data={lineData}
                      lines={[{ dataKey: 'tickets', name: 'Tickets', stroke: '#3b82f6' }]}
                      height={250}
                      xAxisDataKey="date"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
                      Aucune donnée.
                    </div>
                  )}
                </div>
                {/* Légende */}
                <div className="flex justify-center gap-4 mt-4 pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-xs text-muted-foreground">Tickets créés</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Créneaux d'affluence
                </CardTitle>
                <CardDescription>
                  Basé sur l'historique des 30 derniers jours
                </CardDescription>
              </CardHeader>
              <CardContent>
                {overviewAffluence ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                      <div className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        overviewAffluence.level === 'high' ? 'bg-red-500' : overviewAffluence.level === 'medium' ? 'bg-amber-500' : 'bg-green-500'
                      )} />
                      <div className="flex-1">
                        <p className="font-medium">
                          Affluence {overviewAffluence.level === 'high' ? 'élevée' : overviewAffluence.level === 'medium' ? 'modérée' : 'faible'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {overviewAffluence.people ?? 0} en attente · ~{overviewAffluence.eta_avg ?? '--'} min d'attente
                        </p>
                      </div>
                    </div>

                    {overviewAffluence.peak_hours?.high?.length > 0 && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">Heures de pointe 🔴</p>
                        <p className="text-sm text-muted-foreground">
                          {overviewAffluence.peak_hours.high.map((h: number) => `${String(h).padStart(2, '0')}h`).join(', ')}
                        </p>
                      </div>
                    )}

                    {overviewAffluence.peak_hours?.low?.length > 0 && (
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">Heures calmes 🟢</p>
                        <p className="text-sm text-muted-foreground">
                          {overviewAffluence.peak_hours.low.map((h: number) => `${String(h).padStart(2, '0')}h`).join(', ')}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-[120px] w-full flex items-center justify-center text-sm text-muted-foreground">
                    Aucune donnée.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ==================== ONGLET AGENTS ==================== */}
        <TabsContent value="agents" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Agents de l'établissement
                </CardTitle>
                <CardDescription>
                  {agents.filter((a: any) => a.status === 'active').length} actif(s) sur {agents.length}
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => navigate('/dashboard/agents')}>
                <ArrowUpRight className="h-4 w-4 mr-2" />
                Gérer les agents
              </Button>
            </CardHeader>
            <CardContent>
              {agentsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Chargement...</div>
              ) : agents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Aucun agent</div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {agents.map((agent: any) => (
                    <div key={agent.id} className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-blue-100 text-blue-600">
                          {agent.name?.charAt(0)?.toUpperCase() || 'A'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{agent.name}</p>
                        <p className="text-sm text-muted-foreground truncate">{agent.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={agent.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                            {agent.status === 'active' ? 'Actif' : 'Inactif'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {(agent.services || []).length} service(s)
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Répartition rapide */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Répartition par statut</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Actifs</span>
                    <span className="font-medium">{agents.filter((a: any) => a.status === 'active').length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Inactifs</span>
                    <span className="font-medium">{agents.filter((a: any) => a.status !== 'active').length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Services couverts</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {services.filter((s: any) => Number(s.agents_count ?? 0) > 0).length}/{services.length}
                </p>
                <p className="text-sm text-muted-foreground">services avec au moins un agent assigné</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ==================== ONGLET ACTIVITÉ ==================== */}
        <TabsContent value="activity" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Tous les tickets récents */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ticket className="h-5 w-5" />
                  Tous les tickets récents
                </CardTitle>
                <CardDescription>Les 20 derniers tickets de la période</CardDescription>
              </CardHeader>
              <CardContent>
                {ticketsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Chargement...</div>
                ) : recentTickets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Aucun ticket récent</div>
                ) : (
                  <div className="space-y-3">
                    {recentTickets.map((ticket: any) => (
                      <div key={ticket.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate(`/dashboard/tickets?ticket=${ticket.id}`)}>
                        <div className="flex items-center gap-3">
                          <div className={cn("w-2 h-2 rounded-full", statusDot(ticket.status))} />
                          <div>
                            <p className="font-medium">Ticket {ticket.number || `#${ticket.id}`}</p>
                            <p className="text-sm text-muted-foreground">
                              {ticket.service?.name || ticket.service_name || 'Service inconnu'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={statusVariant(ticket.status)}>{statusLabel(ticket.status)}</Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(ticket.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Statistiques rapides */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Performance par service
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {services.slice(0, 5).map((service: any) => {
                      const sStats = serviceStats[service.id]?.tickets
                      const total = sStats?.created || 0
                      const closed = sStats?.closed || 0
                      const rate = total > 0 ? Math.round((closed / total) * 100) : 0

                      return (
                        <div key={service.id} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{service.name}</span>
                            <span className="text-muted-foreground">{rate}% traités</span>
                          </div>
                          <Progress value={rate} className="h-2" />
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{sStats?.created || 0} créés</span>
                            <span>{sStats?.closed || 0} clos</span>
                            <span>{service.people_waiting || 0} en attente</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    Exports rapides
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/dashboard/admin/notification-logs')}>
                    <Mail className="h-4 w-4 mr-2" />
                    Logs de notifications
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={exportActivity}>
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Rapport d'activité (CSV, période affichée)
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Affluence Dialog */}
      <Dialog open={!!affluenceService} onOpenChange={(open) => { if (!open) setAffluenceService(null); }}>
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
                  <p className="text-2xl font-bold">{affluenceData.people ?? 0}</p>
                  <p className="text-xs text-muted-foreground">En attente</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold">~{affluenceData.eta_avg ?? '--'} min</p>
                  <p className="text-xs text-muted-foreground">Attente moyenne</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className={cn('w-3 h-3 rounded-full', affluenceData.level === 'high' ? 'bg-red-500' : affluenceData.level === 'medium' ? 'bg-amber-500' : 'bg-green-500')} />
                    <p className="text-2xl font-bold">{affluenceData.level === 'high' ? 'Élevée' : affluenceData.level === 'medium' ? 'Modérée' : 'Faible'}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Niveau d'affluence</p>
                </div>
              </div>

              {affluenceData.hourly_data && affluenceData.hourly_data.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Créneaux horaires (30 jours)</h4>
                  <ChartContainer title="" description="">
                    <VerticalBarChart
                      data={affluenceData.hourly_data.map((pt: any) => ({
                        name: `${String(pt.hour).padStart(2, '0')}h`,
                        value: pt.count,
                        color: affluenceData.peak_hours?.high?.includes(pt.hour) ? '#ef4444'
                          : affluenceData.peak_hours?.medium?.includes(pt.hour) ? '#f59e0b'
                          : '#22c55e60',
                      }))}
                      height={220}
                    />
                  </ChartContainer>
                  <div className="flex items-center justify-center gap-6 mt-2">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500" /><span className="text-xs text-muted-foreground">Peak</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-amber-500" /><span className="text-xs text-muted-foreground">Moyen</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-green-500/40" /><span className="text-xs text-muted-foreground">Calme</span></div>
                  </div>
                </div>
              )}

              {affluenceData.peak_hours?.high?.length > 0 && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Heures de pointe : {affluenceData.peak_hours.high.map((h: number) => `${String(h).padStart(2, '0')}h`).join(', ')}.
                    Prévoyez des ressources supplémentaires sur ces créneaux.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">Impossible de charger les données d'affluence.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}