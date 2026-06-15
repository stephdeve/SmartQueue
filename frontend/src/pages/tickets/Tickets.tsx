/**
 * Tickets Management Page
 * Vue des tickets pour admin et agent avec:
 * - Statistiques par service
 * - Filtres par statut et période
 * - Liste des tickets avec détails
 * - Export de données
 * - Notifications en temps réel
 * - Vue calendrier
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react'
import {
  Ticket,
  Clock,
  Users,
  CheckCircle,
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
  Search,
  ArrowUpDown,
  Download,
  Bell,
  BellRing,
  AlertCircle,
  CheckCheck,
  PhoneCall,
  Target,
  Timer,
  DownloadCloud,
  CalendarDays,
  Table as TableIcon,
} from 'lucide-react'
import { api } from '@/api/axios'
import { useAppSelector } from '@/store'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DonutChart, VerticalBarChart } from '@/components/ui/charts'
import { ChartContainer } from '@/components/ui/chart-container'
import { AnalyticsCard } from '@/components/ui/analytics-card'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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
type StatusFilter = 'all' | 'active' | 'waiting' | 'called' | 'closed' | 'absent' | 'cancelled' | 'expired' | 'deferred'
type ViewMode = 'grouped' | 'list' | 'calendar'

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  waiting: { label: 'En attente', color: 'text-yellow-700', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' },
  called: { label: 'Appelé', color: 'text-blue-700', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  closed: { label: 'Clôturé', color: 'text-green-700', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  absent: { label: 'Absent', color: 'text-orange-700', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
  cancelled: { label: 'Annulé', color: 'text-red-700', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  expired: { label: 'Expiré', color: 'text-gray-700', bgColor: 'bg-gray-100 dark:bg-gray-900/30' },
}

const PRIORITY_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  normal: { label: 'Normal', icon: ListOrdered, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800' },
  high: { label: 'Prioritaire', icon: Flame, color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  vip: { label: 'VIP', icon: Star, color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
}

const SOURCE_CONFIG: Record<string, { label: string; icon: any }> = {
  app: { label: 'Application', icon: Smartphone },
  qr_scan: { label: 'QR Code', icon: QrCode },
  agent: { label: 'Agent', icon: UserCog },
  kiosk: { label: 'Borne', icon: Monitor },
  sms: { label: 'SMS', icon: Smartphone },
}

// Fonctions de date sécurisées - CORRECTION DES DATES INVALIDES
const parseSafeDate = (dateStr?: string | null): Date | null => {
  if (!dateStr) return null
  try {
    let str = dateStr
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(str)) {
      str = str.replace(' ', 'T') + 'Z'
    }
    const date = new Date(str)
    if (isNaN(date.getTime())) return null
    return date
  } catch {
    return null
  }
}

const formatDateDisplay = (dateStr?: string | null): string => {
  const date = parseSafeDate(dateStr)
  if (!date) return '—'
  try {
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

const formatTimeDisplay = (dateStr?: string | null): string => {
  const date = parseSafeDate(dateStr)
  if (!date) return '—'
  try {
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export default function TicketsPage() {
  const user = useAppSelector((s) => s.auth.user)
  const role = user?.role

  // États existants
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
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'created_at' | 'number' | 'priority'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('grouped')

  // Feature: Notifications
  const [notifications, setNotifications] = useState<{ id: number; message: string; type: string; read: boolean; created_at: string }[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // Feature: Export
  const [exporting, setExporting] = useState(false)

  // Feature: Real-time stats
  const [realtimeEnabled, setRealtimeEnabled] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Feature: Calendar view data
  const [calendarData, setCalendarData] = useState<Record<string, TicketData[]>>({})

  // Determine API endpoint
  const apiEndpoint = role === 'agent' ? '/api/agent/tickets' : '/api/admin/tickets'
  const servicesEndpoint = role === 'agent' ? '/api/agent/services' : '/api/admin/tickets/services'

  // Filtrer et trier les tickets
  const filteredAndSortedTickets = useMemo(() => {
    let filtered = [...tickets]

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(t =>
        t.number.toLowerCase().includes(term) ||
        t.customer_name?.toLowerCase().includes(term) ||
        t.user?.name?.toLowerCase().includes(term) ||
        t.service.name.toLowerCase().includes(term)
      )
    }

    filtered.sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'created_at':
          const dateA = parseSafeDate(a.created_at)?.getTime() || 0
          const dateB = parseSafeDate(b.created_at)?.getTime() || 0
          comparison = dateA - dateB
          break
        case 'number':
          comparison = a.number.localeCompare(b.number)
          break
        case 'priority':
          const priorityOrder = { vip: 3, high: 2, normal: 1 }
          comparison = (priorityOrder[a.priority as keyof typeof priorityOrder] || 0) -
            (priorityOrder[b.priority as keyof typeof priorityOrder] || 0)
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [tickets, searchTerm, sortBy, sortOrder])

  // Feature: Notifications - Chargement
  const loadNotifications = async () => {
    try {
      const res = await api.get(`${apiEndpoint}/notifications`)
      setNotifications(res.data.data || [])
      setUnreadCount(res.data.data?.filter((n: any) => !n.read).length || 0)
    } catch (error) {
      console.error('Error loading notifications:', error)
      // Données mockées pour la démo
      const mockNotifs = [
        { id: 1, message: "Nouveau ticket #1234 créé", type: "info", read: false, created_at: new Date().toISOString() },
        { id: 2, message: "Ticket #1230 a été appelé", type: "success", read: false, created_at: new Date(Date.now() - 300000).toISOString() },
        { id: 3, message: "Service Administration fermé dans 30min", type: "warning", read: true, created_at: new Date(Date.now() - 3600000).toISOString() },
      ]
      setNotifications(mockNotifs)
      setUnreadCount(mockNotifs.filter(n => !n.read).length)
    }
  }

  const markNotificationAsRead = async (id: number) => {
    try {
      await api.post(`${apiEndpoint}/notifications/${id}/read`)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
      toast.success("Notification marquée comme lue")
    } catch (error) {
      console.error('Error marking notification as read:', error)
      // Action locale même si l'API échoue
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    }
  }

  const markAllNotificationsAsRead = async () => {
    try {
      await api.post(`${apiEndpoint}/notifications/read-all`)
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
      toast.success("Toutes les notifications ont été marquées comme lues")
    } catch (error) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    }
  }

  // Feature: Export données
  const exportData = async (format: 'csv' | 'pdf' | 'excel') => {
    setExporting(true)
    try {
      const response = await api.get(`${apiEndpoint}/export`, {
        params: {
          format,
          period,
          status: statusFilter === 'all' ? undefined : statusFilter,
          service_id: selectedService === 'all' ? undefined : selectedService,
        },
        responseType: 'blob',
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `tickets_export_${new Date().toISOString()}.${format}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      toast.success(`Export ${format.toUpperCase()} réussi`)
    } catch (error: any) {
      toast.error("Erreur d'export", {
        description: error?.response?.data?.message || "Veuillez réessayer",
      })
    } finally {
      setExporting(false)
    }
  }

  // Feature: Rechargement temps réel
  const refreshRealtime = useCallback(async () => {
    if (!realtimeEnabled) return
    try {
      await Promise.all([loadStats(), loadTickets(page)])
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Realtime refresh error:', error)
    }
  }, [realtimeEnabled, period, statusFilter, selectedService, page])

  // Polling temps réel (toutes les 30 secondes)
  useEffect(() => {
    if (!realtimeEnabled) return
    const interval = setInterval(refreshRealtime, 30000)
    return () => clearInterval(interval)
  }, [realtimeEnabled, refreshRealtime])

  // Feature: Vue calendrier
  const buildCalendarData = useMemo(() => {
    const grouped: Record<string, TicketData[]> = {}
    filteredAndSortedTickets.forEach(ticket => {
      const dateObj = parseSafeDate(ticket.created_at)
      if (dateObj) {
        const date = dateObj.toLocaleDateString('fr-FR')
        if (!grouped[date]) grouped[date] = []
        grouped[date].push(ticket)
      }
    })
    return grouped
  }, [filteredAndSortedTickets])

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
          period: statusFilter === 'deferred' ? 'all' : period,
          status: statusFilter === 'all' || statusFilter === 'deferred' ? undefined : statusFilter,
          auto_deferred: statusFilter === 'deferred' ? true : undefined,
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
      loadNotifications()
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || 'Erreur inconnue'
      toast.error(`Erreur: ${msg}`)
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => {
    loadStats()
    loadNotifications()
  }, [period])

  useEffect(() => {
    loadTickets(1)
  }, [period, statusFilter, selectedService])

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
    if (ticket.is_senior) attrs.push({ key: 'senior', label: 'Senior', icon: Baby, color: 'text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30' })
    if (ticket.is_handicap) attrs.push({ key: 'handicap', label: 'Handicap', icon: Accessibility, color: 'text-purple-700 bg-purple-100 dark:text-purple-300 dark:bg-purple-900/30' })
    if (ticket.is_pregnant) attrs.push({ key: 'pregnant', label: 'Enceinte', icon: HeartHandshake, color: 'text-pink-700 bg-pink-100 dark:text-pink-300 dark:bg-pink-900/30' })
    return attrs.map(a => (
      <span key={a.key} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', a.color)}>
        <a.icon className="h-3 w-3" />
        {a.label}
      </span>
    ))
  }

  // Métriques
  const serviceRate = useMemo(() => {
    if (globalStats?.total === 0) return 0
    return Math.round(((globalStats?.closed || 0) / (globalStats?.total || 1)) * 100)
  }, [globalStats])

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-6 lg:p-8">
        <div className="mx-auto w-fullspace-y-6">

          {/* ========== HEADER ========== */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Ticket className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                    Gestion des Tickets
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Vue globale et suivi en temps réel
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Période */}
              <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
                {[
                  { value: 'today', label: 'Aujourd\'hui' },
                  { value: 'week', label: 'Semaine' },
                  { value: 'month', label: 'Mois' },
                ].map(p => (
                  <button
                    key={p.value}
                    onClick={() => setPeriod(p.value as Period)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                      period === p.value
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Feature: Notifications */}
              <DropdownMenu open={showNotifications} onOpenChange={setShowNotifications}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="relative">
                    {unreadCount > 0 ? (
                      <>
                        <BellRing className="h-4 w-4" />
                        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center animate-pulse">
                          {unreadCount}
                        </span>
                      </>
                    ) : (
                      <Bell className="h-4 w-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <div className="p-3 border-b flex items-center justify-between">
                    <span className="font-semibold">Notifications</span>
                    {unreadCount > 0 && (
                      <Button variant="ghost" size="sm" className="text-xs h-auto py-1" onClick={markAllNotificationsAsRead}>
                        Tout marquer lu
                      </Button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground text-sm">
                        Aucune notification
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <div
                          key={notif.id}
                          className={cn(
                            "p-3 cursor-pointer hover:bg-muted/50 transition-colors border-b last:border-0",
                            !notif.read && "bg-primary/5"
                          )}
                          onClick={() => markNotificationAsRead(notif.id)}
                        >
                          <div className="flex items-start gap-2">
                            <div className={cn(
                              "w-2 h-2 rounded-full mt-1.5",
                              !notif.read ? "bg-blue-500" : "bg-transparent"
                            )} />
                            <div className="flex-1">
                              <p className={cn("text-sm", !notif.read && "font-medium")}>
                                {notif.message}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDateDisplay(notif.created_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Feature: Export */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" disabled={exporting}>
                    {exporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => exportData('csv')}>
                    <DownloadCloud className="h-4 w-4 mr-2" />
                    Export CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportData('excel')}>
                    <DownloadCloud className="h-4 w-4 mr-2" />
                    Export Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button onClick={openCreateModal} className="gap-2 shadow-sm">
                <Plus className="h-4 w-4" />
                Nouveau ticket
              </Button>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => { loadStats(); loadTickets(1); refreshRealtime(); }}
                    disabled={loading || statsLoading}
                  >
                    <RefreshCw className={cn('h-4 w-4', (loading || statsLoading) && 'animate-spin')} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Actualiser les données</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* ========== STATS CARDS ========== */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
            <AnalyticsCard title="Total" value={globalStats?.total ?? 0} icon={Ticket} className="bg-card" />
            <AnalyticsCard title="En attente" value={globalStats?.waiting ?? 0} icon={Clock} className="bg-card" />
            <AnalyticsCard title="Appelés" value={globalStats?.called ?? 0} icon={PhoneCall} className="bg-card" />
            <AnalyticsCard title="Clôturés" value={globalStats?.closed ?? 0} icon={CheckCheck} className="bg-card" />
            <AnalyticsCard title="Absents" value={globalStats?.absent ?? 0} icon={UserX} className="bg-card" />
            <AnalyticsCard title="Taux service" value={`${serviceRate}%`} icon={Target} className="bg-card" />
            <AnalyticsCard title="Temps moyen" value={globalStats?.avg_wait_minutes ? `${globalStats.avg_wait_minutes} min` : '—'} icon={Timer} className="bg-card" />
          </div>

          {/* ========== CHARTS AVEC LÉGENDES ========== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Graphique 1: Répartition par statut */}
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-primary" />
                  Répartition par statut
                </CardTitle>
                <CardDescription>Distribution des tickets</CardDescription>
              </CardHeader>
              <CardContent>
                {statusChartData.length > 0 ? (
                  <>
                    <DonutChart data={statusChartData} height={220} />
                    <div className="flex flex-wrap justify-center gap-4 mt-4 pt-3 border-t">
                      {statusChartData.map(item => (
                        <div key={item.name} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-xs text-muted-foreground">{item.name}</span>
                          <span className="text-xs font-semibold bg-muted/50 px-1.5 py-0.5 rounded-full">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-muted-foreground">
                    Aucune donnée
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Graphique 2: Tickets par service */}
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  Tickets par service
                </CardTitle>
                <CardDescription>Top 6 services</CardDescription>
              </CardHeader>
              <CardContent>
                {serviceChartData.length > 0 ? (
                  <>
                    <VerticalBarChart data={serviceChartData} height={220} />
                    <div className="flex justify-center gap-4 mt-4 pt-3 border-t">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="text-xs text-muted-foreground">Nombre de tickets</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-muted-foreground">
                    Aucune donnée
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ========== FILTERS BAR ========== */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Filter className="h-4 w-4 text-primary" />
                  Filtres et recherche
                </CardTitle>
                {/* Feature: Realtime toggle */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="realtime" className="text-xs text-muted-foreground">Temps réel</Label>
                    <Switch
                      id="realtime"
                      checked={realtimeEnabled}
                      onCheckedChange={setRealtimeEnabled}
                    />
                  </div>
                  {lastUpdate && realtimeEnabled && (
                    <span className="text-xs text-muted-foreground">
                      ↻ {lastUpdate.toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher par numéro, client, service..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 bg-muted/30"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                      <SelectTrigger className="w-[130px]">
                        <ArrowUpDown className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Trier par" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="created_at">Date création</SelectItem>
                        <SelectItem value="number">Numéro</SelectItem>
                        <SelectItem value="priority">Priorité</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    >
                      <ArrowUpDown className={cn("h-4 w-4", sortOrder === 'asc' && "rotate-180")} />
                    </Button>

                    {/* Vue selector */}
                    <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
                      <button
                        onClick={() => setViewMode('grouped')}
                        className={cn("p-1.5 rounded-md transition-all", viewMode === 'grouped' && "bg-background shadow-sm")}
                        title="Vue groupée par service"
                      >
                        <Building2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className={cn("p-1.5 rounded-md transition-all", viewMode === 'list' && "bg-background shadow-sm")}
                        title="Vue liste"
                      >
                        <TableIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setViewMode('calendar')}
                        className={cn("p-1.5 rounded-md transition-all", viewMode === 'calendar' && "bg-background shadow-sm")}
                        title="Vue calendrier"
                      >
                        <CalendarDays className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Statut</label>
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
                        <SelectItem value="deferred">🟡 Reportés</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex-1">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Service</label>
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
                    <div className="px-3 py-2 rounded-lg bg-muted/30 text-sm text-muted-foreground">
                      {filteredAndSortedTickets.length} résultat{filteredAndSortedTickets.length > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ========== TICKETS DISPLAY ========== */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <div className="p-1 rounded-md bg-primary/10">
                  <ListOrdered className="h-4 w-4 text-primary" />
                </div>
                Tickets
                {selectedService !== 'all' && (
                  <Badge variant="secondary" className="ml-2">
                    {serviceStats.find(s => String(s.service_id) === selectedService)?.service_name}
                  </Badge>
                )}
              </h2>
              {searchTerm && (
                <Button variant="ghost" size="sm" onClick={() => setSearchTerm('')} className="gap-1">
                  <X className="h-3 w-3" />
                  Effacer recherche
                </Button>
              )}
            </div>

            {/* Vue Calendrier */}
            {viewMode === 'calendar' ? (
              <div className="space-y-4">
                {Object.entries(buildCalendarData).length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                      <p className="text-muted-foreground">Aucun ticket pour la période sélectionnée</p>
                    </CardContent>
                  </Card>
                ) : (
                  Object.entries(buildCalendarData).map(([date, dayTickets]) => (
                    <Card key={date} className="border-border/50">
                      <CardHeader className="pb-2 bg-muted/20">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-primary" />
                          {date}
                          <Badge variant="secondary">{dayTickets.length} tickets</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {dayTickets.slice(0, 9).map(ticket => (
                            <div key={ticket.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors">
                              <div>
                                <span className="font-mono font-medium text-sm">{ticket.number}</span>
                                <div className="flex gap-1 mt-1">{getPriorityBadge(ticket.priority)}</div>
                              </div>
                              <Button variant="ghost" size="sm" onClick={() => setSelectedTicket(ticket)}>
                                <Eye className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                          {dayTickets.length > 9 && (
                            <div className="p-2 text-center text-xs text-muted-foreground">
                              +{dayTickets.length - 9} autres tickets
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            ) : viewMode === 'list' ? (
              /* Vue Liste */
              <Card className="overflow-hidden border-border/50 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/30">
                      <tr className="border-b border-border/50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">N°</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Service</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Statut</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Priorité</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Client</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Création</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {loading ? (
                        <tr><td colSpan={7} className="p-8 text-center">Chargement...</td></tr>
                      ) : filteredAndSortedTickets.length === 0 ? (
                        <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Aucun ticket</td></tr>
                      ) : (
                        filteredAndSortedTickets.map(ticket => (
                          <tr key={ticket.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 font-semibold">{ticket.number}</td>
                            <td className="px-4 py-3 text-sm">{ticket.service.name}</td>
                            <td className="px-4 py-3">{getStatusBadge(ticket.status)}</td>
                            <td className="px-4 py-3">{getPriorityBadge(ticket.priority)}</td>
                            <td className="px-4 py-3 text-sm">{ticket.customer_name || ticket.user?.name || '—'}</td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">{formatTimeDisplay(ticket.created_at)}</td>
                            <td className="px-4 py-3">
                              <Button variant="ghost" size="sm" onClick={() => setSelectedTicket(ticket)}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
              /* Vue Groupée par service */
              <div className="space-y-4">
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <Card key={i} className="border-border/50">
                        <CardContent className="p-4"><div className="h-20 bg-muted rounded animate-pulse" /></CardContent>
                      </Card>
                    ))}
                  </div>
                ) : serviceStats.length === 0 ? (
                  <Card><CardContent className="py-12 text-center"><Ticket className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" /><p>Aucun ticket trouvé</p></CardContent></Card>
                ) : (
                  serviceStats.map(service => {
                    const serviceTickets = filteredAndSortedTickets.filter(t => t.service.id === service.service_id)
                    const isExpanded = expandedServices.has(service.service_id)
                    if (serviceTickets.length === 0 && searchTerm) return null
                    return (
                      <Card key={service.service_id} className="overflow-hidden border-border/50 shadow-sm">
                        <div className={cn("flex items-center justify-between p-4 cursor-pointer transition-colors", isExpanded && "bg-muted/20 border-b border-border/50")} onClick={() => toggleService(service.service_id)}>
                          <div className="flex items-center gap-3">
                            <button className="p-0.5">{isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>
                            <div className="p-2 rounded-lg bg-primary/10"><Building2 className="h-5 w-5 text-primary" /></div>
                            <div><h3 className="font-semibold">{service.service_name}</h3><p className="text-xs text-muted-foreground">{serviceTickets.length} ticket{serviceTickets.length > 1 ? 's' : ''}</p></div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="hidden md:flex items-center gap-2">
                              {service.waiting > 0 && <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 text-xs"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />{service.waiting}</span>}
                              {service.called > 0 && <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 text-xs"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" />{service.called}</span>}
                              {service.closed > 0 && <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 text-xs"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />{service.closed}</span>}
                            </div>
                            <Badge variant={service.service_status === 'open' ? 'default' : 'secondary'}>{service.service_status === 'open' ? 'Ouvert' : 'Fermé'}</Badge>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="overflow-x-auto">
                            {serviceTickets.length === 0 ? <div className="p-8 text-center text-muted-foreground text-sm">Aucun ticket</div> : (
                              <table className="w-full">
                                <thead className="bg-muted/30">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">N°</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Statut</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Priorité</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Client</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Création</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {serviceTickets.map(ticket => (
                                    <tr key={ticket.id} className="hover:bg-muted/20">
                                      <td className="px-4 py-3 font-semibold">{ticket.number}</td>
                                      <td className="px-4 py-3">{getStatusBadge(ticket.status)}</td>
                                      <td className="px-4 py-3">{getPriorityBadge(ticket.priority)}</td>
                                      <td className="px-4 py-3 text-sm">{ticket.customer_name || ticket.user?.name || '—'}</td>
                                      <td className="px-4 py-3 text-sm text-muted-foreground">{formatTimeDisplay(ticket.created_at)}</td>
                                      <td className="px-4 py-3">
                                        <Button variant="ghost" size="sm" onClick={() => setSelectedTicket(ticket)}>
                                          <Eye className="h-3.5 w-3.5" />
                                        </Button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        )}
                      </Card>
                    )
                  })
                )}
              </div>
            )}
          </div>

          {/* ========== PAGINATION ========== */}
          {totalPages > 1 && viewMode !== 'calendar' && (
            <div className="flex justify-center gap-2 pt-4">
              <Button variant="outline" disabled={page === 1} onClick={() => loadTickets(page - 1)}>Précédent</Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = page
                  if (totalPages <= 5) pageNum = i + 1
                  else if (page <= 3) pageNum = i + 1
                  else if (page >= totalPages - 2) pageNum = totalPages - 4 + i
                  else pageNum = page - 2 + i
                  return (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => loadTickets(pageNum)}
                      className="w-9"
                    >
                      {pageNum}
                    </Button>
                  )
                })}
              </div>
              <Button variant="outline" disabled={page === totalPages} onClick={() => loadTickets(page + 1)}>Suivant</Button>
            </div>
          )}

          {/* ========== MODALS ========== */}
          {/* Create Ticket Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
              <Card className="w-full max-w-md max-h-[90vh] overflow-auto">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div><CardTitle>Créer un ticket</CardTitle><CardDescription>Création manuelle par l'agent</CardDescription></div>
                  <Button variant="ghost" size="icon" onClick={() => setShowCreateModal(false)}><X className="h-5 w-5" /></Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium block mb-1.5">Service <span className="text-red-500">*</span></label>
                    <Select value={createForm.service_id} onValueChange={(v) => setCreateForm(f => ({ ...f, service_id: v }))} disabled={modalServicesLoading}>
                      <SelectTrigger><SelectValue placeholder={modalServicesLoading ? 'Chargement...' : 'Sélectionner un service'} /></SelectTrigger>
                      <SelectContent>
                        {modalServices.map(s => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            <span className="flex items-center gap-2">
                              {s.name}
                              <span className={cn('text-xs rounded-full px-1.5 py-0.5', s.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                                {s.status === 'open' ? 'Ouvert' : 'Fermé'}
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5">Type de ticket</label>
                    <Select value={createForm.priority} onValueChange={(v) => setCreateForm(f => ({ ...f, priority: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">Prioritaire</SelectItem>
                        <SelectItem value="vip">VIP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5">Nom du client</label>
                    <Input placeholder="Nom complet" value={createForm.customer_name} onChange={(e) => setCreateForm(f => ({ ...f, customer_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5">Téléphone</label>
                    <Input placeholder="+33 6 00 00 00 00" value={createForm.customer_phone} onChange={(e) => setCreateForm(f => ({ ...f, customer_phone: e.target.value }))} />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Attributs spéciaux</p>
                    <div className="space-y-2">
                      {[
                        { key: 'is_senior', label: 'Senior', icon: Baby },
                        { key: 'is_handicap', label: 'Handicap', icon: Accessibility },
                        { key: 'is_pregnant', label: 'Femme enceinte', icon: HeartHandshake },
                      ].map(({ key, label, icon: Icon }) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={createForm[key as keyof typeof createForm] as boolean}
                            onChange={(e) => setCreateForm(f => ({ ...f, [key]: e.target.checked }))}
                            className="h-4 w-4 rounded"
                          />
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" className="flex-1" onClick={() => { setShowCreateModal(false); setModalServices([]) }} disabled={creating}>Annuler</Button>
                    <Button className="flex-1" onClick={createTicket} disabled={creating || !createForm.service_id}>{creating ? 'Création...' : 'Créer'}</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Ticket Detail Modal */}
          {selectedTicket && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
              <Card className="w-full max-w-lg max-h-[90vh] overflow-auto">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div><CardTitle>Détails du ticket</CardTitle><CardDescription>{selectedTicket.number}</CardDescription></div>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedTicket(null)}><X className="h-5 w-5" /></Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-sm text-muted-foreground">Statut</p>{getStatusBadge(selectedTicket.status)}</div>
                    <div><p className="text-sm text-muted-foreground">Priorité</p>{getPriorityBadge(selectedTicket.priority)}</div>
                  </div>
                  {(selectedTicket.is_senior || selectedTicket.is_handicap || selectedTicket.is_pregnant) && (
                    <div><p className="text-sm text-muted-foreground mb-1">Attributs spéciaux</p><div className="flex flex-wrap gap-1">{getAttributeBadges(selectedTicket)}</div></div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-sm text-muted-foreground">Service</p><p className="font-medium">{selectedTicket.service.name}</p></div>
                    <div><p className="text-sm text-muted-foreground">Source</p>{getSourceBadge(selectedTicket.source)}</div>
                  </div>
                  {(selectedTicket.customer_name || selectedTicket.customer_phone || selectedTicket.user) && (
                    <div><p className="text-sm text-muted-foreground mb-2">Client</p><div className="bg-muted/50 rounded-lg p-3"><p className="font-medium">{selectedTicket.customer_name || selectedTicket.user?.name || '—'}</p>{(selectedTicket.customer_phone || selectedTicket.user?.phone) && <p className="text-sm">📞 {selectedTicket.customer_phone || selectedTicket.user?.phone}</p>}{selectedTicket.user?.email && <p className="text-sm">✉️ {selectedTicket.user.email}</p>}</div></div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-sm text-muted-foreground">Position</p><p className="font-medium">{selectedTicket.position ? `#${selectedTicket.position}` : '—'}</p></div>
                    <div><p className="text-sm text-muted-foreground">Guichet</p><p className="font-medium">{selectedTicket.counter?.name || '—'}</p></div>
                  </div>
                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Créé le</span><span>{formatDateDisplay(selectedTicket.created_at)}</span></div>
                    {selectedTicket.called_at && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Appelé le</span><span>{formatDateDisplay(selectedTicket.called_at)}</span></div>}
                    {selectedTicket.closed_at && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Clôturé le</span><span>{formatDateDisplay(selectedTicket.closed_at)}</span></div>}
                    {selectedTicket.absent_at && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Absent le</span><span>{formatDateDisplay(selectedTicket.absent_at)}</span></div>}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}