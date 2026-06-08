/**
 * Tickets Management Page
 * Vue des tickets pour admin et agent avec:
 * - Statistiques par service
 * - Filtres par statut et période
 * - Liste des tickets avec détails
 */
import React, { useEffect, useState, useMemo } from 'react'
import { 
  Ticket, 
  Clock, 
  Users, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Eye,
  Calendar,
  TrendingUp,
  Building2,
  UserX,
  X,
  Star,
  Flame,
  ListOrdered
} from 'lucide-react'
import { api } from '@/api/axios'
import { useAppSelector } from '@/store'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { DonutChart, VerticalBarChart, LineChartComponent } from '@/components/ui/charts'
import { ChartContainer } from '@/components/ui/chart-container'
import { AnalyticsCard } from '@/components/ui/analytics-card'

type TicketData = {
  id: number
  number: string
  status: string
  priority: string
  position: number | null
  service: {
    id: number
    name: string
    status: string
  }
  counter_id: number | null
  user?: {
    id: number
    name: string
    phone?: string
    email?: string
  }
  counter?: {
    id: number
    name: string
  }
  called_at: string | null
  closed_at: string | null
  absent_at: string | null
  created_at: string
  updated_at: string
  // Smart queue: ticket auto-reporté vers un jour ouvrable ultérieur
  auto_deferred?: boolean
  defer_reason?: string | null
  valid_date?: string | null
}

type ServiceStats = {
  service_id: number
  service_name: string
  service_status: string
  total: number
  waiting: number
  called: number
  closed: number
  absent: number
  cancelled: number
}

type GlobalStats = {
  total: number
  waiting: number
  called: number
  closed: number
  absent: number
  cancelled: number
  expired: number
  avg_wait_minutes: number | null
}

