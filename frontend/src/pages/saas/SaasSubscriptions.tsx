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
import { Banknote, Search, RefreshCw, Download, CheckCircle, Clock, Pencil, AlertTriangle } from 'lucide-react'
import { downloadBlob, parseApiDate } from '@/lib/utils'
import { formatFcfa, normalizePlanId, usePlans, SUBSCRIPTION_STATUS_LABELS } from '@/lib/plans'
import SubscriptionEditor, { type SubscriptionRow } from '@/components/saas/SubscriptionEditor'

type Subscription = SubscriptionRow & {
  id: number
  establishment_id: number
  establishment?: { id: number; name: string; is_active: boolean } | null
  plan_details?: { name: string } | null
  current_period_start?: string | null
  created_at?: string | null
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300',
  trial: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
  past_due: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300',
  canceled: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
}

const formatDate = (value?: string | null) => parseApiDate(value)?.toLocaleDateString('fr-FR') ?? '—'

export default function SaasSubscriptions() {
  const { catalog } = usePlans()
  const [status, setStatus] = useState('all')
  const [plan, setPlan] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [editing, setEditing] = useState<Subscription | null>(null)

  const { data: rows, loading, refreshing, error, refresh } = usePaginatedApiData<Subscription>('/api/saas/subscriptions', {
    perPage: 200,
  })

  const planName = (id?: string | null) => catalog?.plans.find((p) => p.id === normalizePlanId(id))?.name ?? id ?? '—'

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase()
    return rows.filter((s) => {
      const matchesSearch = (s.establishment?.name ?? '').toLowerCase().includes(term) || planName(s.plan).toLowerCase().includes(term)
      const matchesStatus = status === 'all' || s.status === status
      const matchesPlan = plan === 'all' || normalizePlanId(s.plan) === plan
      return matchesSearch && matchesStatus && matchesPlan
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, searchTerm, status, plan, catalog])

  const stats = useMemo(() => {
    const now = Date.now()
    const in7Days = now + 7 * 86400000
    return {
      mrr: rows.filter((r) => r.status === 'active').reduce((sum, r) => sum + (r.monthly_amount ?? 0), 0),
      active: rows.filter((r) => r.status === 'active').length,
      trial: rows.filter((r) => r.status === 'trial').length,
      trialEndingSoon: rows.filter((r) => {
        const end = parseApiDate(r.current_period_end ?? null)?.getTime()
        return r.status === 'trial' && end !== undefined && end <= in7Days
      }).length,
      changeRequests: rows.filter((r) => !!r.plan_change_request).length,
    }
  }, [rows])

  const activate = async (sub: Subscription) => {
    try {
      await api.put(`/api/saas/establishments/${sub.establishment_id}/subscription`, {
        plan: normalizePlanId(sub.plan),
        status: 'active',
        meta: { billing_cycle: sub.billing_cycle ?? 'month' },
      })
      toast.success('Abonnement activé')
      refresh()
    } catch {
      toast.error("Impossible d'activer l'abonnement")
    }
  }

  const exportCsv = () => {
    const header = ['Établissement', 'Offre', 'Statut', 'Facturation', 'Montant mensuel (FCFA)', 'Début', 'Fin', 'Demande de changement']
    const lines = filtered.map((s) => [
      s.establishment?.name ?? `#${s.establishment_id}`,
      planName(s.plan),
      SUBSCRIPTION_STATUS_LABELS[s.status] ?? s.status,
      s.billing_cycle === 'year' ? 'annuelle' : 'mensuelle',
      String(s.monthly_amount ?? 0),
      formatDate(s.current_period_start),
      formatDate(s.current_period_end),
      s.plan_change_request ? planName(s.plan_change_request.plan) : '',
    ])
    const csv = '﻿' + [header, ...lines].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'abonnements.csv')
  }

  if (loading && !rows.length) {
    return (
      <div className="container mx-auto px-4 py-8">
        <LoadingState message="Chargement des abonnements..." size="lg" />
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Abonnements</h1>
            <p className="text-muted-foreground">
              Aucun paiement n'est encaissé en ligne : activez l'abonnement à réception du règlement.
            </p>
          </div>
          <Button variant="outline" onClick={() => refresh()} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revenu mensuel</CardTitle>
              <Banknote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatFcfa(stats.mrr)}</div>
              <p className="text-xs text-muted-foreground">Abonnements actifs, au tarif des offres</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Actifs</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
              <p className="text-xs text-muted-foreground">sur {rows.length} abonnement(s)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En période d'essai</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.trial}</div>
              <p className="text-xs text-muted-foreground">{stats.trialEndingSoon} se termine(nt) dans les 7 jours</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Demandes de changement</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.changeRequests}</div>
              <p className="text-xs text-muted-foreground">Offre demandée par un abonné actif</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>Liste des abonnements</CardTitle>
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
                <Input placeholder="Établissement ou offre…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full lg:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {Object.entries(SUBSCRIPTION_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={plan} onValueChange={setPlan}>
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
                    <TableHead>Offre</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Montant / mois</TableHead>
                    <TableHead>Fin de période</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <div className="font-medium">{sub.establishment?.name ?? `#${sub.establishment_id}`}</div>
                        {sub.establishment && !sub.establishment.is_active && (
                          <div className="text-xs text-red-600">Établissement désactivé</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>{planName(sub.plan)}</div>
                        <div className="text-xs text-muted-foreground">{sub.billing_cycle === 'year' ? 'Annuelle' : 'Mensuelle'}</div>
                        {sub.plan_change_request && (
                          <div className="text-xs text-amber-600">Demande : {planName(sub.plan_change_request.plan)}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_BADGE[sub.status] ?? ''}>{SUBSCRIPTION_STATUS_LABELS[sub.status] ?? sub.status}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{formatFcfa(sub.monthly_amount ?? 0)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(sub.current_period_end)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {sub.status !== 'active' && (
                            <Button size="sm" onClick={() => activate(sub)}>
                              Activer
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => setEditing(sub)}>
                            <Pencil className="h-4 w-4 mr-1" /> Modifier
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        Aucun abonnement trouvé
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {editing && (
        <SubscriptionEditor
          open={!!editing}
          onOpenChange={(open) => !open && setEditing(null)}
          establishmentId={editing.establishment_id}
          establishmentName={editing.establishment?.name ?? `#${editing.establishment_id}`}
          subscription={editing}
          onSaved={() => refresh()}
        />
      )}
    </div>
  )
}
