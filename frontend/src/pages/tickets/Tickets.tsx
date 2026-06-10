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
  ListOrdered,
  Plus,
  Smartphone,
  QrCode,
  UserCog,
  Monitor,
  Baby,
  Accessibility,
  HeartHandshake,
} from 'lucide-react'
import { api } from '@/api/axios'
import { useAppSelector } from '@/store'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DonutChart, VerticalBarChart, LineChartComponent } from '@/components/ui/charts'
import { ChartContainer } from '@/components/ui/chart-container'
import { AnalyticsCard } from '@/components/ui/analytics-card'

type TicketData = {
  id: number
  number: string
  status: string
  priority: string
  source?: string
  position: number | null
  customer_name?: string | null
  customer_phone?: string | null
  is_senior?: boolean
  is_handicap?: boolean
  is_pregnant?: boolean
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

const PRIORITY_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  normal: { label: 'Normal',     icon: ListOrdered, color: 'text-gray-600 dark:text-gray-400',   bg: 'bg-gray-100 dark:bg-gray-800' },
  high:   { label: 'Prioritaire', icon: Flame,       color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  vip:    { label: 'VIP',         icon: Star,        color: 'text-red-700 dark:text-red-400',       bg: 'bg-red-100 dark:bg-red-900/30' },
}

const SOURCE_CONFIG: Record<string, { label: string; icon: any }> = {
  app:     { label: 'Application', icon: Smartphone },
  qr_scan: { label: 'QR Code',     icon: QrCode },
  agent:   { label: 'Agent',       icon: UserCog },
  kiosk:   { label: 'Borne',       icon: Monitor },
  sms:     { label: 'SMS',         icon: Smartphone },
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
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({
    service_id: '',
    priority: 'normal',
    customer_name: '',
    customer_phone: '',
    is_senior: false,
    is_handicap: false,
    is_pregnant: false,
  })
  const [creating, setCreating] = useState(false)
  const [modalServices, setModalServices] = useState<{ id: number; name: string; status: string }[]>([])
  const [modalServicesLoading, setModalServicesLoading] = useState(false)

  // Determine API endpoint based on role
  const apiEndpoint = role === 'agent' ? '/api/agent/tickets' : '/api/admin/tickets'
  const servicesEndpoint = role === 'agent' ? '/api/agent/services' : '/api/admin/tickets/services'

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

  const openCreateModal = async () => {
    setShowCreateModal(true)
    setModalServicesLoading(true)
    try {
      const response = await api.get(servicesEndpoint)
      setModalServices(response.data.data || [])
    } catch (error: any) {
      toast.error('Impossible de charger les services')
      setModalServices([])
    } finally {
      setModalServicesLoading(false)
    }
  }

  const createTicket = async () => {
    if (!createForm.service_id) {
      toast.error('Veuillez sélectionner un service')
      return
    }
    setCreating(true)
    try {
      await api.post(`${apiEndpoint}`, {
        service_id: parseInt(createForm.service_id),
        priority: createForm.priority,
        customer_name: createForm.customer_name || undefined,
        customer_phone: createForm.customer_phone || undefined,
        is_senior: createForm.is_senior,
        is_handicap: createForm.is_handicap,
        is_pregnant: createForm.is_pregnant,
      })
      toast.success('Ticket créé avec succès')
      setShowCreateModal(false)
      setCreateForm({ service_id: '', priority: 'normal', customer_name: '', customer_phone: '', is_senior: false, is_handicap: false, is_pregnant: false })
      setModalServices([])
      loadTickets(1)
      loadStats()
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || 'Erreur inconnue'
      toast.error(`Erreur: ${msg}`)
    } finally {
      setCreating(false)
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
      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', config.bg, config.color)}>
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
    )
  }

  const getSourceBadge = (source?: string) => {
    const config = SOURCE_CONFIG[source ?? 'app'] || SOURCE_CONFIG.app
    const Icon = config.icon
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={config.label}>
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
    )
  }

  const getAttributeBadges = (ticket: TicketData) => {
    const attrs = []
    if (ticket.is_senior)   attrs.push({ key: 'senior',   label: 'Senior',   icon: Baby,          color: 'text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30' })
    if (ticket.is_handicap) attrs.push({ key: 'handicap', label: 'Handicap', icon: Accessibility,  color: 'text-purple-700 bg-purple-100 dark:text-purple-300 dark:bg-purple-900/30' })
    if (ticket.is_pregnant) attrs.push({ key: 'pregnant', label: 'Enceinte', icon: HeartHandshake, color: 'text-pink-700 bg-pink-100 dark:text-pink-300 dark:bg-pink-900/30' })
    return attrs.map(a => (
      <span key={a.key} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', a.color)}>
        <a.icon className="h-3 w-3" />
        {a.label}
      </span>
    ))
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
              onClick={openCreateModal}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Nouveau ticket
            </Button>

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
                                  Source
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
                                    <div className="flex flex-wrap gap-1">
                                      {getPriorityBadge(ticket.priority)}
                                      {getAttributeBadges(ticket)}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    {getSourceBadge(ticket.source)}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-muted-foreground">
                                    {ticket.customer_name || ticket.user?.name || '—'}
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

        {/* Create Ticket Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 h-screen top-0 !mt-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <Card className="w-full max-w-md max-h-[90vh] overflow-auto">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Créer un ticket</CardTitle>
                  <CardDescription>Création manuelle par l'agent</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowCreateModal(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Service */}
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">
                    Service <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={createForm.service_id}
                    onValueChange={(v) => setCreateForm(f => ({ ...f, service_id: v }))}
                    disabled={modalServicesLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        modalServicesLoading
                          ? 'Chargement...'
                          : modalServices.length === 0
                            ? 'Aucun service disponible'
                            : 'Sélectionner un service'
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {modalServices.map(s => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          <span className="flex items-center gap-2">
                            {s.name}
                            <span className={cn(
                              'text-xs rounded-full px-1.5 py-0.5',
                              s.status === 'open'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-gray-100 text-gray-500 dark:bg-gray-800'
                            )}>
                              {s.status === 'open' ? 'Ouvert' : 'Fermé'}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Priority */}
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">
                    Type de ticket
                  </label>
                  <Select
                    value={createForm.priority}
                    onValueChange={(v) => setCreateForm(f => ({ ...f, priority: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">Prioritaire</SelectItem>
                      <SelectItem value="vip">VIP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Customer info */}
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">
                    Nom du client
                  </label>
                  <Input
                    placeholder="Nom complet"
                    value={createForm.customer_name}
                    onChange={(e) => setCreateForm(f => ({ ...f, customer_name: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground block mb-1.5">
                    Téléphone
                  </label>
                  <Input
                    placeholder="+33 6 00 00 00 00"
                    value={createForm.customer_phone}
                    onChange={(e) => setCreateForm(f => ({ ...f, customer_phone: e.target.value }))}
                  />
                </div>

                {/* Special attributes */}
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Attributs spéciaux</p>
                  <div className="space-y-2">
                    {[
                      { key: 'is_senior',   label: 'Senior',   icon: Baby },
                      { key: 'is_handicap', label: 'Handicap', icon: Accessibility },
                      { key: 'is_pregnant', label: 'Femme enceinte', icon: HeartHandshake },
                    ].map(({ key, label, icon: Icon }) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={createForm[key as keyof typeof createForm] as boolean}
                          onChange={(e) => setCreateForm(f => ({ ...f, [key]: e.target.checked }))}
                          className="h-4 w-4 rounded border-input"
                        />
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => { setShowCreateModal(false); setModalServices([]) }}
                    disabled={creating}
                  >
                    Annuler
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={createTicket}
                    disabled={creating || !createForm.service_id}
                  >
                    {creating ? 'Création...' : 'Créer le ticket'}
                  </Button>
                </div>
              </CardContent>
            </Card>
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

                {(selectedTicket.is_senior || selectedTicket.is_handicap || selectedTicket.is_pregnant) && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Attributs spéciaux</p>
                    <div className="flex flex-wrap gap-1">
                      {getAttributeBadges(selectedTicket)}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Service</p>
                    <p className="font-medium">{selectedTicket.service.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Source</p>
                    {getSourceBadge(selectedTicket.source)}
                  </div>
                </div>

                {(selectedTicket.customer_name || selectedTicket.customer_phone || selectedTicket.user) && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Client</p>
                    <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                      <p className="font-medium">
                        {selectedTicket.customer_name || selectedTicket.user?.name || '—'}
                      </p>
                      {(selectedTicket.customer_phone || selectedTicket.user?.phone) && (
                        <p className="text-sm text-muted-foreground">
                          📞 {selectedTicket.customer_phone || selectedTicket.user?.phone}
                        </p>
                      )}
                      {selectedTicket.user?.email && (
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
