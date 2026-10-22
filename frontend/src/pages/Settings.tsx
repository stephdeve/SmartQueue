import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppDispatch } from '@/store';
import { logout } from '@/store/authSlice';
import { api } from '@/api/axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTheme } from '@/components/theme-provider';
import { cn, downloadBlob, localDateString, percentChange } from '@/lib/utils';
import { formatFcfa, normalizePlanId, SUBSCRIPTION_STATUS_LABELS, type PlanCatalog } from '@/lib/plans';
import { Loader2, Sun, Moon, Download, Bell, BarChart3, ListOrdered, CalendarClock } from 'lucide-react';

type EstablishmentForm = {
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
};

type SubscriptionInfo = {
  plan: string;
  plan_details: { name: string; features: string[] } | null;
  status: string;
  billing_cycle: 'month' | 'year';
  monthly_amount: number;
  current_period_end: string | null;
  plan_change_request: { plan: string } | null;
};

type QuickStats = {
  created: number;
  createdPrev: number;
  wait: number | null;
  waitPrev: number | null;
  ratingAvg: number | null;
  ratingCount: number;
  agentsActive: number;
  agentsTotal: number;
};

function Trend({ value, lowerIsBetter = false }: { value: number | null; lowerIsBetter?: boolean }) {
  if (value === null) return <p className="text-xs text-muted-foreground">Pas de période de comparaison</p>;
  const good = lowerIsBetter ? value <= 0 : value >= 0;
  return (
    <p className={cn('text-xs', value === 0 ? 'text-muted-foreground' : good ? 'text-green-600' : 'text-red-600')}>
      {value > 0 ? '+' : ''}
      {value}% vs 30 jours précédents
    </p>
  );
}