type Period = 'today' | 'week' | 'month'
type StatusFilter = 'all' | 'active' | 'waiting' | 'called' | 'closed' | 'absent' | 'cancelled' | 'expired'

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  waiting: { label: 'En attente', color: 'text-yellow-700', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' },
  called: { label: 'Appelé', color: 'text-blue-700', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  closed: { label: 'Clôturé', color: 'text-green-700', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  absent: { label: 'Absent', color: 'text-orange-700', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
  cancelled: { label: 'Annulé', color: 'text-red-700', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  expired: { label: 'Expiré', color: 'text-gray-700', bgColor: 'bg-gray-100 dark:bg-gray-900/30' },
}

const PRIORITY_CONFIG: Record<string, { label: string; icon: any }> = {
  normal: { label: 'Normal', icon: ListOrdered },
  high: { label: 'Haute', icon: Flame },
  vip: { label: 'VIP', icon: Star },
}

export default function TicketsPage() {
  const user = useAppSelector((s) => s.auth.user)
  const role = user?.role

  const [tickets, setTickets] = useState<TicketData[]>([])
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null)
  const [serviceStats, setServiceStats] = useState<ServiceStats[]>([])
  const [loading, setLoading] = useState(false)
  const [statsLoading, setStatsLoading] = useState(false)
  const [period, setPeriod] = useState<Period>('today')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedService, setSelectedService] = useState<string>('all')
  const [expandedServices, setExpandedServices] = useState<Set<number>>(new Set())
  const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Determine API endpoint based on role
  const apiEndpoint = role === 'agent' ? '/api/agent/tickets' : '/api/admin/tickets'

  // Load statistics
  const loadStats = async () => {
    setStatsLoading(true)
    try {
      const response = await api.get(`${apiEndpoint}/stats`, {
        params: { period }
      })
      setGlobalStats(response.data.global)
      setServiceStats(response.data.by_service)
    } catch (error: any) {
      console.error('Error loading stats:', error)
      const detail = error?.response?.data?.message || error?.message || 'Erreur inconnue'
      const status = error?.response?.status
      toast.error(`Erreur stats (${status}): ${detail}`)
    } finally {
      setStatsLoading(false)
    }
  }

  // Load tickets
  const loadTickets = async (pageNum = 1) => {
    setLoading(true)
    try {
      const response = await api.get(apiEndpoint, {
        params: {
          period,
          status: statusFilter === 'all' ? undefined : statusFilter,
          service_id: selectedService === 'all' ? undefined : selectedService,
          page: pageNum,
          per_page: 20,
          with_details: true,
        }
      })
      setTickets(response.data.data)
      setTotal(response.data.meta.total)
      setTotalPages(response.data.meta.last_page)
      setPage(pageNum)
    } catch (error: any) {
      console.error('Error loading tickets:', error)
      const detail = error?.response?.data?.message || error?.message || 'Erreur inconnue'
      const status = error?.response?.status
      toast.error(`Erreur tickets (${status}): ${detail}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [period])

  useEffect(() => {
    loadTickets(1)
  }, [period, statusFilter, selectedService])

  // Group tickets by service
  const ticketsByService = useMemo(() => {
    const grouped: Record<number, { service: ServiceStats; tickets: TicketData[] }> = {}
    
    serviceStats.forEach(service => {
      grouped[service.service_id] = {
        service,
        tickets: tickets.filter(t => t.service.id === service.service_id)
      }
    })
    
    // Add tickets that might not be in serviceStats
    tickets.forEach(ticket => {
      if (!grouped[ticket.service.id]) {
        grouped[ticket.service.id] = {
          service: {
            service_id: ticket.service.id,
            service_name: ticket.service.name,
            service_status: ticket.service.status,
            total: 0,
            waiting: 0,
            called: 0,
            closed: 0,
            absent: 0,
            cancelled: 0,
          },
          tickets: []
        }
      }
    })
    
    return grouped
  }, [tickets, serviceStats])

  // Chart data
  const statusChartData = useMemo(() => {
    if (!globalStats) return []
    return [
      { name: 'En attente', value: globalStats.waiting, color: '#eab308' },
      { name: 'Appelés', value: globalStats.called, color: '#3b82f6' },
      { name: 'Clôturés', value: globalStats.closed, color: '#22c55e' },
      { name: 'Absents', value: globalStats.absent, color: '#f97316' },
      { name: 'Annulés', value: globalStats.cancelled, color: '#ef4444' },
    ].filter(d => d.value > 0)
  }, [globalStats])

  const serviceChartData = useMemo(() => {
    return serviceStats.slice(0, 6).map(s => ({
      name: s.service_name,
      value: s.total,
      color: '#3b82f6',
    }))
  }, [serviceStats])

  const toggleService = (serviceId: number) => {
    setExpandedServices(prev => {
      const next = new Set(prev)
      if (next.has(serviceId)) {
        next.delete(serviceId)
      } else {
        next.add(serviceId)
      }
      return next
    })
  }

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.waiting
    return (
      <Badge className={cn(config.bgColor, config.color, 'font-medium')}>
        {config.label}
      </Badge>
    )
  }

  const getPriorityBadge = (priority: string) => {
    const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.normal
    const Icon = config.icon
    return (
      <span className="text-sm flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Gestion des Tickets
            </h1>
            <p className="text-muted-foreground mt-1">
              Vue globale des tickets par service
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Period Filter */}
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="w-[140px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Aujourd'hui</SelectItem>
                <SelectItem value="week">Cette semaine</SelectItem>
                <SelectItem value="month">Ce mois</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              onClick={() => { loadStats(); loadTickets(1); }}
              disabled={loading || statsLoading}
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', (loading || statsLoading) && 'animate-spin')} />
              Actualiser
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <AnalyticsCard
            title="Total"
            value={globalStats?.total ?? 0}
            icon={Ticket}
            className="bg-card"
          />
          <AnalyticsCard
            title="En attente"
            value={globalStats?.waiting ?? 0}
            icon={Clock}
            className="bg-card"
          />
          <AnalyticsCard
            title="Appelés"
            value={globalStats?.called ?? 0}
            icon={Users}
            className="bg-card"
          />
          <AnalyticsCard
            title="Clôturés"
            value={globalStats?.closed ?? 0}
            icon={CheckCircle}
            className="bg-card"
          />
          <AnalyticsCard
            title="Absents"
            value={globalStats?.absent ?? 0}
            icon={UserX}
            className="bg-card"
          />
          <AnalyticsCard
            title="Temps moyen"
            value={globalStats?.avg_wait_minutes ? `${globalStats.avg_wait_minutes} min` : '—'}
            icon={TrendingUp}
            className="bg-card"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartContainer
            title="Répartition par statut"
            description="Distribution des tickets"
          >
            {statusChartData.length > 0 ? (
              <DonutChart data={statusChartData} height={280} />
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                Aucune donnée
              </div>
            )}
          </ChartContainer>

          <ChartContainer
            title="Tickets par service"
            description="Top 6 services"
          >
            {serviceChartData.length > 0 ? (
              <VerticalBarChart data={serviceChartData} height={280} />
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                Aucune donnée
              </div>
            )}
          </ChartContainer>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtres
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                  Statut
                </label>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="active">Actifs</SelectItem>
                    <SelectItem value="waiting">En attente</SelectItem>
                    <SelectItem value="called">Appelés</SelectItem>
                    <SelectItem value="closed">Clôturés</SelectItem>
                    <SelectItem value="absent">Absents</SelectItem>
                    <SelectItem value="cancelled">Annulés</SelectItem>
                    <SelectItem value="expired">Expirés</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1">
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                  Service
                </label>
                <Select value={selectedService} onValueChange={setSelectedService}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les services</SelectItem>
                    {serviceStats.map(s => (
                      <SelectItem key={s.service_id} value={String(s.service_id)}>
                        {s.service_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <p className="text-sm text-muted-foreground">
                  {total} ticket{total > 1 ? 's' : ''} trouvé{total > 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tickets by Service */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">
            Tickets par service
          </h2>

          {serviceStats.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Ticket className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Aucun ticket trouvé pour la période sélectionnée
                </p>
              </CardContent>
            </Card>
          ) : (
            serviceStats.map(service => {
              const serviceTickets = tickets.filter(t => t.service.id === service.service_id)
              const isExpanded = expandedServices.has(service.service_id)

              return (
                <Card key={service.service_id} className="overflow-hidden">
                  {/* Service Header */}
                  <div 
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleService(service.service_id)}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                      <Building2 className="h-5 w-5 text-primary" />
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {service.service_name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {service.total} ticket{service.total > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Mini stats */}
                      <div className="hidden md:flex items-center gap-3 text-sm">
                        {service.waiting > 0 && (
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-yellow-500" />
                            {service.waiting}
                          </span>
                        )}
                        {service.called > 0 && (
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            {service.called}
                          </span>
                        )}
                        {service.closed > 0 && (
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            {service.closed}
                          </span>
                        )}
                        {service.absent > 0 && (
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-orange-500" />
                            {service.absent}
                          </span>
                        )}
                      </div>
                      <Badge variant={service.service_status === 'open' ? 'default' : 'secondary'}>
                        {service.service_status === 'open' ? 'Ouvert' : 'Fermé'}
                      </Badge>
                    </div>
                  </div>

                  {/* Tickets List */}
                  {isExpanded && (
                    <div className="border-t border-border">
                      {serviceTickets.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground text-sm">
                          Aucun ticket avec les filtres actuels
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                                  N° Ticket
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                                  Statut
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                                  Priorité
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                                  Client
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                                  Créé le
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {serviceTickets.map(ticket => (
                                <tr key={ticket.id} className="hover:bg-muted/30 transition-colors">
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-semibold text-foreground">
                                        {ticket.number}
                                      </span>
                                      {ticket.auto_deferred && ticket.valid_date && (
                                        <span
                                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                                          title={ticket.defer_reason ?? undefined}
                                        >
                                          Reporté au {new Date(ticket.valid_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    {getStatusBadge(ticket.status)}
                                  </td>
                                  <td className="px-4 py-3">
                                    {getPriorityBadge(ticket.priority)}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-muted-foreground">
                                    {ticket.user?.name || '—'}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-muted-foreground">
                                    {new Date(ticket.created_at).toLocaleString('fr-FR', {
                                      day: '2-digit',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </td>
                                  <td className="px-4 py-3">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setSelectedTicket(ticket)}
                                    >
                                      <Eye className="h-4 w-4 mr-1" />
                                      Détails
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              )
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => loadTickets(page - 1)}
            >
              Précédent
            </Button>
            <span className="flex items-center px-4 text-sm text-muted-foreground">
              Page {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              disabled={page === totalPages}
              onClick={() => loadTickets(page + 1)}
            >
              Suivant
            </Button>
          </div>
        )}

        {/* Ticket Detail Modal */}
        {selectedTicket && (
          <div className="fixed inset-0 h-screen top-0 !mt-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <Card className="w-full max-w-lg max-h-[90vh] overflow-auto">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Détails du ticket</CardTitle>
                  <CardDescription>{selectedTicket.number}</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedTicket(null)}>
                  <X className="h-5 w-5" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Statut</p>
                    {getStatusBadge(selectedTicket.status)}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Priorité</p>
                    {getPriorityBadge(selectedTicket.priority)}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Service</p>
                  <p className="font-medium">{selectedTicket.service.name}</p>
                </div>

                {selectedTicket.user && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Client</p>
                    <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                      <p className="font-medium">{selectedTicket.user.name}</p>
                      {selectedTicket.user.phone && (
                        <p className="text-sm text-muted-foreground">
                          📞 {selectedTicket.user.phone}
                        </p>
                      )}
                      {selectedTicket.user.email && (
                        <p className="text-sm text-muted-foreground">
                          ✉️ {selectedTicket.user.email}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Position</p>
                    <p className="font-medium">
                      {selectedTicket.position ? `#${selectedTicket.position}` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Guichet</p>
                    <p className="font-medium">
                      {selectedTicket.counter?.name || '—'}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Créé le</span>
                    <span>{new Date(selectedTicket.created_at).toLocaleString('fr-FR')}</span>
                  </div>
                  {selectedTicket.called_at && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Appelé le</span>
                      <span>{new Date(selectedTicket.called_at).toLocaleString('fr-FR')}</span>
                    </div>
                  )}
                  {selectedTicket.closed_at && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Clôturé le</span>
                      <span>{new Date(selectedTicket.closed_at).toLocaleString('fr-FR')}</span>
                    </div>
                  )}
                  {selectedTicket.absent_at && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Marqué absent le</span>
                      <span>{new Date(selectedTicket.absent_at).toLocaleString('fr-FR')}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
