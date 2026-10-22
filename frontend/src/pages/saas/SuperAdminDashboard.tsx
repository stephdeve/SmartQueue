import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/axios';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Users,
  CreditCard,
  Building2,
  Activity,
  Star,
  Crown,
  Download,
  RefreshCw,
  Settings,
  Banknote,
  Server,
  LineChartIcon,
  PieChartIcon,
} from 'lucide-react';
import { downloadBlob } from '@/lib/utils';
import { formatFcfa, normalizePlanId, usePlans, SUBSCRIPTION_STATUS_LABELS } from '@/lib/plans';

type Overview = {
  days: number;
  establishments: number;
  establishments_active: number;
  establishments_new: number;
  services: { total: number; open: number; closed: number };
  counters: { total: number; open: number; closed: number };
  tickets: { total: number; waiting: number; called: number; absent: number; processed: number; period_total: number };
  performance: { avg_wait_time: number | null; avg_service_time: number | null; rating_avg: number | null; reviews_count: number };
  subscriptions_by_status: Record<string, number>;
  subscriptions_by_plan: Record<string, number>;
  mrr_estimate: number;
  users_by_role: Record<string, number>;
  timeline: Array<{ date: string; tickets: number; establishments: number }>;
};

const ROLE_LABELS: Record<string, string> = {
  user: 'Usagers',
  agent: 'Agents',
  admin: 'Administrateurs',
  super_admin: 'Super admins',
};

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '12px',
};

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { catalog } = usePlans();
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/saas/monitoring/overview', { params: { days } });
      setData(response.data);
    } catch (error: any) {
      const status = error?.response?.status;
      toast.error(status === 403 ? 'Accès refusé. Permissions super admin requises.' : 'Impossible de charger le tableau de bord');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const exportTimeline = () => {
    if (!data) return;
    const rows = [
      ['Date', 'Tickets créés', 'Nouveaux établissements'],
      ...data.timeline.map((d) => [d.date, String(d.tickets), String(d.establishments)]),
    ];
    const csv = '﻿' + rows.map((r) => r.join(';')).join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `plateforme_${days}j.csv`);
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 rounded-full border-4 border-muted" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
          </div>
          <p className="text-muted-foreground">Chargement du tableau de bord…</p>
        </div>
      </div>
    );
  }

  const planName = (id: string) => catalog?.plans.find((p) => p.id === normalizePlanId(id))?.name ?? id;
  const planData = Object.entries(data?.subscriptions_by_plan ?? {}).map(([plan, count]) => ({ name: planName(plan), value: count }));
  const statusEntries = Object.entries(data?.subscriptions_by_status ?? {});
  const timeline = (data?.timeline ?? []).map((d) => ({
    ...d,
    label: new Date(`${d.date}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
  }));

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Tableau de bord super admin
            </h1>
            <p className="text-muted-foreground">Vue d'ensemble de la plateforme SmartQueue</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="flex items-center gap-2 px-4 py-2">
              <Crown className="h-4 w-4 text-yellow-600" />
              Super admin
            </Badge>
            <div className="inline-flex rounded-xl border border-border p-1 bg-card">
              {([7, 30, 90] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setDays(range)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
                    days === range
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  {range}J
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={loadDashboardData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
            <Button size="sm" onClick={exportTimeline} disabled={!data}>
              <Download className="h-4 w-4 mr-2" />
              Exporter
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white/80 text-sm font-medium">Revenu mensuel estimé</CardTitle>
                <Banknote className="h-5 w-5 text-white/60" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-2">{formatFcfa(data?.mrr_estimate ?? 0)}</div>
              <span className="text-white/70 text-sm">Abonnements actifs, au tarif des offres</span>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white/80 text-sm font-medium">Établissements</CardTitle>
                <Building2 className="h-5 w-5 text-white/60" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-2">{data?.establishments ?? 0}</div>
              <span className="text-white/70 text-sm">
                {data?.establishments_active ?? 0} actifs · {data?.establishments_new ?? 0} nouveaux sur {days} j
              </span>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white/80 text-sm font-medium">Abonnements actifs</CardTitle>
                <CreditCard className="h-5 w-5 text-white/60" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-2">{data?.subscriptions_by_status?.active ?? 0}</div>
              <span className="text-white/70 text-sm">{data?.subscriptions_by_status?.trial ?? 0} en période d'essai</span>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white/80 text-sm font-medium">Satisfaction</CardTitle>
                <Star className="h-5 w-5 text-white/60" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-2">
                {data?.performance?.rating_avg != null ? `${data.performance.rating_avg.toFixed(1)} / 5` : '—'}
              </div>
              <span className="text-white/70 text-sm">{data?.performance?.reviews_count ?? 0} avis sur {days} j</span>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-xl border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LineChartIcon className="h-5 w-5 text-blue-600" />
                Tickets créés par jour
              </CardTitle>
              <CardDescription>
                {data?.tickets?.period_total ?? 0} tickets sur les {days} derniers jours
              </CardDescription>
            </CardHeader>
            <CardContent>
              {timeline.every((d) => d.tickets === 0) ? (
                <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
                  Aucun ticket sur la période.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={timeline}>
                    <defs>
                      <linearGradient id="ticketsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" className="text-xs" />
                    <YAxis className="text-xs" allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="tickets" name="Tickets" stroke="#3b82f6" fill="url(#ticketsGradient)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-xl border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-purple-600" />
                Répartition par offre
              </CardTitle>
              <CardDescription>
                {statusEntries.length > 0
                  ? statusEntries.map(([s, n]) => `${SUBSCRIPTION_STATUS_LABELS[s] ?? s} : ${n}`).join(' · ')
                  : 'Aucun abonnement enregistré'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {planData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
                  Aucun abonnement enregistré.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={planData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" name="Abonnements" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Activité du jour */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="shadow-xl border-border lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-600" />
                Activité du jour
              </CardTitle>
              <CardDescription>Files d'attente de tous les établissements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  ['Tickets du jour', data?.tickets?.total],
                  ['En attente', data?.tickets?.waiting],
                  ['Appelés', data?.tickets?.called],
                  ['Servis', data?.tickets?.processed],
                  ['Absents', data?.tickets?.absent],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-2xl font-bold">{Number(value ?? 0)}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-sm">
                <div className="rounded-lg bg-muted/40 p-3">
                  Services ouverts : <strong>{data?.services?.open ?? 0}</strong> / {data?.services?.total ?? 0}
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  Guichets ouverts : <strong>{data?.counters?.open ?? 0}</strong> / {data?.counters?.total ?? 0}
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  Attente moyenne ({days} j) :{' '}
                  <strong>{data?.performance?.avg_wait_time != null ? `${data.performance.avg_wait_time} min` : '—'}</strong>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xl border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Comptes
              </CardTitle>
              <CardDescription>Par rôle</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(data?.users_by_role ?? {}).map(([role, count]) => (
                <div key={role} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{ROLE_LABELS[role] ?? role}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Building2, title: 'Établissements', desc: 'Clients, activité, activation', to: '/dashboard/saas/establishments', color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/20' },
            { icon: CreditCard, title: 'Abonnements', desc: 'Activer les essais réglés, changer d’offre', to: '/dashboard/saas/subscriptions', color: 'text-green-600 bg-green-100 dark:bg-green-900/20' },
            { icon: Settings, title: 'Configuration', desc: 'Diagnostic de mise en production', to: '/dashboard/saas/settings', color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/20' },
          ].map((action) => (
            <Card key={action.to} className="shadow-xl border-border hover:shadow-2xl transition-shadow">
              <CardContent className="p-6 text-center">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${action.color}`}>
                  <action.icon className="h-8 w-8" />
                </div>
                <h3 className="font-semibold mb-2">{action.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{action.desc}</p>
                <Button className="w-full" variant="outline" onClick={() => navigate(action.to)}>
                  Ouvrir
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/saas/monitoring')}>
            <Server className="h-4 w-4 mr-2" /> Monitoring détaillé
          </Button>
        </div>
      </div>
    </div>
  );
}
