import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppDispatch } from '@/store';
import { logout } from '@/store/authSlice';
import { api } from '@/api/axios';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const { user, isAuthenticated } = useAuth();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [establishmentData, setEstablishmentData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    latitude: null as number | null,
    longitude: null as number | null,
    capacity: 50,
    avgServiceTime: 15,
    priorityQueues: true,
    publicDisplay: true
  });
  const [subscription, setSubscription] = useState(null);
  const [stats, setStats] = useState(null);
  const [agents, setAgents] = useState(null);

  const currentPlan = (subscription as any)?.plan || user?.pending_subscription?.plan || 'starter'
  const currentStatus = (subscription as any)?.status || user?.pending_subscription?.status || 'active'

  // Configuration des plans avec prix CFA
  const getPlanPrice = (plan: string) => {
    const prices = {
      starter: 10000,
      basic: 10000,   // Alias pour starter
      professional: 30000,
      pro: 30000,     // Alias pour professional
      enterprise: 80000
    }
    return prices[plan as keyof typeof prices] || 10000
  }

  const getPlanFeatures = (plan: string) => {
    const features = {
      starter: 'Jusqu\'à 2 agents, 3 services, analytics basic',
      basic: 'Jusqu\'à 2 agents, 3 services, analytics basic',
      professional: 'Jusqu\'à 5 agents, 10 services, analytics avancées',
      pro: 'Jusqu\'à 5 agents, 10 services, analytics avancées',
      enterprise: 'Illimité agents, API complète, support prioritaire'
    }
    return features[plan as keyof typeof features] || features.starter
  }

  const getPlanDisplayName = (plan: string) => {
    const names = {
      starter: 'Starter',
      basic: 'Starter',
      professional: 'Professional',
      pro: 'Professional',
      enterprise: 'Enterprise'
    }
    return names[plan as keyof typeof names] || 'Starter'
  }

  const formatCFAPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR').format(price) + ' FCFA'
  }

  const handleLogout = () => {
    dispatch(logout());
  };

  // Charger les données de l'établissement
  useEffect(() => {
    if (isAuthenticated && user?.establishment_id) {
      loadEstablishment();
      loadSubscription();
      loadStats();
      loadAgents();
    }
  }, [isAuthenticated, user?.establishment_id]);

  const loadEstablishment = async () => {
    try {
      const { data } = await api.get(`/api/admin/establishments/${user.establishment_id}`);
      setEstablishmentData({
        name: data.data.name || '',
        address: data.data.address || '',
        phone: data.data.phone || '',
        email: data.data.email || '',
        latitude: (typeof data.data.lat === 'number' ? data.data.lat : (typeof data.data.latitude === 'number' ? data.data.latitude : null)),
        longitude: (typeof data.data.lng === 'number' ? data.data.lng : (typeof data.data.longitude === 'number' ? data.data.longitude : null)),
        capacity: data.data.capacity || 50,
        avgServiceTime: data.data.avg_service_time_minutes || 15,
        priorityQueues: typeof data.data.priority_queues === 'boolean' ? data.data.priority_queues : true,
        publicDisplay: typeof data.data.public_display === 'boolean' ? data.data.public_display : true
      });
    } catch (error) {
      console.error('Erreur chargement établissement:', error);
    }
  };

  const loadSubscription = async () => {
    try {
      const { data } = await api.get('/api/saas/subscriptions?establishment_id=' + user.establishment_id);
      if (data.data && data.data.length > 0) {
        setSubscription(data.data[0]);
      }
    } catch (error) {
      console.error('Erreur chargement abonnement:', error);
      // Fallback: utiliser les données pending_subscription de l'utilisateur
      if (user?.pending_subscription) {
        setSubscription({
          plan: user.pending_subscription.plan || 'starter',
          status: user.pending_subscription.status || 'active',
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        });
      }
    }
  };

  const loadStats = async () => {
    try {
      const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await api.get(`/api/admin/stats/overview?from=${from}`);
      setStats(data.data);
    } catch (error) {
      console.error('Erreur chargement statistiques:', error);
    }
  };

  const loadAgents = async () => {
    try {
      const { data } = await api.get('/api/admin/agents');
      setAgents(data.data);
    } catch (error) {
      console.error('Erreur chargement agents:', error);
    }
  };

  const handleSaveEstablishment = async () => {
    setLoading(true);
    try {
      const payload = {
        name: establishmentData.name,
        address: establishmentData.address,
        phone: establishmentData.phone,
        email: establishmentData.email,
        latitude: establishmentData.latitude,
        longitude: establishmentData.longitude,
        lat: establishmentData.latitude,
        lng: establishmentData.longitude,
        capacity: establishmentData.capacity,
        avg_service_time_minutes: establishmentData.avgServiceTime,
        priority_queues: establishmentData.priorityQueues,
        public_display: establishmentData.publicDisplay
      }

      const { data } = await api.put(
        `/api/admin/establishments/${user.establishment_id}`,
        payload,
      );
      setIsEditing(false);

      const est = (data && (data.data ?? data)) as any;
      if (est && typeof est === 'object') {
        setEstablishmentData({
          name: est.name || establishmentData.name || '',
          address: est.address || establishmentData.address || '',
          phone: est.phone || establishmentData.phone || '',
          email: est.email || establishmentData.email || '',
          latitude: typeof est.lat === 'number' ? est.lat : typeof est.latitude === 'number' ? est.latitude : establishmentData.latitude,
          longitude: typeof est.lng === 'number' ? est.lng : typeof est.longitude === 'number' ? est.longitude : establishmentData.longitude,
          capacity: est.capacity || establishmentData.capacity || 50,
          avgServiceTime: est.avg_service_time_minutes || establishmentData.avgServiceTime || 15,
          priorityQueues: typeof est.priority_queues === 'boolean' ? est.priority_queues : establishmentData.priorityQueues,
          publicDisplay: typeof est.public_display === 'boolean' ? est.public_display : establishmentData.publicDisplay,
        });
      } else {
        await loadEstablishment();
      }
    } catch (error) {
      console.error('Erreur sauvegarde établissement:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePlan = () => {
    navigate('/dashboard/subscription')
  }

  const handleManageBilling = () => {
    navigate('/dashboard/billing')
  }

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Veuillez vous connecter pour accéder aux paramètres.</p>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin'
  const currentPlanPrice = getPlanPrice(currentPlan)
  const currentPlanDisplayName = getPlanDisplayName(currentPlan)
  const currentPlanFeatures = getPlanFeatures(currentPlan)

  return (
    <div className="container mx-auto px-4 py-8 ">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Paramètres de l'établissement</h1>
        <p className="text-muted-foreground">
          Gérez votre établissement, abonnement et configurations du projet
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Abonnement et facturation */}
          <div className="bg-card rounded-xl shadow-lg border border-border p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground">Abonnement et facturation</h2>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  currentPlan === 'enterprise' ? 'bg-purple-100 text-purple-800' :
                  currentPlan === 'professional' || currentPlan === 'pro' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  Plan {currentPlanDisplayName}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  currentStatus === 'active' ? 'bg-emerald-100 text-emerald-800' :
                  currentStatus === 'canceled' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {currentStatus === 'active' ? 'Actif' : currentStatus}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Plan actuel</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatCFAPrice(currentPlanPrice)}/mois
                  </span>
                </div>
                <div className="text-sm text-muted-foreground mb-3">
                  {currentPlanFeatures}
                </div>
                <Button className="w-full" onClick={handleChangePlan} disabled={loading}>Changer de plan</Button>
              </div>

              <Button variant="outline" className="w-full" onClick={handleManageBilling} disabled={loading}>
                Gérer la facturation
              </Button>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className={`border rounded-lg p-3 text-center relative ${
                  currentPlan === 'starter' || currentPlan === 'basic' ? 'border-2 border-primary bg-primary/5' : 'border-border'
                }`}>
                  {(currentPlan === 'starter' || currentPlan === 'basic') && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground">
                      Actuel
                    </span>
                  )}
                  <h4 className="font-medium mb-1">Starter</h4>
                  <p className="text-2xl font-bold mb-1">{formatCFAPrice(10000)}</p>
                  <p className="text-xs text-muted-foreground">/mois</p>
                  <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                    <li>• 2 agents</li>
                    <li>• 3 services</li>
                    <li>• Analytics basic</li>
                  </ul>
                </div>
                <div className={`border rounded-lg p-3 text-center relative ${
                  currentPlan === 'professional' || currentPlan === 'pro' ? 'border-2 border-primary bg-primary/5' : 'border-border'
                }`}>
                  {(currentPlan === 'professional' || currentPlan === 'pro') && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground">
                      Actuel
                    </span>
                  )}
                  <h4 className="font-medium mb-1">Professional</h4>
                  <p className="text-2xl font-bold mb-1 text-primary">{formatCFAPrice(30000)}</p>
                  <p className="text-xs text-muted-foreground">/mois</p>
                  <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                    <li>• 5 agents</li>
                    <li>• 10 services</li>
                    <li>• Analytics avancées</li>
                  </ul>
                </div>
                <div className={`border rounded-lg p-3 text-center relative ${
                  currentPlan === 'enterprise' ? 'border-2 border-primary bg-primary/5' : 'border-border'
                }`}>
                  {currentPlan === 'enterprise' && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground">
                      Actuel
                    </span>
                  )}
                  <h4 className="font-medium mb-1">Enterprise</h4>
                  <p className="text-2xl font-bold mb-1">{formatCFAPrice(80000)}</p>
                  <p className="text-xs text-muted-foreground">/mois</p>
                  <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                    <li>• Illimité</li>
                    <li>• API complète</li>
                    <li>• Support prioritaire</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="font-medium">Prochaine facturation</p>
                  <p className="text-sm text-muted-foreground">
                    {subscription?.current_period_end ? 
                      new Date(subscription.current_period_end).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      }) : 'Non défini'
                    }
                  </p>
                </div>
                <Button variant="outline" onClick={handleManageBilling} disabled={loading}>Gérer la facturation</Button>
              </div>
            </div>
          </div>

          {isAdmin && (
            <>
              {/* Informations de l'établissement */}
              <div className="bg-card rounded-xl shadow-lg border border-border p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-foreground">Informations de l'établissement</h2>
                  {!isEditing ? (
                    <Button variant="outline" onClick={() => setIsEditing(true)}>
                      Modifier
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={handleCancelEdit} disabled={loading}>
                        Annuler
                      </Button>
                      <Button onClick={handleSaveEstablishment} disabled={loading}>
                        {loading ? 'Enregistrement...' : 'Enregistrer'}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">Nom de l'établissement</label>
                    <Input
                      value={establishmentData.name}
                      onChange={(e) => setEstablishmentData({ ...establishmentData, name: e.target.value })}
                      disabled={!isEditing}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Téléphone
                    </label>
                    <Input
                      type="tel"
                      value={establishmentData.phone}
                      onChange={(e) => setEstablishmentData({ ...establishmentData, phone: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Adresse</label>
                    <Input
                      value={establishmentData.address}
                      onChange={(e) => setEstablishmentData({ ...establishmentData, address: e.target.value })}
                      disabled={!isEditing}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Latitude</label>
                    <Input
                      type="number"
                      value={establishmentData.latitude ?? ''}
                      onChange={(e) => {
                        const v = e.target.value
                        setEstablishmentData({ ...establishmentData, latitude: v === '' ? null : Number(v) })
                      }}
                      disabled={!isEditing}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Longitude</label>
                    <Input
                      type="number"
                      value={establishmentData.longitude ?? ''}
                      onChange={(e) => {
                        const v = e.target.value
                        setEstablishmentData({ ...establishmentData, longitude: v === '' ? null : Number(v) })
                      }}
                      disabled={!isEditing}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Configuration des files */}
              <div className="bg-card rounded-xl shadow-lg border border-border p-6">
                <h2 className="text-xl font-semibold text-foreground mb-6">Configuration des files d'attente</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-medium text-foreground mb-4">Paramètres généraux</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Capacité maximale par file
                        </label>
                        <Input
                          type="number"
                          value={establishmentData.capacity}
                          onChange={(e) => setEstablishmentData({ ...establishmentData, capacity: parseInt(e.target.value) })}
                          min="10"
                          max="200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Temps moyen de service (minutes)
                        </label>
                        <Input
                          type="number"
                          value={establishmentData.avgServiceTime}
                          onChange={(e) => setEstablishmentData({ ...establishmentData, avgServiceTime: parseInt(e.target.value) })}
                          min="5"
                          max="60"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-foreground mb-4">Options avancées</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Files prioritaires</p>
                          <p className="text-sm text-muted-foreground">VIP, urgences, handicapés</p>
                        </div>
                        <input
                          type="checkbox"
                          className="toggle"
                          checked={establishmentData.priorityQueues}
                          onChange={(e) => setEstablishmentData({ ...establishmentData, priorityQueues: e.target.checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Affichage public</p>
                          <p className="text-sm text-muted-foreground">Visible sur la carte publique</p>
                        </div>
                        <input
                          type="checkbox"
                          className="toggle"
                          checked={establishmentData.publicDisplay}
                          onChange={(e) => setEstablishmentData({ ...establishmentData, publicDisplay: e.target.checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Notifications SMS</p>
                          <p className="text-sm text-muted-foreground">Alertes SMS pour les usagers</p>
                        </div>
                        <input type="checkbox" className="toggle" defaultChecked />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Export PDF</p>
                          <p className="text-sm text-muted-foreground">Générer des rapports PDF</p>
                        </div>
                        <input type="checkbox" className="toggle" defaultChecked />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Intégrations et API */}
              <div className="bg-card rounded-xl shadow-lg border border-border p-6">
                <h2 className="text-xl font-semibold text-foreground mb-6">Intégrations et API</h2>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-foreground mb-3">Clés API</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium">API Key</p>
                          <p className="text-sm text-muted-foreground">sk_live_...4f7a</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">Copier</Button>
                          <Button variant="outline" size="sm">Regénérer</Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium">Webhook URL</p>
                          <p className="text-sm text-muted-foreground">https://vqs.app/webhook/abc123</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">Copier</Button>
                          <Button variant="outline" size="sm">Configurer</Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-foreground mb-3">Intégrations disponibles</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            <span className="text-xs font-bold text-blue-600">TW</span>
                          </div>
                          <div>
                            <p className="font-medium">Twilio</p>
                            <p className="text-xs text-muted-foreground">SMS & Voice</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">Configurer</Button>
                      </div>
                      <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                            <span className="text-xs font-bold text-red-600">FB</span>
                          </div>
                          <div>
                            <p className="font-medium">Firebase</p>
                            <p className="text-xs text-muted-foreground">Push notifications</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/push')}>Configurer</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

        </div>

        {/* Colonne latérale */}
        <div className="space-y-6">
          
          {isAdmin && (
            <>
              {/* Statistiques rapides */}
              <div className="bg-card rounded-xl shadow-lg border border-border p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">Statistiques rapides</h2>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Tickets ce mois</p>
                    <p className="text-2xl font-bold text-foreground">
                      {stats?.tickets?.created?.toLocaleString() || '0'}
                    </p>
                    <p className="text-xs text-green-600">
                      {stats?.tickets?.created && stats?.tickets?.created > 1000 ? '+12%' : 'Stable'} vs mois dernier
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Temps d'attente moyen</p>
                    <p className="text-2xl font-bold text-foreground">
                      {stats?.tickets?.wait_avg_minutes ? `${stats.tickets.wait_avg_minutes} min` : 'N/A'}
                    </p>
                    <p className="text-xs text-red-600">
                      {stats?.tickets?.wait_avg_minutes && stats.tickets.wait_avg_minutes > 15 ? '+3 min vs mois dernier' : 'Stable'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Taux de satisfaction</p>
                    <p className="text-2xl font-bold text-foreground">
                      {stats?.tickets?.closed && stats?.tickets?.created ? 
                        Math.round((stats.tickets.closed / stats.tickets.created) * 100) : 0}%
                      </p>
                    <p className="text-xs text-green-600">+2% vs mois dernier</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Agents actifs</p>
                    <p className="text-2xl font-bold text-foreground">
                      {agents ? `${agents.filter(a => a.status === 'active').length}/${agents.length}` : '0/0'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {agents ? `${agents.filter(a => a.status === 'active').length} actifs maintenant` : 'Chargement...'}
                    </p>
                  </div>
                </div>
                <Button variant="outline" className="w-full mt-4" onClick={() => navigate('/dashboard/analytics')}>
                  Voir les analytics complets
                </Button>
              </div>

              {/* Actions rapides */}
              <div className="bg-card rounded-xl shadow-lg border border-border p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">Actions rapides</h2>
                <div className="space-y-3">
                  <Button variant="outline" className="w-full justify-start">
                    📊 Exporter les données
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    📧 Envoyer une newsletter
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    🔧 Maintenance mode
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    📱 Configuration mobile
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    🎨 Personnaliser l'interface
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Support */}
          <div className="bg-card rounded-xl shadow-lg border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Support</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Documentation</span>
                <Button variant="outline" size="sm">Voir</Button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Support technique</span>
                <Button variant="outline" size="sm">Contacter</Button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Statut du service</span>
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              </div>
            </div>
          </div>

          {/* Actions système */}
          <div className="bg-card rounded-xl shadow-lg border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Système</h2>
            <div className="space-y-3">
              <Button variant="destructive" onClick={handleLogout} className="w-full">
                Se déconnecter
              </Button>
              <div className="text-xs text-muted-foreground text-center">
                Version 1.0.0-MVP<br />
                Dernière mise à jour: 4 Mars 2026
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}