import { useMemo, useState } from 'react'
import { api } from '@/api/axios'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { LoadingState, ErrorState } from '@/components/ui/loading-state'
import { usePaginatedApiData } from '@/hooks/use-api-data'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Building2, Users, Search, Eye, CreditCard, Trash2, RefreshCw, Download, Mail, Ticket, Power } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { downloadBlob, parseApiDate } from '@/lib/utils'
import { formatFcfa, normalizePlanId, usePlans, SUBSCRIPTION_STATUS_LABELS } from '@/lib/plans'
import SubscriptionEditor, { type SubscriptionRow } from '@/components/saas/SubscriptionEditor'

type Establishment = {
  id: number
  name: string
  address?: string | null
  is_active?: boolean
  created_at?: string
  subscription?: (SubscriptionRow & { plan_details?: { name: string } | null }) | null
  admins?: Array<{ id: number; name: string; email: string; phone?: string | null }>
  total_tickets?: number
  total_agents?: number
  total_services?: number
  last_active?: string | null
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300',
  trial: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
  past_due: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300',
  canceled: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
}

const formatDate = (value?: string | null) => parseApiDate(value)?.toLocaleDateString('fr-FR') ?? '—'

export default function SaasEstablishments() {
  const { catalog } = usePlans()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [planFilter, setPlanFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'name' | 'created_at' | 'total_tickets' | 'last_active'>('created_at')
  const [details, setDetails] = useState<Establishment | null>(null)
  const [editing, setEditing] = useState<Establishment | null>(null)

  const { data: rows, loading, refreshing, error, refresh } = usePaginatedApiData<Establishment>('/api/saas/establishments', {
    perPage: 200,
  })

  const planName = (id?: string | null) =>
    id ? catalog?.plans.find((p) => p.id === normalizePlanId(id))?.name ?? id : '—'

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase()
    return rows
      .filter((e) => {
        const matchesSearch =
          e.name.toLowerCase().includes(term) ||
          (e.address ?? '').toLowerCase().includes(term) ||
          (e.admins ?? []).some((a) => a.email.toLowerCase().includes(term))
        const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? e.is_active : !e.is_active)
        const matchesPlan =
          planFilter === 'all' ||
          (planFilter === 'none' ? !e.subscription : normalizePlanId(e.subscription?.plan) === planFilter)
        return matchesSearch && matchesStatus && matchesPlan
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name)
        if (sortBy === 'total_tickets') return (b.total_tickets ?? 0) - (a.total_tickets ?? 0)
        const ta = parseApiDate(a[sortBy] ?? null)?.getTime() ?? 0
        const tb = parseApiDate(b[sortBy] ?? null)?.getTime() ?? 0
        return tb - ta
      })
  }, [rows, searchTerm, statusFilter, planFilter, sortBy])

  const stats = useMemo(() => {
    const byPlan: Record<string, number> = {}
    rows.forEach((r) => {
      const key = r.subscription ? normalizePlanId(r.subscription.plan) : 'none'
      byPlan[key] = (byPlan[key] ?? 0) + 1
    })
    return {
      total: rows.length,
      active: rows.filter((r) => r.is_active).length,
      tickets: rows.reduce((sum, r) => sum + (r.total_tickets ?? 0), 0),
      agents: rows.reduce((sum, r) => sum + (r.total_agents ?? 0), 0),
      byPlan,
    }
  }, [rows])

  const toggleActive = async (est: Establishment) => {
    const next = !est.is_active
    if (!next && !window.confirm(`Désactiver « ${est.name} » ? Il ne sera plus proposé aux usagers.`)) return
    try {
      await api.put(`/api/saas/establishments/${est.id}`, { is_active: next })
      toast.success(next ? 'Établissement activé' : 'Établissement désactivé')
      refresh()
    } catch {
      toast.error("Impossible de modifier l'établissement")
    }
  }

  const remove = async (est: Establishment) => {
    const typed = window.prompt(
      `Supprimer définitivement « ${est.name} », ses services et tout son historique de tickets ? Ses comptes agents et administrateurs seront détachés.\nTapez le nom de l'établissement pour confirmer.`,
    )
    if (typed === null) return
    if (typed.trim() !== est.name) {
      toast.error('Le nom saisi ne correspond pas : suppression annulée')
      return
    }
    try {
      await api.delete(`/api/saas/establishments/${est.id}`)
      toast.success('Établissement supprimé')
      refresh()
    } catch {
      toast.error("Impossible de supprimer l'établissement")
    }
  }

  const exportCsv = () => {
    const header = ['Établissement', 'Adresse', 'Actif', 'Offre', 'Statut abonnement', 'Admin', 'E-mail admin', 'Services', 'Agents', 'Tickets', 'Dernière activité', 'Créé le']
    const lines = filtered.map((e) => [
      e.name,
      e.address ?? '',
      e.is_active ? 'oui' : 'non',
      planName(e.subscription?.plan),
      e.subscription ? SUBSCRIPTION_STATUS_LABELS[e.subscription.status] ?? e.subscription.status : 'aucun',
      e.admins?.[0]?.name ?? '',
      e.admins?.[0]?.email ?? '',
      String(e.total_services ?? 0),
      String(e.total_agents ?? 0),
      String(e.total_tickets ?? 0),
      formatDate(e.last_active),
      formatDate(e.created_at),
    ])
    const csv = '﻿' + [header, ...lines].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'etablissements.csv')
  }

  if (loading && !rows.length) {
    return (
      <div className="container mx-auto px-4 py-8">
        <LoadingState message="Chargement des établissements..." size="lg" />
      </div>
    )
  }

  if (error && !rows.length) {
    return (
      <div className="container mx-auto px-4 py-8">
        <ErrorState message={error} onRetry={() => refresh()} />
      </div>
    )
  }

  const planChart = [
    ...(catalog?.plans ?? []).map((p) => ({ name: p.name, value: stats.byPlan[p.id] ?? 0 })),
    { name: 'Sans abonnement', value: stats.byPlan.none ?? 0 },
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Établissements clients</h1>
            <p className="text-muted-foreground">Activité, abonnement et administrateur de chaque établissement</p>
          </div>
          <Button variant="outline" onClick={() => refresh()} disabled={refreshing} className="flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Établissements</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">{stats.active} actif(s)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Abonnés</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total - (stats.byPlan.none ?? 0)}</div>
              <p className="text-xs text-muted-foreground">{stats.byPlan.none ?? 0} sans abonnement</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tickets</CardTitle>
              <Ticket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.tickets.toLocaleString('fr-FR')}</div>
              <p className="text-xs text-muted-foreground">Depuis la création des établissements</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Agents</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.agents}</div>
              <p className="text-xs text-muted-foreground">
                Moyenne : {stats.total ? (stats.agents / stats.total).toFixed(1) : 0} par établissement
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Répartition par offre</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={planChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Bar dataKey="value" name="Établissements" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>Liste des établissements</CardTitle>
                <CardDescription>
                  {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Exporter
              </Button>
            </div>
            <div className="flex flex-col lg:flex-row gap-3 pt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nom, adresse ou e-mail de l'admin…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="w-full lg:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="active">Actifs</SelectItem>
                  <SelectItem value="inactive">Inactifs</SelectItem>
                </SelectContent>
              </Select>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="w-full lg:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les offres</SelectItem>
                  {(catalog?.plans ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="none">Sans abonnement</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="w-full lg:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Plus récents</SelectItem>
                  <SelectItem value="name">Nom</SelectItem>
                  <SelectItem value="total_tickets">Tickets</SelectItem>
                  <SelectItem value="last_active">Dernière activité</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Établissement</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Abonnement</TableHead>
                    <TableHead>Tickets</TableHead>
                    <TableHead>Agents</TableHead>
                    <TableHead>Dernière activité</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((est) => (
                    <TableRow key={est.id}>
                      <TableCell>
                        <div className="font-medium">{est.name}</div>
                        <div className="text-sm text-muted-foreground">{est.admins?.[0]?.email ?? 'Aucun administrateur'}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={est.is_active ? STATUS_BADGE.active : STATUS_BADGE.canceled}>
                          {est.is_active ? 'Actif' : 'Inactif'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {est.subscription ? (
                          <div className="space-y-1">
                            <Badge className={STATUS_BADGE[est.subscription.status] ?? ''}>
                              {planName(est.subscription.plan)} · {SUBSCRIPTION_STATUS_LABELS[est.subscription.status] ?? est.subscription.status}
                            </Badge>
                            {est.subscription.plan_change_request && (
                              <div className="text-xs text-amber-600">Changement d'offre demandé</div>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline">Aucun</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{est.total_tickets ?? 0}</TableCell>
                      <TableCell className="font-mono text-sm">{est.total_agents ?? 0}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{est.last_active ? formatDate(est.last_active) : 'Jamais'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" title="Détails" onClick={() => setDetails(est)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" title="Abonnement" onClick={() => setEditing(est)}>
                            <CreditCard className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" title={est.is_active ? 'Désactiver' : 'Activer'} onClick={() => toggleActive(est)}>
                            <Power className="h-4 w-4" />
                          </Button>
                          {est.admins?.[0]?.email && (
                            <Button variant="ghost" size="sm" title="Écrire à l'administrateur" asChild>
                              <a href={`mailto:${est.admins[0].email}`}>
                                <Mail className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" title="Supprimer" className="text-destructive hover:text-destructive" onClick={() => remove(est)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        Aucun établissement trouvé
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!details} onOpenChange={(open) => !open && setDetails(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{details?.name}</DialogTitle>
            <DialogDescription>{details?.address || 'Adresse non renseignée'}</DialogDescription>
          </DialogHeader>
          {details && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-muted/40 p-3 text-center">
                  <p className="text-lg font-bold">{details.total_services ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Services</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3 text-center">
                  <p className="text-lg font-bold">{details.total_agents ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Agents</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3 text-center">
                  <p className="text-lg font-bold">{details.total_tickets ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Tickets</p>
                </div>
              </div>
              <div>
                <p className="font-medium mb-1">Administrateur(s)</p>
                {(details.admins ?? []).length === 0 && <p className="text-muted-foreground">Aucun</p>}
                {(details.admins ?? []).map((a) => (
                  <p key={a.id} className="text-muted-foreground">
                    {a.name} — {a.email}
                    {a.phone ? ` — ${a.phone}` : ''}
                  </p>
                ))}
              </div>
              <div>
                <p className="font-medium mb-1">Abonnement</p>
                {details.subscription ? (
                  <p className="text-muted-foreground">
                    {planName(details.subscription.plan)} · {SUBSCRIPTION_STATUS_LABELS[details.subscription.status] ?? details.subscription.status}
                    {details.subscription.monthly_amount ? ` · ${formatFcfa(details.subscription.monthly_amount)}/mois` : ''}
                    {details.subscription.current_period_end ? ` · jusqu'au ${formatDate(details.subscription.current_period_end)}` : ''}
                  </p>
                ) : (
                  <p className="text-muted-foreground">Aucun abonnement</p>
                )}
              </div>
              <p className="text-muted-foreground">Créé le {formatDate(details.created_at)}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {editing && (
        <SubscriptionEditor
          open={!!editing}
          onOpenChange={(open) => !open && setEditing(null)}
          establishmentId={editing.id}
          establishmentName={editing.name}
          subscription={editing.subscription ?? null}
          onSaved={() => refresh()}
        />
      )}
    </div>
  )
}