export default function Settings() {
  const { user, isAuthenticated } = useAuth();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const isAdmin = user?.role === 'admin';

  const [initialLoading, setInitialLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [form, setForm] = useState<EstablishmentForm>({ name: '', address: '', latitude: null, longitude: null });
  const [savedForm, setSavedForm] = useState<EstablishmentForm | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [pendingSubscription, setPendingSubscription] = useState<any>(null);
  const [catalog, setCatalog] = useState<PlanCatalog | null>(null);
  const [stats, setStats] = useState<QuickStats | null>(null);

  const establishmentId = user?.establishment_id;

  const loadEstablishment = async () => {
    const { data } = await api.get(`/api/admin/establishments/${establishmentId}`);
    const est = data?.data ?? data;
    const next: EstablishmentForm = {
      name: est?.name || '',
      address: est?.address || '',
      latitude: typeof est?.lat === 'number' ? est.lat : null,
      longitude: typeof est?.lng === 'number' ? est.lng : null,
    };
    setForm(next);
    setSavedForm(next);
  };

  const loadSubscription = async () => {
    const { data } = await api.get('/api/admin/subscription');
    setSubscription(data?.subscription ?? null);
    setPendingSubscription(data?.pending_subscription ?? null);
    setCatalog(data?.catalog ?? null);
  };

  const loadStats = async () => {
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 86400000);
    const d60 = new Date(now.getTime() - 60 * 86400000);
    const [current, previous, reviews, agents] = await Promise.all([
      api.get('/api/admin/stats/overview', { params: { from: d30.toISOString(), to: now.toISOString() } }),
      api.get('/api/admin/stats/overview', { params: { from: d60.toISOString(), to: d30.toISOString() } }),
      api.get('/api/admin/reviews/stats').catch(() => ({ data: null })),
      api.get('/api/admin/agents'),
    ]);
    const agentList: any[] = agents.data?.data ?? [];
    setStats({
      created: Number(current.data?.tickets?.created ?? 0),
      createdPrev: Number(previous.data?.tickets?.created ?? 0),
      wait: current.data?.tickets?.wait_avg_minutes ?? null,
      waitPrev: previous.data?.tickets?.wait_avg_minutes ?? null,
      ratingAvg: reviews.data?.global_avg ?? null,
      ratingCount: Number(reviews.data?.total ?? 0),
      agentsActive: agentList.filter((a) => a.status === 'active').length,
      agentsTotal: agentList.length,
    });
  };

  useEffect(() => {
    if (!isAuthenticated || !isAdmin || !establishmentId) {
      setInitialLoading(false);
      return;
    }
    setInitialLoading(true);
    Promise.allSettled([loadEstablishment(), loadSubscription(), loadStats()])
      .then((results) => {
        if (results.some((r) => r.status === 'rejected')) {
          toast.error('Certaines informations n’ont pas pu être chargées.');
        }
      })
      .finally(() => setInitialLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isAdmin, establishmentId]);

  const validate = () => {
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = "Le nom de l'établissement est requis";
    if (form.latitude !== null && (form.latitude < -90 || form.latitude > 90)) next.latitude = 'Latitude entre -90 et 90';
    if (form.longitude !== null && (form.longitude < -180 || form.longitude > 180)) next.longitude = 'Longitude entre -180 et 180';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await api.put(`/api/admin/establishments/${establishmentId}`, {
        name: form.name.trim(),
        address: form.address.trim() || null,
        lat: form.latitude,
        lng: form.longitude,
      });
      setSavedForm(form);
      setIsEditing(false);
      toast.success('Établissement mis à jour');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Impossible d’enregistrer les modifications');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (savedForm) setForm(savedForm);
    setErrors({});
    setIsEditing(false);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const to = localDateString();
      const from = localDateString(new Date(Date.now() - 30 * 86400000));
      const { data } = await api.get('/api/admin/tickets/export', { params: { from, to }, responseType: 'blob' });
      downloadBlob(data, `tickets_${from}_${to}.csv`);
      toast.success('Export téléchargé');
    } catch {
      toast.error("Erreur lors de l'export des tickets");
    } finally {
      setExporting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Veuillez vous connecter pour accéder aux paramètres.</p>
      </div>
    );
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentPlanId = normalizePlanId(subscription?.plan ?? pendingSubscription?.plan);
  const status = subscription?.status ?? pendingSubscription?.status;
  const periodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end) : null;
  const requestedPlan = subscription?.plan_change_request?.plan
    ? catalog?.plans.find((p) => p.id === normalizePlanId(subscription.plan_change_request?.plan))
    : null;

  return (
    <div className="w-full mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Paramètres</h1>
        <p className="text-muted-foreground">
          {isAdmin ? 'Abonnement, établissement et préférences' : 'Préférences de votre compte'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {isAdmin && (
            <>
              {/* Abonnement */}
              <div className="bg-card rounded-xl shadow-lg border border-border p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                  <h2 className="text-xl font-semibold text-foreground">Abonnement</h2>
                  {status && (
                    <span
                      className={cn(
                        'px-3 py-1 rounded-full text-sm font-medium',
                        status === 'active' && 'bg-emerald-100 text-emerald-800',
                        status === 'trial' && 'bg-blue-100 text-blue-800',
                        (status === 'past_due' || status === 'canceled') && 'bg-red-100 text-red-800',
                      )}
                    >
                      {SUBSCRIPTION_STATUS_LABELS[status] ?? status}
                    </span>
                  )}
                </div>

                {subscription ? (
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">Offre {subscription.plan_details?.name ?? subscription.plan}</p>
                        <p className="text-sm text-muted-foreground">
                          Facturation {subscription.billing_cycle === 'year' ? 'annuelle' : 'mensuelle'}
                        </p>
                      </div>
                      <span className="text-2xl font-bold text-primary">{formatFcfa(subscription.monthly_amount)}/mois</span>
                    </div>
                    {periodEnd && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarClock className="h-4 w-4" />
                        {status === 'trial' ? "Fin de la période d'essai" : 'Fin de la période en cours'} :{' '}
                        {periodEnd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                    )}
                    {status === 'trial' && (
                      <p className="text-sm text-muted-foreground">
                        L'abonnement sera activé par l'équipe SmartQueue à réception de votre règlement.
                      </p>
                    )}
                    {requestedPlan && (
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        Demande de passage à l'offre {requestedPlan.name} en attente de validation.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mb-4">
                    Aucun abonnement n'est enregistré pour votre établissement. Choisissez une offre pour démarrer votre
                    période d'essai.
                  </p>
                )}

                {catalog && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
                    {catalog.plans.map((plan) => (
                      <div
                        key={plan.id}
                        className={cn(
                          'border rounded-lg p-3 text-center relative',
                          plan.id === currentPlanId ? 'border-2 border-primary bg-primary/5' : 'border-border',
                        )}
                      >
                        {plan.id === currentPlanId && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground">
                            Actuelle
                          </span>
                        )}
                        <h4 className="font-medium mb-1">{plan.name}</h4>
                        <p className="text-xl font-bold">{formatFcfa(plan.monthly_price)}</p>
                        <p className="text-xs text-muted-foreground">/mois</p>
                        <ul className="text-xs text-muted-foreground mt-2 space-y-1 text-left">
                          {plan.features.slice(0, 4).map((f) => (
                            <li key={f}>• {f}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <Button className="flex-1" onClick={() => navigate('/dashboard/subscription')}>
                    {subscription ? "Changer d'offre" : 'Choisir une offre'}
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => navigate('/dashboard/billing')}>
                    Facturation
                  </Button>
                </div>
              </div>

              {/* Établissement */}
              <div className="bg-card rounded-xl shadow-lg border border-border p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-foreground">Établissement</h2>
                  {!isEditing ? (
                    <Button variant="outline" onClick={() => setIsEditing(true)}>
                      Modifier
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={handleCancel} disabled={saving}>
                        Annuler
                      </Button>
                      <Button onClick={handleSave} disabled={saving}>
                        {saving ? 'Enregistrement…' : 'Enregistrer'}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-foreground">Nom de l'établissement</label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      disabled={!isEditing}
                      className={cn('mt-1', errors.name && 'border-red-500')}
                    />
                    {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-foreground">Adresse</label>
                    <Input
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      disabled={!isEditing}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Latitude</label>
                    <Input
                      type="number"
                      step="any"
                      value={form.latitude ?? ''}
                      onChange={(e) => setForm({ ...form, latitude: e.target.value === '' ? null : Number(e.target.value) })}
                      disabled={!isEditing}
                      className={cn('mt-1', errors.latitude && 'border-red-500')}
                    />
                    {errors.latitude && <p className="text-sm text-red-500 mt-1">{errors.latitude}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Longitude</label>
                    <Input
                      type="number"
                      step="any"
                      value={form.longitude ?? ''}
                      onChange={(e) => setForm({ ...form, longitude: e.target.value === '' ? null : Number(e.target.value) })}
                      disabled={!isEditing}
                      className={cn('mt-1', errors.longitude && 'border-red-500')}
                    />
                    {errors.longitude && <p className="text-sm text-red-500 mt-1">{errors.longitude}</p>}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Les coordonnées permettent aux usagers de trouver l'établissement à proximité et d'estimer leur trajet.
                </p>
              </div>

              {/* Files d'attente */}
              <div className="bg-card rounded-xl shadow-lg border border-border p-6">
                <h2 className="text-xl font-semibold text-foreground mb-2">Files d'attente</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Capacité, temps de service, priorités, horaires, délais d'appel et nombre de rappels se règlent pour
                  chaque service.
                </p>
                <Button variant="outline" onClick={() => navigate('/dashboard/services')}>
                  <ListOrdered className="mr-2 h-4 w-4" /> Configurer les services
                </Button>
              </div>
            </>
          )}

          {/* Apparence */}
          <div className="bg-card rounded-xl shadow-lg border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Apparence</h2>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Thème de l'interface</span>
              <Button variant="outline" size="sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? <Sun className="h-4 w-4 mr-1" /> : <Moon className="h-4 w-4 mr-1" />}
                {theme === 'dark' ? 'Clair' : 'Sombre'}
              </Button>
            </div>
          </div>
        </div>

        {/* Colonne latérale */}
        <div className="space-y-6">
          {isAdmin && stats && (
            <div className="bg-card rounded-xl shadow-lg border border-border p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">30 derniers jours</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Tickets créés</p>
                  <p className="text-2xl font-bold text-foreground">{stats.created.toLocaleString('fr-FR')}</p>
                  <Trend value={percentChange(stats.created, stats.createdPrev)} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Temps d'attente moyen</p>
                  <p className="text-2xl font-bold text-foreground">{stats.wait !== null ? `${stats.wait} min` : '—'}</p>
                  <Trend
                    value={stats.wait !== null && stats.waitPrev !== null ? percentChange(stats.wait, stats.waitPrev) : null}
                    lowerIsBetter
                  />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Satisfaction des usagers</p>
                  <p className="text-2xl font-bold text-foreground">
                    {stats.ratingAvg !== null ? `${Number(stats.ratingAvg).toFixed(1)} / 5` : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">{stats.ratingCount} avis au total</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Agents actifs</p>
                  <p className="text-2xl font-bold text-foreground">
                    {stats.agentsActive}/{stats.agentsTotal}
                  </p>
                </div>
              </div>
              <Button variant="outline" className="w-full mt-4" onClick={() => navigate('/dashboard/stats')}>
                <BarChart3 className="mr-2 h-4 w-4" /> Statistiques détaillées
              </Button>
            </div>
          )}

          {isAdmin && (
            <div className="bg-card rounded-xl shadow-lg border border-border p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Actions rapides</h2>
              <div className="space-y-3">
                <Button variant="outline" className="w-full justify-start" onClick={handleExport} disabled={exporting}>
                  {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Exporter les tickets (30 jours)
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/dashboard/push')}>
                  <Bell className="mr-2 h-4 w-4" /> Envoyer une notification
                </Button>
              </div>
            </div>
          )}

          <div className="bg-card rounded-xl shadow-lg border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Compte</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Connecté en tant que {user?.name} ({user?.email})
            </p>
            <Button variant="destructive" onClick={() => dispatch(logout())} className="w-full">
              Se déconnecter
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
