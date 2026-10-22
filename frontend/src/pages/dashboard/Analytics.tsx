import { useEffect, useMemo, useState } from 'react'
import { api } from '@/api/axios'
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import { Button } from '@/components/ui/button'
import { AnalyticsCard } from '@/components/ui/analytics-card'
import { cn, localDateString } from '@/lib/utils'
import {
  Ticket, CheckCircle, UserX, TrendingUp, TrendingDown,
  Lightbulb, AlertTriangle, Timer,
  ArrowUpRight, ArrowDownRight, Minus,
  Activity, CalendarDays,
} from 'lucide-react'

// Même période pour les cartes et la courbe (sinon 7 jours d'un côté, 14 de l'autre)
const PERIOD_DAYS = 30

export default function Analytics() {
  const [bucket, setBucket] = useState<'day' | 'hour' | 'week'>('day')
  const [serviceId, setServiceId] = useState<number | ''>('' as any)
  const [series, setSeries] = useState<any[]>([])
  const [overview, setOverview] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [services, setServices] = useState<Array<{ id: number; name: string }>>([])

  const range = useMemo(() => ({
    from: localDateString(new Date(Date.now() - (PERIOD_DAYS - 1) * 86400000)),
    to: localDateString(),
  }), [])

  const params = useMemo(() => {
    const p: any = { bucket, ...range }
    if (serviceId) p.service_id = serviceId
    return p
  }, [bucket, serviceId, range])

  useEffect(() => {
    api.get('/api/admin/stats/overview', { params: range })
      .then((r) => setOverview(r.data))
      .catch(() => setOverview(null))
  }, [range])

  useEffect(() => {
    api.get('/api/admin/services')
      .then((r) => {
        // Ressource paginée : { data: [...], links, meta }
        const list = Array.isArray(r.data) ? r.data : Array.isArray(r.data?.data) ? r.data.data : []
        setServices(list.map((s: any) => ({ id: s.id, name: s.name ?? `Service #${s.id}` })))
      })
      .catch(() => setServices([]))
  }, [])

  useEffect(() => {
    setLoading(true)
    setErr('')
    api.get('/api/admin/stats/series', { params })
      .then((r) => {
        setSeries(Array.isArray(r.data?.series) ? r.data.series : [])
        setLoading(false)
      })
      .catch((e) => {
        setSeries([])
        setLoading(false)
        setErr(e?.message || 'Erreur lors du chargement des analytics')
      })
  }, [params])

  const insights = useMemo(() => {
    if (series.length < 2) return []
    const items: Array<{ icon: any; color: string; bg: string; text: string }> = []

    const mid = Math.floor(series.length / 2)
    const prevHalf = series.slice(0, mid)
    const currHalf = series.slice(mid)
    const sum = (arr: any[], k: string) => arr.reduce((s, p) => s + (p[k] || 0), 0)

    const prevCreated = sum(prevHalf, 'created')
    const currCreated = sum(currHalf, 'created')
    if (prevCreated > 0) {
      const diff = ((currCreated - prevCreated) / prevCreated) * 100
      items.push({
        icon: diff > 0 ? TrendingUp : TrendingDown,
        color: diff > 0 ? 'text-green-600' : 'text-red-600',
        bg: diff > 0 ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
        text: `Créations ${diff > 0 ? 'en hausse' : 'en baisse'} de ${Math.abs(Math.round(diff))}% sur la 2e moitié de la période`,
      })
    }

    const peak = [...series].sort((a, b) => (b.created || 0) - (a.created || 0))[0]
    if (peak) {
      items.push({
        icon: CalendarDays,
        color: 'text-blue-600',
        bg: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800',
        text: `${bucket === 'hour' ? 'Créneau' : 'Jour'} de pointe : ${peak.bucket} (${peak.created} créations)`,
      })
    }

    const totalCreated = sum(series, 'created')
    const totalAbsent = sum(series, 'absent')
    if (totalCreated > 0) {
      const absentRate = (totalAbsent / totalCreated) * 100
      if (absentRate > 15) {
        items.push({
          icon: AlertTriangle,
          color: 'text-amber-600',
          bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800',
          text: `Taux d'absentéisme de ${Math.round(absentRate)}% — au-dessus de la moyenne`,
        })
      }
    }

    return items
  }, [series, bucket])

  const periodChanges = useMemo(() => {
    if (series.length < 2) return null
    const mid = Math.floor(series.length / 2)
    const prevHalf = series.slice(0, mid)
    const currHalf = series.slice(mid)
    const sum = (arr: any[], k: string) => arr.reduce((s, p) => s + (p[k] || 0), 0)
    const keys = ['created', 'closed', 'absent'] as const
    return keys.map(key => {
      const prev = sum(prevHalf, key)
      const curr = sum(currHalf, key)
      const pct = prev > 0 ? Math.round(((curr - prev) / prev) * 100) : 0
      return { key, prev, curr, pct }
    })
  }, [series])

  const observations = useMemo(() => {
    if (series.length === 0) return []
    const items: Array<{ label: string; value: string; icon: any }> = []

    const sum = (k: string) => series.reduce((s, p) => s + (p[k] || 0), 0)
    const totalCreated = sum('created')
    const totalClosed = sum('closed')
    const totalAbsent = sum('absent')

    const maxCreated = Math.max(...series.map(p => p.created || 0))
    const bestEntry = series.find(p => p.created === maxCreated)
    if (bestEntry) {
      items.push({
        icon: CalendarDays,
        label: `Meilleur ${bucket === 'hour' ? 'créneau' : 'jour'}`,
        value: `${bestEntry.bucket} (${maxCreated} tickets)`,
      })
    }

    const maxClosed = Math.max(...series.map(p => p.closed || 0))
    const bestClosed = series.find(p => p.closed === maxClosed)
    if (bestClosed) {
      items.push({
        icon: CheckCircle,
        label: 'Plus de clôtures',
        value: `${bestClosed.bucket} (${maxClosed} tickets)`,
      })
    }

    if (totalCreated > 0) {
      items.push({
        icon: Activity,
        label: 'Taux de réalisation',
        value: `${Math.round((totalClosed / totalCreated) * 100)}%`,
      })
      items.push({
        icon: UserX,
        label: 'Absentéisme',
        value: `${Math.round((totalAbsent / totalCreated) * 100)}%`,
      })
    }

    return items
  }, [series, bucket])

  return (
    <div className="w-full mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-1">Analytics</h1>
          <p className="text-muted-foreground">Indicateurs des {PERIOD_DAYS} derniers jours.</p>
        </div>
        <Button variant="outline" onClick={() => history.back()}>Retour</Button>
      </div>

      {insights.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Lightbulb className="h-4 w-4" />
            <span>Analyse intelligente</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {insights.map((insight, i) => (
              <div key={i} className={cn('flex items-start gap-3 rounded-lg border p-3', insight.bg)}>
                <div className={cn('mt-0.5', insight.color)}>
                  <insight.icon className="h-4 w-4" />
                </div>
                <p className={cn('text-sm font-medium', insight.color)}>{insight.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {periodChanges && (
        <div className="flex items-center gap-4 flex-wrap">
          {periodChanges.map((pc) => {
            const Icon = pc.pct > 0 ? ArrowUpRight : pc.pct < 0 ? ArrowDownRight : Minus
            const color = pc.pct > 0 ? 'text-green-600' : pc.pct < 0 ? 'text-red-500' : 'text-muted-foreground'
            const labels: Record<string, string> = { created: 'Créés', closed: 'Clos', absent: 'Absents' }
            return (
              <div key={pc.key} className="flex items-center gap-1.5 text-sm">
                <span className="text-muted-foreground">{labels[pc.key]}:</span>
                <span className="font-semibold text-foreground">{pc.curr}</span>
                <Icon className={cn('h-4 w-4', color)} />
                <span className={cn('font-medium', color)}>{pc.pct > 0 ? '+' : ''}{pc.pct}%</span>
              </div>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <AnalyticsCard
          title="Créés"
          value={overview?.tickets?.created ?? '—'}
          icon={Ticket}
        />
        <AnalyticsCard
          title="Clos"
          value={overview?.tickets?.closed ?? '—'}
          icon={CheckCircle}
        />
        <AnalyticsCard
          title="Absents"
          value={overview?.tickets?.absent ?? '—'}
          icon={UserX}
        />
        <AnalyticsCard
          title="Attente moyenne"
          value={overview?.tickets?.wait_avg_minutes != null ? `${overview.tickets.wait_avg_minutes} min` : '—'}
          icon={Timer}
        />
      </div>

      <div className="bg-card rounded-xl shadow-lg border border-border p-6 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-lg font-semibold text-foreground">Évolution</div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex rounded-lg border border-border overflow-hidden">
              {(['day', 'week', 'hour'] as const).map(b => (
                <button
                  key={b}
                  onClick={() => setBucket(b)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium transition-all',
                    bucket === b
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:text-foreground'
                  )}
                >
                  {b === 'day' ? 'Jour' : b === 'week' ? 'Semaine' : 'Heure'}
                </button>
              ))}
            </div>
            {services.length > 0 && (
              <select
                className="w-44 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                value={serviceId === '' ? '' : String(serviceId)}
                onChange={e => setServiceId(e.target.value ? Number(e.target.value) : '' as any)}
              >
                <option value="">Tous les services</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="h-96">
          {loading ? (
            <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">Chargement…</div>
          ) : err ? (
            <div className="h-full w-full flex items-center justify-center text-sm text-destructive">{err}</div>
          ) : series.length === 0 ? (
            <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">Aucune donnée</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bucket" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="created" stroke="#3b82f6" strokeWidth={2} dot={false} name="Créés" />
                <Line type="monotone" dataKey="closed" stroke="#10b981" strokeWidth={2} dot={false} name="Clos" />
                <Line type="monotone" dataKey="absent" stroke="#f59e0b" strokeWidth={2} dot={false} name="Absents" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {observations.length > 0 && (
        <div className="bg-card rounded-xl shadow-lg border border-border p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Lightbulb className="h-4 w-4" />
            <span>Observations</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {observations.map((obs, i) => (
              <div key={i} className="bg-muted/30 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <obs.icon className="h-3.5 w-3.5" />
                  <span>{obs.label}</span>
                </div>
                <div className="text-sm font-semibold text-foreground">{obs.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
