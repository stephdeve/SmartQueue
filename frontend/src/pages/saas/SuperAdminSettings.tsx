/**
 * Paramètres super admin : diagnostic de la configuration de production.
 *
 * La configuration de la plateforme vit dans les variables d'environnement du
 * serveur (Railway…). Cette page indique, sans jamais afficher de secret, si
 * chaque service est configuré et opérationnel, et rappelle la variable à régler.
 * (L'ancienne version présentait des formulaires non reliés au serveur.)
 */
import { useEffect, useState } from 'react'
import { api } from '@/api/axios'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LoadingState, ErrorState } from '@/components/ui/loading-state'
import { AlertTriangle, CheckCircle, RefreshCw, Shield, XCircle, Trash2 } from 'lucide-react'
import { formatFcfa, type PlanCatalog } from '@/lib/plans'

type Check = {
  key: string
  label: string
  value: string
  level: 'ok' | 'warning' | 'error'
  hint: string
}

const LEVEL_STYLE: Record<Check['level'], { icon: any; className: string; label: string }> = {
  ok: { icon: CheckCircle, className: 'text-green-600', label: 'OK' },
  warning: { icon: AlertTriangle, className: 'text-amber-600', label: 'À vérifier' },
  error: { icon: XCircle, className: 'text-red-600', label: 'Bloquant' },
}

export default function SuperAdminSettings() {
  const { user } = useAuth()
  const [checks, setChecks] = useState<Check[]>([])
  const [plans, setPlans] = useState<PlanCatalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get('/api/saas/admin/config')
      setChecks(Array.isArray(data?.checks) ? data.checks : [])
      setPlans(data?.plans ?? null)
    } catch (e: any) {
      setError(e?.response?.status === 403 ? 'Accès réservé aux super administrateurs.' : 'Impossible de charger le diagnostic')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.role === 'super_admin') load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role])

  const clearCache = async () => {
    setClearing(true)
    try {
      const { data } = await api.post('/api/saas/admin/system/cache-clear')
      toast.success(data?.message || 'Cache vidé')
    } catch {
      toast.error('Impossible de vider le cache')
    } finally {
      setClearing(false)
    }
  }

  if (user?.role !== 'super_admin') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Accès restreint</h1>
          <p className="text-muted-foreground">Cette page est réservée aux super administrateurs.</p>
        </div>
      </div>
    )
  }

  if (loading && checks.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <LoadingState message="Diagnostic en cours..." size="lg" />
      </div>
    )
  }

  if (error && checks.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <ErrorState message={error} onRetry={load} />
      </div>
    )
  }

  const blocking = checks.filter((c) => c.level === 'error').length
  const warnings = checks.filter((c) => c.level === 'warning').length

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Configuration de la plateforme</h1>
            <p className="text-muted-foreground max-w-2xl">
              Ces réglages se font dans les variables d'environnement du serveur. Aucun secret n'est affiché ici :
              seulement l'état de chaque service.
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Relancer le diagnostic
          </Button>
        </div>

        <Card className={blocking > 0 ? 'border-red-300 dark:border-red-800' : warnings > 0 ? 'border-amber-300 dark:border-amber-800' : 'border-green-300 dark:border-green-800'}>
          <CardContent className="p-6 flex items-center gap-4">
            {blocking > 0 ? (
              <XCircle className="h-8 w-8 text-red-600 shrink-0" />
            ) : warnings > 0 ? (
              <AlertTriangle className="h-8 w-8 text-amber-600 shrink-0" />
            ) : (
              <CheckCircle className="h-8 w-8 text-green-600 shrink-0" />
            )}
            <div>
              <p className="font-semibold">
                {blocking > 0
                  ? `${blocking} point(s) bloquant(s) pour la production`
                  : warnings > 0
                    ? `${warnings} point(s) à vérifier`
                    : 'Configuration prête pour la production'}
              </p>
              <p className="text-sm text-muted-foreground">
                Les signaux du planificateur et du worker se rafraîchissent toutes les minutes / 5 minutes.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Services</CardTitle>
            <CardDescription>État mesuré par le serveur</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {checks.map((check) => {
              const style = LEVEL_STYLE[check.level]
              const Icon = style.icon
              return (
                <div key={check.key} className="py-4 flex flex-col md:flex-row md:items-start gap-3 md:gap-6">
                  <div className="flex items-center gap-3 md:w-72 shrink-0">
                    <Icon className={`h-5 w-5 ${style.className}`} />
                    <span className="font-medium">{check.label}</span>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-mono break-all">{check.value}</span>
                      {check.level !== 'ok' && (
                        <Badge variant={check.level === 'error' ? 'destructive' : 'secondary'}>{style.label}</Badge>
                      )}
                    </div>
                    {check.level !== 'ok' && <p className="text-sm text-muted-foreground">{check.hint}</p>}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {plans && (
          <Card>
            <CardHeader>
              <CardTitle>Offres</CardTitle>
              <CardDescription>
                Définies dans config/plans.php · essai de {plans.trial_days} jours (SUBSCRIPTION_TRIAL_DAYS) · remise annuelle{' '}
                {plans.annual_discount_percent}%
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.plans.map((plan) => (
                <div key={plan.id} className="rounded-lg border p-4">
                  <p className="font-semibold">{plan.name}</p>
                  <p className="text-xl font-bold">{formatFcfa(plan.monthly_price)}/mois</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {plan.features.map((f) => (
                      <li key={f}>• {f}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Maintenance</CardTitle>
            <CardDescription>
              Les sauvegardes, migrations et redémarrages se font chez l'hébergeur (base de données et conteneur).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={clearCache} disabled={clearing}>
              <Trash2 className="h-4 w-4 mr-2" />
              {clearing ? 'Vidage…' : 'Vider le cache applicatif'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
