import { useEffect, useState } from 'react'
import { api } from '@/api/axios'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoadingState, ErrorState } from '@/components/ui/loading-state'
import { Activity, Building2, Server, Database, Zap, AlertTriangle, CheckCircle, Clock, RefreshCw, Star, XCircle } from 'lucide-react'
import { VerticalBarChart, DonutChart, LineChartComponent } from '@/components/ui/charts'
import { SUBSCRIPTION_STATUS_LABELS } from '@/lib/plans'

interface MonitoringData {
  days: number
  establishments: number
  establishments_active: number
  establishments_new: number
  services: { total: number; open: number; closed: number }
  counters: { total: number; open: number; closed: number }
  tickets: { total: number; waiting: number; called: number; absent: number; processed: number; period_total: number }
  performance: { avg_wait_time: number | null; avg_service_time: number | null; rating_avg: number | null; reviews_count: number }
  subscriptions_by_status: Record<string, number>
  timeline: Array<{ date: string; establishments: number; tickets: number }>
  system: {
    uptime: string | null
    cpu_usage: number | null
    memory_usage: number | null
    disk_usage: number | null
    db_status: string
    cache_status: string
    pending_jobs: number | null
    failed_jobs: number | null
  }
}

const STATUS_COLORS: Record<string, string> = {
  active: '#10b981',
  trial: '#3b82f6',
  past_due: '#f59e0b',
  canceled: '#ef4444',
}

function StatusRow({ icon: Icon, label, value, ok }: { icon: any; label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{value}</span>
        {ok ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
      </div>
    </div>
  )
}

export default function SaasMonitoring() {
  const [days, setDays] = useState<7 | 30 | 90>(30)
  const [data, setData] = useState<MonitoringData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get('/api/saas/monitoring/overview', { params: { days } })
      setData(data)
    } catch (e: any) {
      const message = e?.response?.status === 403 ? 'Accès refusé. Permissions super admin requises.' : 'Impossible de charger le monitoring'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days])

  if (loading && !data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <LoadingState message="Chargement du monitoring..." size="lg" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <ErrorState message={error} onRetry={load} />
      </div>
    )
  }

  const subscriptionData = Object.entries(data?.subscriptions_by_status ?? {}).map(([status, value]) => ({
    name: SUBSCRIPTION_STATUS_LABELS[status] ?? status,
    value,
    color: STATUS_COLORS[status] ?? '#6b7280',
  }))

  const ticketsData = data
    ? [
        { name: 'En attente', value: data.tickets.waiting, color: '#3b82f6' },
        { name: 'Appelés', value: data.tickets.called, color: '#10b981' },
        { name: 'Absents', value: data.tickets.absent, color: '#f59e0b' },
        { name: 'Servis', value: data.tickets.processed, color: '#8b5cf6' },
      ]
    : []

  const sys = data?.system
  const systemData = sys
    ? [
        { name: 'CPU', value: sys.cpu_usage ?? 0, color: '#3b82f6' },
        { name: 'Mémoire', value: sys.memory_usage ?? 0, color: '#10b981' },
        { name: 'Disque', value: sys.disk_usage ?? 0, color: '#f59e0b' },
      ]
    : []

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Monitoring</h1>
            <p className="text-muted-foreground">Activité de la plateforme et état du serveur</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-border p-1 bg-card">
              {([7, 30, 90] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setDays(range)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md ${days === range ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
                >
                  {range} j
                </button>
              ))}
            </div>
            <Button variant="outline" onClick={load} disabled={loading} className="flex items-center gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Établissements</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.establishments ?? 0}</div>
              <p className="text-xs text-muted-foreground">{data?.establishments_new ?? 0} nouveau(x) sur {days} jours</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Services ouverts</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.services?.open ?? 0}</div>
              <p className="text-xs text-muted-foreground">sur {data?.services?.total ?? 0} au total</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tickets aujourd'hui</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.tickets?.total ?? 0}</div>
              <p className="text-xs text-muted-foreground">{data?.tickets?.period_total ?? 0} sur {days} jours</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Satisfaction</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data?.performance?.rating_avg != null ? `${data.performance.rating_avg.toFixed(1)} / 5` : '—'}
              </div>
              <p className="text-xs text-muted-foreground">{data?.performance?.reviews_count ?? 0} avis sur {days} jours</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
            <TabsTrigger value="overview">Aperçu</TabsTrigger>
            <TabsTrigger value="subscriptions">Abonnements</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="system">Serveur</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Tickets du jour par statut</CardTitle>
                  <CardDescription>Tous établissements confondus</CardDescription>
                </CardHeader>
                <CardContent>
                  <VerticalBarChart data={ticketsData} height={280} showLabels />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Évolution sur {days} jours</CardTitle>
                  <CardDescription>Tickets créés et nouveaux établissements par jour</CardDescription>
                </CardHeader>
                <CardContent>
                  <LineChartComponent
                    data={data?.timeline ?? []}
                    xAxisDataKey="date"
                    lines={[
                      { dataKey: 'tickets', stroke: 'hsl(var(--chart-2))', name: 'Tickets' },
                      { dataKey: 'establishments', stroke: 'hsl(var(--primary))', name: 'Établissements' },
                    ]}
                    height={280}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="subscriptions" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Abonnements par statut</CardTitle>
                </CardHeader>
                <CardContent>
                  {subscriptionData.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-12 text-center">Aucun abonnement enregistré.</p>
                  ) : (
                    <DonutChart data={subscriptionData} height={300} innerRadius={70} outerRadius={100} />
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Détail</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {subscriptionData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <span className="text-lg font-bold">{item.value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Indicateurs sur {days} jours</CardTitle>
                <CardDescription>Moyennes calculées sur les tickets appelés de la période</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Attente (création → appel)</p>
                  <p className="text-2xl font-bold">{data?.performance?.avg_wait_time != null ? `${data.performance.avg_wait_time} min` : '—'}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Service (appel → clôture)</p>
                  <p className="text-2xl font-bold">{data?.performance?.avg_service_time != null ? `${data.performance.avg_service_time} min` : '—'}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Guichets ouverts</p>
                  <p className="text-2xl font-bold">
                    {data?.counters?.open ?? 0} / {data?.counters?.total ?? 0}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Ressources du serveur (%)</CardTitle>
                  <CardDescription>
                    {sys?.cpu_usage == null && sys?.memory_usage == null ? "Mesures non disponibles sur cet hébergement" : 'Charge CPU, mémoire et disque'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <VerticalBarChart data={systemData} height={280} showLabels />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>État des composants</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <StatusRow icon={Clock} label="Disponibilité du serveur" value={sys?.uptime ?? 'non mesurée'} ok={!!sys?.uptime} />
                  <StatusRow icon={Database} label="Base de données" value={sys?.db_status ?? '—'} ok={sys?.db_status === 'Healthy'} />
                  <StatusRow icon={Zap} label="Cache" value={sys?.cache_status ?? '—'} ok={sys?.cache_status === 'Active'} />
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Jobs en échec</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">{sys?.failed_jobs ?? '—'}</span>
                      <Badge variant={sys?.failed_jobs ? 'destructive' : 'secondary'}>
                        {sys?.pending_jobs ?? 0} en attente
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Server className="h-3 w-3" /> Le détail des erreurs est visible dans Profil → Système.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
