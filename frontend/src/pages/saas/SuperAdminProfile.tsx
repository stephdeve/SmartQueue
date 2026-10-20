import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAppDispatch } from '@/store';
import { logout, refreshMe } from '@/store/authSlice';
import { api } from '@/api/axios';
import { toast } from 'sonner';
import { 
  Shield,
  Crown,
  Settings,
  Database,
  Mail,
  Bell,
  Globe,
  Lock,
  Key,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Download,
  Upload,
  Trash2,
  Plus,
  Edit,
  Save,
  X,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Server,
  HardDrive,
  Activity,
  BarChart3,
  FileText,
  HelpCircle,
  Users,
  Building2,
  CreditCard,
  Zap,
  Wifi,
  UserCheck,
  Ban,
  ShieldCheck,
  KeyRound,
  Fingerprint,
  UserPlus,
  UserMinus,
  TrendingUp,
  DollarSign,
  Clock,
  Calendar
} from 'lucide-react';

export default function SuperAdminProfile() {
  const { user, isAuthenticated } = useAuth();
  const dispatch = useAppDispatch();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [systemStats, setSystemStats] = useState<any>(null);
  const navigate = useNavigate();
  const [loadingStats, setLoadingStats] = useState(false);
  
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    avatar: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [adminSettings, setAdminSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    smsAlerts: false,
    systemAlerts: true,
    securityAlerts: true,
    performanceAlerts: true,
    userActivityLogs: true,
    systemLogs: false,
    backupNotifications: true,
    maintenanceMode: false,
    debugMode: false,
    apiLogging: true
  });

  // Charger les données du profil
  useEffect(() => {
    if (isAuthenticated && user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        avatar: user.avatar || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    }
  }, [isAuthenticated, user]);

  // Charger les statistiques système
  const loadSystemStats = async () => {
    setLoadingStats(true);
    try {
      const response = await api.get('/api/saas/admin/system-stats');
      setSystemStats(response.data);
    } catch (error) {
      console.error('Erreur chargement stats système:', error);
      toast.error('Impossible de charger les statistiques système');
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadSystemStats();
  }, []);

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      if (profileData.newPassword && profileData.newPassword !== profileData.confirmPassword) {
        toast.error('Les mots de passe ne correspondent pas');
        return;
      }

      await api.patch('/api/me', {
        name: profileData.name,
        email: profileData.email,
        phone: profileData.phone || null,
        avatar: profileData.avatar || null
      });

      // Le mot de passe passe par son endpoint dédié (PATCH /me l'ignorait silencieusement)
      if (profileData.newPassword) {
        await api.post('/api/me/change-password', {
          current_password: profileData.currentPassword,
          password: profileData.newPassword,
          password_confirmation: profileData.confirmPassword,
        });
        setProfileData((prev) => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
      }
      setIsEditing(false);
      await dispatch(refreshMe());
      toast.success('Profil mis à jour avec succès');
    } catch (error: any) {
      console.error('Erreur sauvegarde profil:', error);
      const status = error?.response?.status;
      const message = error?.response?.data?.message || error?.message || 'Erreur lors de la sauvegarde du profil';

      if (status === 405) {
        toast.error("La modification du profil n'est pas encore disponible côté serveur");
        return;
      }

      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Aucun endpoint serveur ne stocke ces préférences : ne pas simuler un succès
  const handleSaveAdminSettings = async () => {
    toast.info("Ces paramètres ne sont pas encore enregistrés côté serveur.");
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        avatar: user.avatar || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    }
  };

  const handleLogout = () => {
    dispatch(logout());
  };

  const handleSystemAction = async (action: string) => {
    try {
      setLoading(true);
      const response = await api.post(`/api/saas/admin/system/${action}`);
      toast.success(response.data?.message || `Action ${action} exécutée avec succès`);
      loadSystemStats();
    } catch (error: any) {
      console.error(`Erreur action ${action}:`, error);
      toast.error(error?.response?.data?.message || `Impossible d'exécuter l'action ${action}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Veuillez vous connecter pour accéder à votre profil.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Crown className="h-8 w-8 text-yellow-500" />
          <h1 className="text-3xl font-bold text-foreground">Profil Super Admin</h1>
        </div>
        <p className="text-muted-foreground">
          Gérez votre profil et les paramètres système de la plateforme
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="admin">Admin</TabsTrigger>
          <TabsTrigger value="security">Sécurité</TabsTrigger>
          <TabsTrigger value="system">Système</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        {/* Onglet Profil */}
        <TabsContent value="profile" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Colonne principale */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Informations personnelles */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Informations personnelles
                    </CardTitle>
                    {!isEditing ? (
                      <Button variant="outline" onClick={() => setIsEditing(true)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Modifier
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={handleCancelEdit} disabled={loading}>
                          <X className="h-4 w-4 mr-2" />
                          Annuler
                        </Button>
                        <Button onClick={handleSaveProfile} disabled={loading}>
                          <Save className="h-4 w-4 mr-2" />
                          {loading ? 'Enregistrement...' : 'Enregistrer'}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Avatar */}
                  <div className="flex items-center space-x-4">
                    <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                      {profileData.avatar ? (
                        <img src={profileData.avatar} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span className="text-2xl font-bold text-white">
                          {profileData.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        {profileData.name}
                        <Badge variant="default" className="bg-gradient-to-r from-yellow-400 to-orange-500">
                          <Crown className="h-3 w-3 mr-1" />
                          Super Admin
                        </Badge>
                      </h3>
                      <p className="text-sm text-muted-foreground">Administrateur système</p>
                      {isEditing && (
                        <div className="mt-2">
                          <Input
                            placeholder="URL de l'avatar"
                            value={profileData.avatar}
                            onChange={(e) => setProfileData({ ...profileData, avatar: e.target.value })}
                            className="w-full max-w-xs"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Informations de base */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Nom complet</Label>
                      <Input
                        value={profileData.name}
                        onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                        disabled={!isEditing}
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Email</Label>
                      <Input
                        type="email"
                        value={profileData.email}
                        onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                        disabled={!isEditing}
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Téléphone</Label>
                      <Input
                        type="tel"
                        value={profileData.phone}
                        onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                        disabled={!isEditing}
                        placeholder="Optionnel"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Rôle</Label>
                      <Input
                        value="Super Admin"
                        disabled={true}
                        className="bg-muted"
                      />
                    </div>
                  </div>

                  {/* Changement de mot de passe */}
                  {isEditing && (
                    <div className="border-t pt-6">
                      <h3 className="text-lg font-medium mb-4">Changement de mot de passe</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Mot de passe actuel</Label>
                          <Input
                            type="password"
                            value={profileData.currentPassword}
                            onChange={(e) => setProfileData({ ...profileData, currentPassword: e.target.value })}
                            placeholder="Laisser vide si inchangé"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Nouveau mot de passe</Label>
                          <Input
                            type="password"
                            value={profileData.newPassword}
                            onChange={(e) => setProfileData({ ...profileData, newPassword: e.target.value })}
                            placeholder="Laisser vide si inchangé"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Confirmer le mot de passe</Label>
                          <Input
                            type="password"
                            value={profileData.confirmPassword}
                            onChange={(e) => setProfileData({ ...profileData, confirmPassword: e.target.value })}
                            placeholder="Laisser vide si inchangé"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Colonne latérale */}
            <div className="space-y-6">
              {/* Statistiques administrateur */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Statistiques admin
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Admin depuis</p>
                    <p className="text-2xl font-bold">
                      {user?.created_at ? new Date(user.created_at).toLocaleDateString('fr-FR', {
                        month: 'long',
                        year: 'numeric'
                      }) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total utilisateurs</p>
                    <p className="text-2xl font-bold">{systemStats?.total_users || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Établissements</p>
                    <p className="text-2xl font-bold">{systemStats?.total_establishments || 0}</p>
                  </div>
                  <Button variant="outline" className="w-full" onClick={loadSystemStats}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loadingStats ? 'animate-spin' : ''}`} />
                    Actualiser
                  </Button>
                </CardContent>
              </Card>

              {/* Actions rapides admin */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Actions rapides
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/dashboard/saas/establishments')}>
                    <Building2 className="h-4 w-4 mr-2" />
                    Gérer les établissements
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/dashboard/saas/subscriptions')}>
                    <Users className="h-4 w-4 mr-2" />
                    Gérer les abonnements
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/dashboard/saas/monitoring')}>
                    <FileText className="h-4 w-4 mr-2" />
                    Voir le monitoring
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Onglet Admin */}
        <TabsContent value="admin" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Paramètres de notification */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notifications administrateur
                </CardTitle>
                <CardDescription>
                  Configurez les alertes et notifications système
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Notifications email</p>
                    <p className="text-sm text-muted-foreground">Alertes critiques par email</p>
                  </div>
                  <Switch 
                    checked={adminSettings.emailNotifications}
                    onCheckedChange={(checked) => setAdminSettings({...adminSettings, emailNotifications: checked})}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Alertes système</p>
                    <p className="text-sm text-muted-foreground">Erreurs et pannes système</p>
                  </div>
                  <Switch 
                    checked={adminSettings.systemAlerts}
                    onCheckedChange={(checked) => setAdminSettings({...adminSettings, systemAlerts: checked})}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Alertes sécurité</p>
                    <p className="text-sm text-muted-foreground">Tentatives d'accès suspectes</p>
                  </div>
                  <Switch 
                    checked={adminSettings.securityAlerts}
                    onCheckedChange={(checked) => setAdminSettings({...adminSettings, securityAlerts: checked})}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Alertes performance</p>
                    <p className="text-sm text-muted-foreground">Ralentissements et surcharges</p>
                  </div>
                  <Switch 
                    checked={adminSettings.performanceAlerts}
                    onCheckedChange={(checked) => setAdminSettings({...adminSettings, performanceAlerts: checked})}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Notifications backup</p>
                    <p className="text-sm text-muted-foreground">Succès/échec des sauvegardes</p>
                  </div>
                  <Switch 
                    checked={adminSettings.backupNotifications}
                    onCheckedChange={(checked) => setAdminSettings({...adminSettings, backupNotifications: checked})}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Paramètres système */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Paramètres système
                </CardTitle>
                <CardDescription>
                  Configuration avancée de la plateforme
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Mode maintenance</p>
                    <p className="text-sm text-muted-foreground">Mettre la plateforme en maintenance</p>
                  </div>
                  <Switch 
                    checked={adminSettings.maintenanceMode}
                    onCheckedChange={(checked) => setAdminSettings({...adminSettings, maintenanceMode: checked})}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Mode debug</p>
                    <p className="text-sm text-muted-foreground">Activer les logs de debug</p>
                  </div>
                  <Switch 
                    checked={adminSettings.debugMode}
                    onCheckedChange={(checked) => setAdminSettings({...adminSettings, debugMode: checked})}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Logs API</p>
                    <p className="text-sm text-muted-foreground">Enregistrer toutes les requêtes API</p>
                  </div>
                  <Switch 
                    checked={adminSettings.apiLogging}
                    onCheckedChange={(checked) => setAdminSettings({...adminSettings, apiLogging: checked})}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Logs utilisateurs</p>
                    <p className="text-sm text-muted-foreground">Suivre l'activité des utilisateurs</p>
                  </div>
                  <Switch 
                    checked={adminSettings.userActivityLogs}
                    onCheckedChange={(checked) => setAdminSettings({...adminSettings, userActivityLogs: checked})}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Logs système</p>
                    <p className="text-sm text-muted-foreground">Logs détaillés du système</p>
                  </div>
                  <Switch 
                    checked={adminSettings.systemLogs}
                    onCheckedChange={(checked) => setAdminSettings({...adminSettings, systemLogs: checked})}
                  />
                </div>
                <Button onClick={handleSaveAdminSettings} disabled={loading} className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Sauvegarde...' : 'Sauvegarder les paramètres'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Onglet Sécurité */}
        <TabsContent value="security" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sécurité du compte */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Sécurité du compte
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">Authentification à deux facteurs</p>
                    <p className="text-sm text-muted-foreground">Sécurité renforcée du compte</p>
                  </div>
                  <Button variant="outline" disabled title="Bientôt disponible">
                    <KeyRound className="h-4 w-4 mr-2" />
                    Configurer
                  </Button>
                </div>
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">Sessions actives</p>
                    <p className="text-sm text-muted-foreground">Gérer les connexions actives</p>
                  </div>
                  <Button variant="outline" disabled title="Bientôt disponible">
                    <Eye className="h-4 w-4 mr-2" />
                    Voir
                  </Button>
                </div>
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">Clés API</p>
                    <p className="text-sm text-muted-foreground">Générer et gérer les clés API</p>
                  </div>
                  <Button variant="outline" disabled title="Bientôt disponible">
                    <Key className="h-4 w-4 mr-2" />
                    Gérer
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Sécurité système */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Sécurité système
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">Politique de mots de passe</p>
                    <p className="text-sm text-muted-foreground">Configuration des exigences</p>
                  </div>
                  <Button variant="outline" disabled title="Bientôt disponible">
                    <Settings className="h-4 w-4 mr-2" />
                    Configurer
                  </Button>
                </div>
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">Liste noire IP</p>
                    <p className="text-sm text-muted-foreground">Bloquer les adresses IP</p>
                  </div>
                  <Button variant="outline" disabled title="Bientôt disponible">
                    <Ban className="h-4 w-4 mr-2" />
                    Gérer
                  </Button>
                </div>
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">Audit de sécurité</p>
                    <p className="text-sm text-muted-foreground">Vérifier les vulnérabilités</p>
                  </div>
                  <Button variant="outline" disabled title="Bientôt disponible">
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Lancer
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Onglet Système */}
        <TabsContent value="system" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Informations système */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Informations système
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Version</p>
                      <p className="text-lg font-semibold">1.0.0-MVP</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Uptime</p>
                      <p className="text-lg font-semibold">{systemStats?.uptime || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">CPU Usage</p>
                      <p className="text-lg font-semibold">{systemStats?.cpu_usage != null ? `${systemStats.cpu_usage}%` : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Memory Usage</p>
                      <p className="text-lg font-semibold">{systemStats?.memory_usage != null ? `${systemStats.memory_usage}%` : 'N/A'}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Disk Usage</p>
                      <p className="text-lg font-semibold">{systemStats?.disk_usage != null ? `${systemStats.disk_usage}%` : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Database</p>
                      <p className="text-lg font-semibold">{systemStats?.db_status || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Cache</p>
                      <p className="text-lg font-semibold">{systemStats?.cache_status || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">API Status</p>
                      <p className={`text-lg font-semibold ${systemStats ? 'text-green-600' : 'text-muted-foreground'}`}>{systemStats ? 'Online' : 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions système */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Actions système
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => handleSystemAction('cache-clear')}
                  disabled={loading}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Vider le cache
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Onglet Logs */}
        <TabsContent value="logs" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Logs système */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Logs système
                </CardTitle>
                <CardDescription>
                  Derniers événements système
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {systemStats?.recent_logs?.slice(0, 10).map((log: any, index: number) => (
                    <div key={index} className="p-3 bg-muted/50 rounded-lg text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{log.type}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-muted-foreground">{log.message}</p>
                    </div>
                  )) || (
                    <p className="text-center text-muted-foreground py-8">
                      Aucun log récent
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Logs d'activité */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Logs d'activité
                </CardTitle>
                <CardDescription>
                  Activité des utilisateurs et administrateurs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {systemStats?.activity_logs?.slice(0, 10).map((log: any, index: number) => (
                    <div key={index} className="p-3 bg-muted/50 rounded-lg text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{log.user}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-muted-foreground">{log.action}</p>
                    </div>
                  )) || (
                    <p className="text-center text-muted-foreground py-8">
                      Aucune activité récente
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Footer actions */}
      <div className="mt-8 flex justify-between items-center border-t pt-6">
        <div className="text-sm text-muted-foreground">
          Version 1.0.0-MVP • Dernière mise à jour: {new Date().toLocaleDateString('fr-FR')}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadSystemStats}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
          <Button variant="destructive" onClick={handleLogout}>
            Se déconnecter
          </Button>
        </div>
      </div>
    </div>
  );
}
