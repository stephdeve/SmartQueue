import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/api/axios'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { 
  Building2, 
  Users, 
  Clock, 
  TrendingUp, 
  MapPin, 
  Phone, 
  Mail,
  Calendar,
  Activity,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  Settings,
  Edit,
  Star,
  ArrowUp,
  ArrowDown,
  Timer,
  UserCheck,
  Lightbulb,
  RefreshCw,
  ChevronRight,
  Zap,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ChartContainer } from '@/components/ui/chart-container'
import { VerticalBarChart } from '@/components/ui/charts'
import { cn, localDateString } from '@/lib/utils'

interface Establishment {
  id: number
  name: string
  address?: string | null
  lat?: number | null
  lng?: number | null
  open_at?: string | null
  close_at?: string | null
  is_active?: boolean
  created_at?: string
}

interface EstablishmentStats {
  total_agents: number
  active_agents: number
  total_services: number
  active_services: number
  today_tickets: number
  closed_tickets: number
  absent_tickets: number
  waiting_now: number
  avg_wait_time: number
  rating_avg: number | null
  rating_count: number
  /** Variation (%) des tickets créés sur 30 jours vs les 30 jours précédents */
  monthly_growth: number | null
}

export default function Establishments() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [establishment, setEstablishment] = useState<Establishment | null>(null)
  const [stats, setStats] = useState<EstablishmentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const activeRequestIdRef = useRef(0)
  const [editForm, setEditForm] = useState<Establishment>({
    id: 0,
    name: '',
    address: null,
    lat: null,
    lng: null,
    open_at: '',
    close_at: '',
    is_active: true
  })
  const [agents, setAgents] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [weeklyTrend, setWeeklyTrend] = useState<any[]>([])
  const [peakHoursData, setPeakHoursData] = useState<any[]>([])
  const [affluenceByService, setAffluenceByService] = useState<Record<number, any>>({})
  const [affluenceDialogService, setAffluenceDialogService] = useState<any>(null)
  const [affluenceDialogData, setAffluenceDialogData] = useState<any>(null)
  const [affluenceDialogLoading, setAffluenceDialogLoading] = useState(false)

  const unwrapApiData = <T,>(payload: any): T => {
    if (payload && typeof payload === 'object' && 'data' in payload) {
      return payload.data as T
    }
    return payload as T
  }

  const loadEstablishment = async (): Promise<number | null> => {
    try {
      setLoading(true)
      
      const response = await api.get('/api/me')
      const userData = response.data
      
      if (userData.establishment_id) {
        const estResponse = await api.get(`/api/establishments/${userData.establishment_id}`)
        const estPayload = unwrapApiData<any>(estResponse.data)
        
        const establishmentData = {
          id: estPayload?.id || 0,
          name: estPayload?.name || '',
          address: estPayload?.address || null,
          lat: estPayload?.lat ?? null,
          lng: estPayload?.lng ?? null,
          open_at: estPayload?.open_at || null,
          close_at: estPayload?.close_at || null,
          is_active: estPayload?.is_active !== false,
          created_at: estPayload?.created_at,
        }
        
        setEstablishment(establishmentData)
        setEditForm(establishmentData)

        return Number(userData.establishment_id)
      } else {
        toast.error('Aucun établissement associé à votre compte')
        return null
      }
    } catch (error: any) {
      console.error('Erreur chargement établissement:', error)
      const status = error?.response?.status
      if (status === 401) {
        toast.error('Session expirée. Veuillez vous reconnecter.')
      } else if (status === 403) {
        toast.error('Accès refusé. Permissions administrateur requises.')
      } else if (status === 404) {
        toast.error('Établissement non trouvé.')
      } else if (status >= 500) {
        toast.error('Erreur serveur. Contactez l\'administrateur.')
      } else {
        toast.error('Impossible de charger les informations de l\'établissement')
      }

      return null
    } finally {
      setLoading(false)
    }
  }

  const loadAll = async () => {
    const requestId = ++activeRequestIdRef.current

    const establishmentId = await loadEstablishment()
    if (requestId !== activeRequestIdRef.current) return

    if (establishmentId) {
      await Promise.all([loadStats(establishmentId), loadWeeklyTrend()])
    }
  }

  const loadStats = async (establishmentId: number) => {
    try {
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)

      const [agentsResponse, servicesResponse, todayResponse, monthResponse, reviewsResponse] = await Promise.all([
        api.get('/api/admin/agents'),
        api.get(`/api/establishments/${establishmentId}/services`, { params: { per_page: 100 } }),
        api.get('/api/admin/stats/overview', { params: { from: startOfToday.toISOString(), to: new Date().toISOString() } }),
        api.get('/api/admin/stats/advanced', { params: { period: 'month' } }),
        api.get('/api/admin/reviews/stats').catch(() => ({ data: null })),
      ])

      const agentsPayload = unwrapApiData<any>(agentsResponse.data)
      const agentsData = agentsPayload?.data || agentsPayload || []
      const servicesPayload = unwrapApiData<any>(servicesResponse.data)
      const servicesData = servicesPayload?.data || servicesPayload || []
      const today = todayResponse.data || {}
      const month = monthResponse.data || {}

      const establishmentAgents = Array.isArray(agentsData) ? agentsData : []
      const establishmentServices = Array.isArray(servicesData) ? servicesData : []

      setAgents(establishmentAgents)
      setServices(establishmentServices)
      setPeakHoursData(Array.isArray(month?.by_hour) ? month.by_hour : [])
      loadAffluence(establishmentServices)

      const total = Number(month?.kpis?.total ?? 0)
      const prevTotal = Number(month?.prev_kpis?.total ?? 0)

      setStats({
        total_agents: establishmentAgents.length,
        active_agents: establishmentAgents.filter((agent: any) => agent.status === 'active').length,
        total_services: establishmentServices.length,
        active_services: establishmentServices.filter((service: any) => service.status === 'open').length,
        today_tickets: Number(today?.tickets?.created ?? 0),
        closed_tickets: Number(today?.tickets?.closed ?? 0),
        absent_tickets: Number(today?.tickets?.absent ?? 0),
        waiting_now: Number(today?.services?.waiting ?? 0),
        avg_wait_time: Number(today?.tickets?.wait_avg_minutes ?? 0),
        rating_avg: reviewsResponse.data?.global_avg ?? null,
        rating_count: Number(reviewsResponse.data?.total ?? 0),
        monthly_growth: prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null,
      })
    } catch (error: any) {
      console.error('Erreur chargement statistiques:', error)
      toast.error("Impossible de charger les statistiques de l'établissement")
      setStats(null)
    }
  }

  const loadWeeklyTrend = async () => {
    try {
      const now = new Date()
      const from = localDateString(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000))
      const to = localDateString(now)
      const response = await api.get('/api/admin/stats/series', { params: { bucket: 'day', from, to } })
      const series = response.data?.series || []
      setWeeklyTrend(Array.isArray(series) ? series : [])
    } catch (error) {
      console.error('Erreur chargement tendance hebdo:', error)
      setWeeklyTrend([])
    }
  }

  const loadAffluence = async (servicesList: any[]) => {
    if (servicesList.length === 0) return;
    const results: Record<number, any> = {};
    await Promise.all(servicesList.map(async (s: any) => {
      try {
        const { data } = await api.get(`/api/services/${s.id}/affluence`);
        results[s.id] = data;
      } catch {
        results[s.id] = null;
      }
    }));
    setAffluenceByService(results);
  };

  const openAffluenceDialog = async (service: any) => {
    setAffluenceDialogService(service);
    setAffluenceDialogData(null);
    setAffluenceDialogLoading(true);
    try {
      const { data } = await api.get(`/api/services/${service.id}/affluence`);
      setAffluenceDialogData(data);
    } catch {
      setAffluenceDialogData(null);
    } finally {
      setAffluenceDialogLoading(false);
    }
  };

  const updateEstablishment = async () => {
    if (!establishment) return
    
    try {
      const { id: _id, created_at: _createdAt, ...payload } = editForm
      
      if (!payload.name || payload.name.trim().length < 2) {
        toast.error('Le nom de l\'établissement est requis (minimum 2 caractères)')
        return
      }
      
      await api.put(`/api/admin/establishments/${establishment.id}`, payload)
      
      const updatedData = {
        ...establishment,
        ...payload
      }
      setEstablishment(updatedData)
      setEditMode(false)
      
      toast.success('Établissement mis à jour avec succès')
      
      if (establishment.id) {
        loadStats(establishment.id)
      }
      
    } catch (error: any) {
      console.error('Erreur mise à jour établissement:', error)
      const status = error?.response?.status
      const message = error?.response?.data?.error?.message || error?.response?.data?.message
      
      if (status === 401) {
        toast.error('Session expirée. Veuillez vous reconnecter.')
      } else if (status === 403) {
        toast.error('Permission refusée pour modifier cet établissement.')
      } else if (status === 404) {
        toast.error('Établissement non trouvé.')
      } else if (status === 422) {
        toast.error(message || 'Données invalides. Veuillez vérifier le formulaire.')
      } else if (status >= 500) {
        toast.error('Erreur serveur lors de la mise à jour.')
      } else {
        toast.error(message || 'Erreur de mise à jour')
      }
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  // « Actif » : activité sur l'API (jeton utilisé) dans les 15 dernières minutes
  const onlineSince = Date.now() - 15 * 60 * 1000
  const onlineAgents = agents.filter((agent: any) => {
    const seen = agent.last_seen_at ? new Date(String(agent.last_seen_at).replace(' ', 'T')).getTime() : NaN
    return Number.isFinite(seen) && seen > onlineSince
  })

  const waitingCount = stats?.waiting_now ?? 0
  const peakHours = peakHoursData.filter((h: any) => h.peak).map((h: any) => `${String(h.hour).padStart(2, '0')}h`)
  const servicesWithoutAgents = services.filter((s: any) => Number(s.agents_count ?? 0) === 0)
  const closedServices = services.filter((s: any) => s.status !== 'open')

  const sortedServices = [...services].sort(
    (a: any, b: any) => (a.avg_service_time_minutes ?? 999) - (b.avg_service_time_minutes ?? 999)
  ).slice(0, 5)

  const formatDayLabel = (dateStr: string) => {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('fr-FR', { weekday: 'short' })
  }

  const trendData = weeklyTrend.map((day: any) => ({
    name: formatDayLabel(day.bucket),
    value: Number(day.created ?? 0),
    color: '#3b82f6'
  }))

  const maxPeakCount = peakHoursData.length > 0
    ? Math.max(...peakHoursData.map((h: any) => Number(h.total ?? 0)), 1)
    : 1

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="relative flex flex-col items-center gap-6">
        <div className="absolute w-40 h-40 bg-primary/10 rounded-full blur-3xl animate-pulse" />

        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-4 " />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
        </div>
      </div>
      </div>
    )
  }

  if (!establishment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Building2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Aucun établissement</h2>
          <p className="text-muted-foreground">Vous n'avez pas d'établissement associé à votre compte.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header avec informations de l'établissement */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                    <Building2 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-foreground">
                      {establishment?.name || 'Chargement...'}
                    </h1>
                    <p className="text-sm text-muted-foreground font-medium">
                      ID: #{establishment?.id || 'N/A'}
                    </p>
                  </div>
                </div>
                <Badge 
                  variant={establishment?.is_active ? "default" : "secondary"}
                  className="text-xs px-3 py-1"
                >
                  {establishment?.is_active ? 'Actif' : 'Inactif'}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                Gérez votre établissement et consultez ses performances en temps réel
              </p>
            </div>
            <Dialog open={editMode} onOpenChange={setEditMode}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Edit className="h-4 w-4" />
                  Modifier
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Modifier l'établissement</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nom de l'établissement</Label>
                    <Input
                      id="name"
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      placeholder="Entrez le nom de l'établissement"
                    />
                  </div>
                  <div>
                    <Label htmlFor="address">Adresse</Label>
                    <Textarea
                      id="address"
                      value={editForm.address || ''}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      rows={3}
                      placeholder="Entrez l'adresse complète"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="open_at">Heure d'ouverture</Label>
                      <Input
                        id="open_at"
                        type="time"
                        value={editForm.open_at || ''}
                        onChange={(e) => setEditForm({ ...editForm, open_at: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="close_at">Heure de fermeture</Label>
                      <Input
                        id="close_at"
                        type="time"
                        value={editForm.close_at || ''}
                        onChange={(e) => setEditForm({ ...editForm, close_at: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button onClick={updateEstablishment}>Enregistrer</Button>
                    <Button variant="outline" onClick={() => setEditMode(false)}>Annuler</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Carte d'information principale */}
      <Card className="border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Building2 className="h-5 w-5" />
            Informations générales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Adresse</p>
                <p className="font-medium">{establishment.address || 'Non spécifiée'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Clock className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Horaires</p>
                <p className="font-medium">
                  {establishment.open_at && establishment.close_at 
                    ? `${String(establishment.open_at).slice(0, 5)} - ${String(establishment.close_at).slice(0, 5)}`
                    : 'Non spécifiés'
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Créé le</p>
                <p className="font-medium">
                  {(() => {
                    const created = establishment.created_at
                    if (!created) return '—'
                    const d = new Date(created)
                    if (Number.isNaN(d.getTime())) return '—'
                    return d.toLocaleDateString('fr-FR')
                  })()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Activity className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Statut</p>
                <Badge variant={establishment.is_active ? "default" : "secondary"}>
                  {establishment.is_active ? 'Actif' : 'Inactif'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistiques principales */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Agents actifs</p>
                  <p className="text-2xl font-bold text-foreground">
                    {stats.active_agents}/{stats.total_agents}
                  </p>
                  <div className="flex items-center gap-1 mt-2">
                    {stats.total_agents > 0 ? (
                      <>
                        <ArrowUp className="h-4 w-4 text-green-500" />
                        <span className="text-xs text-green-500">
                          {Math.round((stats.active_agents / stats.total_agents) * 100)}% actifs
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Aucun agent</span>
                    )}
                  </div>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              {stats.total_agents > 0 && (
                <div className="mt-4">
                  <Progress value={(stats.active_agents / stats.total_agents) * 100} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Services actifs</p>
                  <p className="text-2xl font-bold text-foreground">
                    {stats.active_services}/{stats.total_services}
                  </p>
                  <div className="flex items-center gap-1 mt-2">
                    {stats.total_services > 0 ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-xs text-green-500">
                          {Math.round((stats.active_services / stats.total_services) * 100)}% opérationnels
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Aucun service</span>
                    )}
                  </div>
                </div>
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Settings className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
              {stats.total_services > 0 && (
                <div className="mt-4">
                  <Progress value={(stats.active_services / stats.total_services) * 100} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tickets aujourd'hui</p>
                  <p className="text-2xl font-bold text-foreground">{stats.today_tickets}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-xs text-muted-foreground">
                      {stats.closed_tickets} clos
                      {' • '}
                      {stats.absent_tickets} absents
                    </span>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Satisfaction</p>
                  <p className="text-2xl font-bold text-foreground">
                    {stats.rating_avg !== null ? `${Number(stats.rating_avg).toFixed(1)} / 5` : 'N/A'}
                  </p>
                  <div className="flex items-center gap-1 mt-2">
                    {stats.rating_avg !== null ? (
                      <>
                        <Star className="h-4 w-4 text-yellow-500" />
                        <span className="text-xs text-yellow-500">{stats.rating_count} avis</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Aucun avis pour l'instant</span>
                    )}
                  </div>
                </div>
                <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <Star className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
              {stats.rating_avg !== null && (
                <div className="mt-4">
                  <Progress value={(Number(stats.rating_avg) / 5) * 100} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Queue Status at a Glance + Agent Online Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">En file d'attente</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-foreground">{waitingCount}</p>
                  <span
                    className={cn(
                      "inline-block w-3 h-3 rounded-full",
                      waitingCount < 5 ? "bg-green-500" : waitingCount <= 15 ? "bg-amber-500" : "bg-red-500"
                    )}
                  />
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <span className="text-xs text-muted-foreground">
                    {stats?.closed_tickets ?? 0} servi(s) aujourd'hui
                  </span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Timer className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Agents actifs (15 min)</p>
                <p className="text-2xl font-bold text-foreground">{onlineAgents.length}</p>
                <div className="flex items-center gap-1 mt-2">
                  {onlineAgents.length > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {onlineAgents.slice(0, 3).map((a: any) => a.name || a.email).join(', ')}
                      {onlineAgents.length > 3 && ` +${onlineAgents.length - 3}`}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Aucune activité récente</span>
                  )}
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <UserCheck className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Trend Mini Chart + Service Performance Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer
          title="Tendance hebdomadaire"
          description="Derniers 7 jours d'activité"
        >
          <VerticalBarChart data={trendData} height={200} />
          <div className="flex justify-center gap-4 mt-4 pt-3 border-t">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-xs text-muted-foreground">Créés</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Total 7 jours : {weeklyTrend.reduce((s: number, d: any) => s + Number(d.created ?? 0), 0)} créés ·{' '}
                {weeklyTrend.reduce((s: number, d: any) => s + Number(d.closed ?? 0), 0)} servis ·{' '}
                {weeklyTrend.reduce((s: number, d: any) => s + Number(d.absent ?? 0), 0)} absents
              </span>
            </div>
          </div>
        </ChartContainer>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Durée de service estimée
            </CardTitle>
            <CardDescription>Temps moyen par usager utilisé pour calculer l'attente</CardDescription>
          </CardHeader>
          <CardContent>
            {sortedServices.length > 0 ? (
              <div className="space-y-3">
                {sortedServices.map((service: any, index: number) => {
                  const time = service.avg_service_time_minutes ?? null
                  const rankLabel = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`
                  const timeColor = time !== null
                    ? (time <= 5 ? 'text-green-600' : time <= 15 ? 'text-amber-600' : 'text-red-600')
                    : 'text-muted-foreground'
                  return (
                    <div key={service.id || index} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold w-8 text-center">{rankLabel}</span>
                        <span className="text-sm font-medium">{service.name || service.service_name || `Service #${service.id}`}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={cn("text-sm font-semibold", timeColor)}>
                          {time !== null ? `${time} min` : 'N/A'}
                        </span>
                        <span className={cn(
                          "inline-block w-2.5 h-2.5 rounded-full",
                          service.status === 'open' ? 'bg-green-500' : 'bg-gray-400'
                        )} />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Aucun service disponible
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Informations détaillées */}
      {/* Créneaux d'affluence par service */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Créneaux d'affluence
          </CardTitle>
          <CardDescription>Niveau d'affluence actuel par service — cliquez pour voir les créneaux horaires</CardDescription>
        </CardHeader>
        <CardContent>
          {services.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {services.map((service: any) => {
                const aff = affluenceByService[service.id];
                const level = aff?.level || 'low';
                return (
                  <div key={service.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => openAffluenceDialog(service)}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn("w-2 h-2 rounded-full shrink-0", level === 'high' ? 'bg-red-500' : level === 'medium' ? 'bg-amber-500' : 'bg-green-500')} />
                      <span className="text-sm font-medium truncate">{service.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={cn("text-xs", level === 'high' ? 'text-red-600 border-red-200 bg-red-50 dark:bg-red-900/20' : level === 'medium' ? 'text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-900/20' : 'text-green-600 border-green-200 bg-green-50 dark:bg-green-900/20')}>
                        {aff?.people ?? 0} · {level === 'high' ? 'Élevée' : level === 'medium' ? 'Modérée' : 'Faible'}
                      </Badge>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">Aucun service disponible</div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5" />
              Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Temps d'attente moyen (aujourd'hui)</span>
                  <span className="font-medium">
                    {stats.avg_wait_time > 0 ? `${stats.avg_wait_time} min` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Tickets sur 30 jours vs 30 jours précédents</span>
                  <div className="flex items-center gap-1">
                    {stats.monthly_growth === null ? (
                      <span className="font-medium text-muted-foreground">—</span>
                    ) : stats.monthly_growth > 0 ? (
                      <>
                        <ArrowUp className="h-4 w-4 text-green-500" />
                        <span className="font-medium text-green-500">+{stats.monthly_growth}%</span>
                      </>
                    ) : stats.monthly_growth < 0 ? (
                      <>
                        <ArrowDown className="h-4 w-4 text-red-500" />
                        <span className="font-medium text-red-500">{stats.monthly_growth}%</span>
                      </>
                    ) : (
                      <span className="font-medium text-muted-foreground">Stable</span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Tickets par heure (30 jours)</span>
                  </div>
                  {peakHoursData.length > 0 ? (
                    <div className="flex items-end gap-1 h-16">
                      {peakHoursData.map((hour: any, idx: number) => {
                        const count = Number(hour.total ?? 0)
                        const heightPct = Math.max((count / maxPeakCount) * 100, 4)
                        const isPeak = hour.peak === true
                        return (
                          <div
                            key={idx}
                            className="flex-1 flex flex-col items-center gap-1 group relative"
                          >
                            <div
                              className={cn(
                                "w-full rounded-t transition-all duration-200 hover:opacity-80",
                                isPeak ? "bg-amber-500" : "bg-gray-300 dark:bg-gray-600"
                              )}
                              style={{ height: `${heightPct}%` }}
                            />
                            <span className="text-[8px] text-muted-foreground">{hour.hour ?? idx}</span>
                            <div className="absolute bottom-full mb-1 hidden group-hover:block bg-background border border-border rounded px-2 py-1 text-xs whitespace-nowrap z-10">
                              {String(hour.hour ?? idx).padStart(2, '0')}h: {count} ticket{count > 1 ? 's' : ''}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Pas encore de données</span>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Alertes et remarques
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {servicesWithoutAgents.length > 0 && (
              <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    {servicesWithoutAgents.length} service(s) sans agent assigné
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-300">
                    {servicesWithoutAgents.slice(0, 3).map((s: any) => s.name).join(', ')}
                  </p>
                </div>
              </div>
            )}
            {closedServices.length > 0 && (
              <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{closedServices.length} service(s) fermé(s) actuellement</p>
                  <p className="text-xs text-muted-foreground">
                    {closedServices.slice(0, 3).map((s: any) => s.name).join(', ')}
                  </p>
                </div>
              </div>
            )}
            {stats && stats.today_tickets > 0 && stats.absent_tickets / stats.today_tickets > 0.2 && (
              <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">Absences élevées aujourd'hui</p>
                  <p className="text-xs text-red-600 dark:text-red-300">
                    {stats.absent_tickets} absent(s) sur {stats.today_tickets} ticket(s)
                  </p>
                </div>
              </div>
            )}
            {peakHours.length > 0 && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Activity className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Heures de pointe (30 jours)</p>
                  <p className="text-xs text-blue-600 dark:text-blue-300">{peakHours.join(', ')}</p>
                </div>
              </div>
            )}
            {establishment.is_active && servicesWithoutAgents.length === 0 && closedServices.length === 0 && peakHours.length === 0 && (
              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <p className="text-sm font-medium text-green-800 dark:text-green-200">Aucune alerte</p>
              </div>
            )}
            {!establishment.is_active && (
              <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    Établissement inactif
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-300">
                    L'établissement est actuellement marqué comme inactif
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actions rapides */}
      <Card>
        <CardHeader>
          <CardTitle>Actions rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="flex items-center gap-2 h-auto p-4"
              onClick={() => navigate('/dashboard/agents')}
            >
              <Users className="h-5 w-5" />
              <div className="text-left">
                <p className="font-medium">Gérer les agents</p>
                <p className="text-xs text-muted-foreground">Ajouter ou modifier des agents</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2 h-auto p-4"
              onClick={() => navigate('/dashboard/services')}
            >
              <Settings className="h-5 w-5" />
              <div className="text-left">
                <p className="font-medium">Configurer les services</p>
                <p className="text-xs text-muted-foreground">Gérer les services et files</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2 h-auto p-4"
              onClick={() => navigate('/dashboard/stats')}
            >
              <BarChart3 className="h-5 w-5" />
              <div className="text-left">
                <p className="font-medium">Voir les statistiques</p>
                <p className="text-xs text-muted-foreground">Rapports détaillés</p>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
      {/* Affluence Dialog */}
      <Dialog open={!!affluenceDialogService} onOpenChange={(open) => { if (!open) setAffluenceDialogService(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Affluence — {affluenceDialogService?.name}</DialogTitle>
            <DialogDescription>Distribution horaire des tickets sur les 30 derniers jours</DialogDescription>
          </DialogHeader>
          {affluenceDialogLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : affluenceDialogData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/30 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold">{affluenceDialogData.people ?? 0}</p>
                  <p className="text-xs text-muted-foreground">En attente</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold">~{affluenceDialogData.eta_avg ?? '--'} min</p>
                  <p className="text-xs text-muted-foreground">Attente moyenne</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className={cn("w-3 h-3 rounded-full", affluenceDialogData.level === 'high' ? 'bg-red-500' : affluenceDialogData.level === 'medium' ? 'bg-amber-500' : 'bg-green-500')} />
                    <p className="text-2xl font-bold">{affluenceDialogData.level === 'high' ? 'Élevée' : affluenceDialogData.level === 'medium' ? 'Modérée' : 'Faible'}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Niveau d'affluence</p>
                </div>
              </div>
              {affluenceDialogData.hourly_data && affluenceDialogData.hourly_data.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Créneaux horaires (30 jours)</h4>
                  <ChartContainer title="" description="">
                    <VerticalBarChart
                      data={affluenceDialogData.hourly_data.map((pt: any) => ({
                        name: `${String(pt.hour).padStart(2, '0')}h`,
                        value: pt.count,
                        color: affluenceDialogData.peak_hours?.high?.includes(pt.hour) ? '#ef4444'
                          : affluenceDialogData.peak_hours?.medium?.includes(pt.hour) ? '#f59e0b'
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
              {affluenceDialogData.peak_hours?.high?.length > 0 && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Heures de pointe : {affluenceDialogData.peak_hours.high.map((h: number) => `${String(h).padStart(2, '0')}h`).join(', ')}.
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
