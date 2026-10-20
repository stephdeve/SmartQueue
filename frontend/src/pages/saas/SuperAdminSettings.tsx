import React, { useState, useEffect } from 'react';
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
import { logout } from '@/store/authSlice';
import { toast } from 'sonner';
import { api } from '@/api/axios';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Building2,
  CreditCard,
  Users,
  Settings,
  Database,
  Mail,
  Bell,
  Globe,
  Smartphone,
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
  Zap,
  Server,
  HardDrive,
  Wifi,
  Activity,
  BarChart3,
  FileText,
  HelpCircle,
  MessageSquare,
  Phone,
  MapPin,
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  UserCheck,
  Ban,
  ShieldCheck,
  KeyRound,
  Fingerprint,
  UserPlus,
  UserMinus,
  Crown,
  Gem,
  Star,
  Award,
  Target,
  Rocket,
  Package,
  ShoppingCart,
  Receipt,
  Calculator,
  PiggyBank,
  Banknote,
  CreditCardIcon,
  Building,
  Store,
  Factory,
  Briefcase,
  Home,
  School,
  ShoppingBag,
  Coffee,
  Car,
  Plane,
  Train,
  Bus,
  Ship,
  Bike,
  Baby,
  Dog,
  Cat,
  Fish,
  Bird,
  Bug,
  TreePine,
  Flower,
  Sun,
  Moon,
  Cloud,
  CloudRain,
  CloudSnow,
  Wind,
  Thermometer,
  Droplets,
  Gauge,
  Battery,
  Plug,
  ZapIcon,
  Lightbulb,
  Cpu,
  Monitor,
  SmartphoneIcon,
  Tablet,
  Laptop,
  Headphones,
  Speaker,
  Camera,
  Video,
  Mic,
  Gamepad2,
  Music,
  Radio,
  Tv,
  Film,
  Book,
  Newspaper,
  Bookmark,
  File,
  Folder,
  Archive,
  Image,
  FileImage,
  FileVideo,
  FileAudio,
  FileTextIcon,
  FileCode,
  FileSpreadsheet,
  FilePlus,
  FileMinus,
  FileCheck,
  FileX,
  FileQuestion,
  FileLock,
  FileEdit,
  FileSignature,
  FileDigit,
  FileBarChart,
  FilePieChart,
  FileLineChart,
  FileBox,
  FileArchive,
  FileDown,
  FileUp,
  FileInput,
  FileJson,
} from 'lucide-react';

export default function SuperAdminSettings() {
  const { user, isAuthenticated } = useAuth();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving] = useState(false);

  // SaaS Configuration
  const [saasConfig, setSaasConfig] = useState({
    platformName: 'SmartQueue SaaS',
    platformDescription: 'Plateforme de gestion de files d\'attente virtuelle',
    companyEmail: 'admin@smartqueue.com',
    companyPhone: '+33 1 23 45 67 89',
    companyAddress: '123 Rue de la Technologie, 75001 Paris, France',
    defaultLanguage: 'fr',
    defaultCurrency: 'EUR',
    defaultTimezone: 'Europe/Paris',
    maintenanceMode: false,
    allowNewRegistrations: true,
    requireEmailVerification: true,
    allowTrialPeriods: true,
    trialPeriodDays: 14,
    autoRenewSubscriptions: true,
    gracePeriodDays: 7,
    maxEstablishmentsPerAccount: 10,
    maxAgentsPerEstablishment: 50,
    maxServicesPerEstablishment: 20,
    allowCustomBranding: true,
    allowWhiteLabel: false,
    allowApiAccess: true,
    allowWebhooks: true,
    allowExports: true,
    allowIntegrations: true,
    allowCustomDomains: false,
    allowSso: false,
    allowMultiTenant: true,
    allowAuditLogs: true,
    allowBackupRestore: true,
    allowDataRetention: true,
    dataRetentionDays: 365,
    allowGDPRCompliance: true,
    allowCCPACompliance: true,
    allowSOC2Compliance: false,
    allowISO27001Compliance: false,
    allowHIPAACompliance: false,
    allowPCIDSSCompliance: false,
  });

  // Plans Configuration
  const [plans, setPlans] = useState([
    {
      id: 'basic',
      name: 'Basic',
      description: 'Idéal pour les petites entreprises',
      price: 19,
      currency: 'EUR',
      billingCycle: 'monthly',
      maxEstablishments: 1,
      maxAgents: 2,
      maxServices: 3,
      maxTicketsPerDay: 100,
      maxStorageGB: 5,
      features: [
        'Files d\'attente illimitées',
        'Application mobile',
        'Notifications SMS',
        'Rapports de base',
        'Support email'
      ],
      isActive: true,
      isPopular: false,
      trialDays: 14,
      setupFee: 0,
    },
    {
      id: 'pro',
      name: 'Pro',
      description: 'Parfait pour les entreprises en croissance',
      price: 49,
      currency: 'EUR',
      billingCycle: 'monthly',
      maxEstablishments: 3,
      maxAgents: 5,
      maxServices: 10,
      maxTicketsPerDay: 500,
      maxStorageGB: 20,
      features: [
        'Tout le plan Basic',
        'Analytics avancées',
        'API complète',
        'Intégrations tierces',
        'Support prioritaire',
        'Branding personnalisé'
      ],
      isActive: true,
      isPopular: true,
      trialDays: 14,
      setupFee: 0,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'Solution complète pour grandes entreprises',
      price: 149,
      currency: 'EUR',
      billingCycle: 'monthly',
      maxEstablishments: -1,
      maxAgents: -1,
      maxServices: -1,
      maxTicketsPerDay: -1,
      maxStorageGB: -1,
      features: [
        'Tout le plan Pro',
        'White-label',
        'Multi-tenant',
        'SSO/SAML',
        'Dédié SLA',
        'Support 24/7',
        'Onboarding personnalisé'
      ],
      isActive: true,
      isPopular: false,
      trialDays: 30,
      setupFee: 500,
    }
  ]);

  // Email Configuration
  const [emailConfig, setEmailConfig] = useState({
    provider: 'smtp',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpUsername: '',
    smtpPassword: '',
    smtpEncryption: 'tls',
    fromEmail: 'noreply@smartqueue.com',
    fromName: 'SmartQueue',
    replyToEmail: 'support@smartqueue.com',
    enableEmailVerification: true,
    enableWelcomeEmail: true,
    enablePasswordResetEmail: true,
    enableSubscriptionEmails: true,
    enableInvoiceEmails: true,
    enableNotificationEmails: true,
    emailTemplates: {
      welcome: {
        subject: 'Bienvenue sur SmartQueue !',
        body: 'Bonjour {{name}}, bienvenue sur notre plateforme...'
      },
      passwordReset: {
        subject: 'Réinitialisation de votre mot de passe',
        body: 'Bonjour {{name}}, cliquez sur ce lien pour réinitialiser votre mot de passe...'
      },
      subscriptionCreated: {
        subject: 'Confirmation d\'abonnement',
        body: 'Bonjour {{name}}, votre abonnement {{plan}} a été activé...'
      },
      subscriptionCancelled: {
        subject: 'Annulation d\'abonnement',
        body: 'Bonjour {{name}}, votre abonnement a été annulé...'
      },
      invoiceCreated: {
        subject: 'Nouvelle facture',
        body: 'Bonjour {{name}}, votre facture {{invoiceNumber}} est disponible...'
      }
    }
  });

  // SMS Configuration
  const [smsConfig, setSmsConfig] = useState({
    provider: 'twilio',
    twilioAccountSid: '',
    twilioAuthToken: '',
    twilioFromNumber: '',
    enableSmsNotifications: true,
    enableSmsVerification: true,
    enableQueueSms: true,
    enableAppointmentSms: true,
    enableEmergencySms: true,
    smsTemplates: {
      verification: {
        body: 'Votre code de vérification SmartQueue est: {{code}}'
      },
      queueUpdate: {
        body: 'Votre position dans la file: {{position}}. Temps d\'attente estimé: {{waitTime}}'
      },
      appointmentReminder: {
        body: 'Rappel: Votre rendez-vous est prévu le {{date}} à {{time}}'
      },
      emergencyAlert: {
        body: 'ALERTE: {{message}}'
      }
    }
  });

  // Payment Configuration
  const [paymentConfig, setPaymentConfig] = useState({
    stripePublicKey: '',
    stripeSecretKey: '',
    stripeWebhookSecret: '',
    enableStripe: true,
    enablePayPal: false,
    payPalClientId: '',
    payPalClientSecret: '',
    enableBankTransfer: true,
    bankTransferDetails: {
      bankName: 'BNP Paribas',
      accountName: 'SmartQueue SAS',
      iban: 'FR7630006000011234567890189',
      bic: 'BNPAFRPP',
    },
    enableCreditCard: true,
    enableDirectDebit: true,
    enableCrypto: false,
    cryptoWallets: [],
    invoicePrefix: 'SQ-',
    invoiceDueDays: 30,
    lateFeePercentage: 10,
    taxRate: 20,
    currency: 'EUR',
  });

  // Security Configuration
  const [securityConfig, setSecurityConfig] = useState({
    enableTwoFactorAuth: true,
    requireTwoFactorForAdmins: true,
    sessionTimeoutMinutes: 120,
    maxLoginAttempts: 5,
    lockoutDurationMinutes: 30,
    passwordMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumbers: true,
    passwordRequireSpecialChars: true,
    passwordHistoryCount: 5,
    enableIPWhitelist: false,
    ipWhitelist: [],
    enableRateLimiting: true,
    rateLimitRequestsPerMinute: 60,
    enableAuditLogging: true,
    logRetentionDays: 90,
    enableEncryption: true,
    encryptionAlgorithm: 'AES-256',
    enableBackupEncryption: true,
    enableDataMasking: false,
    enableGDPR: true,
    enableCCPA: true,
    enableSOC2: false,
    enableISO27001: false,
  });

  // Integration Configuration
  const [integrationConfig, setIntegrationConfig] = useState({
    enableSlack: false,
    slackWebhookUrl: '',
    enableDiscord: false,
    discordWebhookUrl: '',
    enableTeams: false,
    teamsWebhookUrl: '',
    enableGoogleCalendar: false,
    googleClientId: '',
    googleClientSecret: '',
    enableOutlookCalendar: false,
    outlookClientId: '',
    outlookClientSecret: '',
    enableZapier: false,
    zapierApiKey: '',
    enableMake: false,
    makeApiKey: '',
    enableWebhooks: true,
    webhookEndpoints: [],
    enableApi: true,
    apiRateLimit: 1000,
    apiVersion: 'v1',
    enableGraphQL: false,
    enableRestApi: true,
  });

  // Notification Configuration
  const [notificationConfig, setNotificationConfig] = useState({
    enablePushNotifications: true,
    enableEmailNotifications: true,
    enableSmsNotifications: true,
    enableInAppNotifications: true,
    enableBrowserNotifications: false,
    enableDesktopNotifications: false,
    notificationChannels: ['email', 'push', 'sms'],
    defaultNotificationSettings: {
      queueUpdates: true,
      appointmentReminders: true,
      systemAlerts: true,
      marketingEmails: false,
      productUpdates: true,
      securityAlerts: true,
      billingAlerts: true,
      subscriptionAlerts: true,
    },
    batchEmailNotifications: true,
    emailBatchSize: 100,
    emailBatchIntervalMinutes: 30,
    enableNotificationTemplates: true,
    notificationTemplates: {},
  });

  // Backup Configuration
  const [backupConfig, setBackupConfig] = useState({
    enableAutoBackup: true,
    backupFrequency: 'daily',
    backupRetentionDays: 30,
    backupLocation: 'cloud',
    cloudProvider: 'aws',
    awsAccessKey: '',
    awsSecretKey: '',
    awsBucket: '',
    awsRegion: 'eu-west-3',
    enableBackupEncryption: true,
    backupEncryptionKey: '',
    enableIncrementalBackup: true,
    enableCompression: true,
    compressionLevel: 6,
    enableVerification: true,
    enableNotifications: true,
    notificationEmail: 'admin@smartqueue.com',
    backupExclusions: [
      'logs/*',
      'temp/*',
      'cache/*',
      'sessions/*'
    ],
  });

  // Aucun endpoint serveur ne persiste encore cette configuration : l'ancienne version
  // simulait un appel (setTimeout) et laissait croire à un enregistrement.
  const handleSave = async (section: string, _config: any) => {
    toast.info(`Configuration « ${section} » non enregistrée : cette section n'est pas encore reliée au serveur.`);
  };

  const handleLogout = () => {
    dispatch(logout());
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Veuillez vous connecter pour accéder aux paramètres.</p>
      </div>
    );
  }

  const isSuperAdmin = user?.role === 'super_admin';

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Accès Restreint</h1>
          <p className="text-muted-foreground">Cette page est réservée aux super administrateurs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Paramètres Super Admin</h1>
            <p className="text-muted-foreground">Configuration globale de la plateforme SaaS</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-2">
              <Crown className="h-4 w-4" />
              Super Admin
            </Badge>
            <Button variant="outline" onClick={handleLogout}>
              <Shield className="h-4 w-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="general">Général</TabsTrigger>
            <TabsTrigger value="plans">Plans</TabsTrigger>
            <TabsTrigger value="payments">Paiements</TabsTrigger>
            <TabsTrigger value="security">Sécurité</TabsTrigger>
            <TabsTrigger value="integrations">Intégrations</TabsTrigger>
            <TabsTrigger value="backup">Sauvegarde</TabsTrigger>
          </TabsList>

          {/* General Configuration */}
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Configuration Générale
                </CardTitle>
                <CardDescription>
                  Paramètres généraux de la plateforme SaaS
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="platformName">Nom de la plateforme</Label>
                      <Input
                        id="platformName"
                        value={saasConfig.platformName}
                        onChange={(e) => setSaasConfig({...saasConfig, platformName: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="platformDescription">Description</Label>
                      <Textarea
                        id="platformDescription"
                        value={saasConfig.platformDescription}
                        onChange={(e) => setSaasConfig({...saasConfig, platformDescription: e.target.value})}
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label htmlFor="companyEmail">Email de l'entreprise</Label>
                      <Input
                        id="companyEmail"
                        type="email"
                        value={saasConfig.companyEmail}
                        onChange={(e) => setSaasConfig({...saasConfig, companyEmail: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="companyPhone">Téléphone</Label>
                      <Input
                        id="companyPhone"
                        value={saasConfig.companyPhone}
                        onChange={(e) => setSaasConfig({...saasConfig, companyPhone: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="companyAddress">Adresse</Label>
                      <Textarea
                        id="companyAddress"
                        value={saasConfig.companyAddress}
                        onChange={(e) => setSaasConfig({...saasConfig, companyAddress: e.target.value})}
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label htmlFor="defaultLanguage">Langue par défaut</Label>
                      <select
                        id="defaultLanguage"
                        className="w-full bg-background p-2 border-border rounded-md"
                        value={saasConfig.defaultLanguage}
                        onChange={(e) => setSaasConfig({...saasConfig, defaultLanguage: e.target.value})}
                      >
                        <option value="fr">Français</option>
                        <option value="en">English</option>
                        <option value="es">Español</option>
                        <option value="de">Deutsch</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="defaultCurrency">Devise par défaut</Label>
                      <select
                        id="defaultCurrency"
                        className="w-full bg-background p-2 border-border  rounded-md"
                        value={saasConfig.defaultCurrency}
                        onChange={(e) => setSaasConfig({...saasConfig, defaultCurrency: e.target.value})}
                      >
                        <option value="EUR">EUR (€)</option>
                        <option value="USD">USD ($)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="CHF">CHF (Fr)</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="defaultTimezone">Fuseau horaire</Label>
                      <select
                        id="defaultTimezone"
                        className="w-full p-2 bg-background border-border  rounded-md"
                        value={saasConfig.defaultTimezone}
                        onChange={(e) => setSaasConfig({...saasConfig, defaultTimezone: e.target.value})}
                      >
                        <option value="Europe/Paris">Europe/Paris</option>
                        <option value="Europe/London">Europe/London</option>
                        <option value="America/New_York">America/New_York</option>
                        <option value="America/Los_Angeles">America/Los_Angeles</option>
                        <option value="Asia/Tokyo">Asia/Tokyo</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Paramètres SaaS</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Mode maintenance</p>
                        <p className="text-sm text-muted-foreground">Désactiver l'accès utilisateur</p>
                      </div>
                      <Switch
                        checked={saasConfig.maintenanceMode}
                        onCheckedChange={(checked) => setSaasConfig({...saasConfig, maintenanceMode: checked})}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Nouvelles inscriptions</p>
                        <p className="text-sm text-muted-foreground">Autoriser les nouveaux comptes</p>
                      </div>
                      <Switch
                        checked={saasConfig.allowNewRegistrations}
                        onCheckedChange={(checked) => setSaasConfig({...saasConfig, allowNewRegistrations: checked})}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Vérification email</p>
                        <p className="text-sm text-muted-foreground">Obligatoire pour l'inscription</p>
                      </div>
                      <Switch
                        checked={saasConfig.requireEmailVerification}
                        onCheckedChange={(checked) => setSaasConfig({...saasConfig, requireEmailVerification: checked})}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Période d'essai</p>
                        <p className="text-sm text-muted-foreground">Autoriser les essais gratuits</p>
                      </div>
                      <Switch
                        checked={saasConfig.allowTrialPeriods}
                        onCheckedChange={(checked) => setSaasConfig({...saasConfig, allowTrialPeriods: checked})}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Auto-renouvellement</p>
                        <p className="text-sm text-muted-foreground">Abonnements auto-renouvelés</p>
                      </div>
                      <Switch
                        checked={saasConfig.autoRenewSubscriptions}
                        onCheckedChange={(checked) => setSaasConfig({...saasConfig, autoRenewSubscriptions: checked})}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Branding personnalisé</p>
                        <p className="text-sm text-muted-foreground">Autoriser le branding</p>
                      </div>
                      <Switch
                        checked={saasConfig.allowCustomBranding}
                        onCheckedChange={(checked) => setSaasConfig({...saasConfig, allowCustomBranding: checked})}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => handleSave('general', saasConfig)} disabled={saving}>
                    {saving ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Enregistrer
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Plans Configuration */}
          <TabsContent value="plans" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Configuration des Plans d'Abonnement
                </CardTitle>
                <CardDescription>
                  Gérez les plans d'abonnement et leurs fonctionnalités
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {plans.map((plan) => (
                    <Card key={plan.id} className={`relative ${plan.isPopular ? 'border-primary' : ''}`}>
                      {plan.isPopular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <Badge className="bg-primary text-primary-foreground">
                            <Star className="h-3 w-3 mr-1" />
                            Populaire
                          </Badge>
                        </div>
                      )}
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{plan.name}</CardTitle>
                          <Switch
                            checked={plan.isActive}
                            onCheckedChange={(checked) => {
                              setPlans(plans.map(p => 
                                p.id === plan.id ? {...p, isActive: checked} : p
                              ));
                            }}
                          />
                        </div>
                        <CardDescription>{plan.description}</CardDescription>
                        <div className="text-3xl font-bold">
                          {plan.price}€
                          <span className="text-sm font-normal text-muted-foreground">/mois</span>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm">Établissements</span>
                            <span className="text-sm font-medium">
                              {plan.maxEstablishments === -1 ? 'Illimité' : plan.maxEstablishments}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Agents</span>
                            <span className="text-sm font-medium">
                              {plan.maxAgents === -1 ? 'Illimité' : plan.maxAgents}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Services</span>
                            <span className="text-sm font-medium">
                              {plan.maxServices === -1 ? 'Illimité' : plan.maxServices}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Tickets/jour</span>
                            <span className="text-sm font-medium">
                              {plan.maxTicketsPerDay === -1 ? 'Illimité' : plan.maxTicketsPerDay}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Stockage</span>
                            <span className="text-sm font-medium">
                              {plan.maxStorageGB === -1 ? 'Illimité' : `${plan.maxStorageGB}GB`}
                            </span>
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Fonctionnalités</Label>
                          <ul className="mt-2 space-y-1">
                            {plan.features.map((feature, index) => (
                              <li key={index} className="text-sm flex items-center gap-2">
                                <CheckCircle className="h-3 w-3 text-green-500" />
                                {feature}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            placeholder="Prix"
                            value={plan.price}
                            onChange={(e) => {
                              setPlans(plans.map(p => 
                                p.id === plan.id ? {...p, price: parseFloat(e.target.value) || 0} : p
                              ));
                            }}
                          />
                          <Input
                            type="number"
                            placeholder="Jours d'essai"
                            value={plan.trialDays}
                            onChange={(e) => {
                              setPlans(plans.map(p => 
                                p.id === plan.id ? {...p, trialDays: parseInt(e.target.value) || 0} : p
                              ));
                            }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="flex justify-end mt-6">
                  <Button onClick={() => handleSave('plans', plans)} disabled={saving}>
                    {saving ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Enregistrer les plans
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Configuration */}
          <TabsContent value="payments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Configuration des Paiements
                </CardTitle>
                <CardDescription>
                  Configurez les passerelles de paiement et la facturation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Stripe</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Activer Stripe</p>
                        <p className="text-sm text-muted-foreground">Accepter les cartes de crédit</p>
                      </div>
                      <Switch
                        checked={paymentConfig.enableStripe}
                        onCheckedChange={(checked) => setPaymentConfig({...paymentConfig, enableStripe: checked})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="stripePublicKey">Clé publique</Label>
                      <Input
                        id="stripePublicKey"
                        type="password"
                        value={paymentConfig.stripePublicKey}
                        onChange={(e) => setPaymentConfig({...paymentConfig, stripePublicKey: e.target.value})}
                        placeholder="pk_test_..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="stripeSecretKey">Clé secrète</Label>
                      <Input
                        id="stripeSecretKey"
                        type="password"
                        value={paymentConfig.stripeSecretKey}
                        onChange={(e) => setPaymentConfig({...paymentConfig, stripeSecretKey: e.target.value})}
                        placeholder="sk_test_..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="stripeWebhookSecret">Secret webhook</Label>
                      <Input
                        id="stripeWebhookSecret"
                        type="password"
                        value={paymentConfig.stripeWebhookSecret}
                        onChange={(e) => setPaymentConfig({...paymentConfig, stripeWebhookSecret: e.target.value})}
                        placeholder="whsec_..."
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Paramètres de facturation</h3>
                    <div>
                      <Label htmlFor="invoicePrefix">Préfixe des factures</Label>
                      <Input
                        id="invoicePrefix"
                        value={paymentConfig.invoicePrefix}
                        onChange={(e) => setPaymentConfig({...paymentConfig, invoicePrefix: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="invoiceDueDays">Délai de paiement (jours)</Label>
                      <Input
                        id="invoiceDueDays"
                        type="number"
                        value={paymentConfig.invoiceDueDays}
                        onChange={(e) => setPaymentConfig({...paymentConfig, invoiceDueDays: parseInt(e.target.value) || 0})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="lateFeePercentage">Frais de retard (%)</Label>
                      <Input
                        id="lateFeePercentage"
                        type="number"
                        value={paymentConfig.lateFeePercentage}
                        onChange={(e) => setPaymentConfig({...paymentConfig, lateFeePercentage: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="taxRate">Taux de TVA (%)</Label>
                      <Input
                        id="taxRate"
                        type="number"
                        value={paymentConfig.taxRate}
                        onChange={(e) => setPaymentConfig({...paymentConfig, taxRate: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => handleSave('payments', paymentConfig)} disabled={saving}>
                    {saving ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Enregistrer
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Configuration */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Configuration de Sécurité
                </CardTitle>
                <CardDescription>
                  Paramètres de sécurité et de conformité
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Authentification</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Authentification 2FA</p>
                        <p className="text-sm text-muted-foreground">Double facteur d'authentification</p>
                      </div>
                      <Switch
                        checked={securityConfig.enableTwoFactorAuth}
                        onCheckedChange={(checked) => setSecurityConfig({...securityConfig, enableTwoFactorAuth: checked})}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">2FA obligatoire pour admins</p>
                        <p className="text-sm text-muted-foreground">Exiger 2FA pour les admins</p>
                      </div>
                      <Switch
                        checked={securityConfig.requireTwoFactorForAdmins}
                        onCheckedChange={(checked) => setSecurityConfig({...securityConfig, requireTwoFactorForAdmins: checked})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="sessionTimeout">Délai d'expiration (minutes)</Label>
                      <Input
                        id="sessionTimeout"
                        type="number"
                        value={securityConfig.sessionTimeoutMinutes}
                        onChange={(e) => setSecurityConfig({...securityConfig, sessionTimeoutMinutes: parseInt(e.target.value) || 0})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="maxLoginAttempts">Tentatives de connexion max</Label>
                      <Input
                        id="maxLoginAttempts"
                        type="number"
                        value={securityConfig.maxLoginAttempts}
                        onChange={(e) => setSecurityConfig({...securityConfig, maxLoginAttempts: parseInt(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Mot de passe</h3>
                    <div>
                      <Label htmlFor="passwordMinLength">Longueur minimale</Label>
                      <Input
                        id="passwordMinLength"
                        type="number"
                        value={securityConfig.passwordMinLength}
                        onChange={(e) => setSecurityConfig({...securityConfig, passwordMinLength: parseInt(e.target.value) || 0})}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Exiger majuscules</p>
                        <p className="text-sm text-muted-foreground">Au moins une majuscule</p>
                      </div>
                      <Switch
                        checked={securityConfig.passwordRequireUppercase}
                        onCheckedChange={(checked) => setSecurityConfig({...securityConfig, passwordRequireUppercase: checked})}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Exiger chiffres</p>
                        <p className="text-sm text-muted-foreground">Au moins un chiffre</p>
                      </div>
                      <Switch
                        checked={securityConfig.passwordRequireNumbers}
                        onCheckedChange={(checked) => setSecurityConfig({...securityConfig, passwordRequireNumbers: checked})}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Exiger caractères spéciaux</p>
                        <p className="text-sm text-muted-foreground">Au moins un caractère spécial</p>
                      </div>
                      <Switch
                        checked={securityConfig.passwordRequireSpecialChars}
                        onCheckedChange={(checked) => setSecurityConfig({...securityConfig, passwordRequireSpecialChars: checked})}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => handleSave('security', securityConfig)} disabled={saving}>
                    {saving ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Enregistrer
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Integrations Configuration */}
          <TabsContent value="integrations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Configuration des Intégrations
                </CardTitle>
                <CardDescription>
                  Configurez les intégrations avec des services tiers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Communication</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Slack</p>
                        <p className="text-sm text-muted-foreground">Notifications Slack</p>
                      </div>
                      <Switch
                        checked={integrationConfig.enableSlack}
                        onCheckedChange={(checked) => setIntegrationConfig({...integrationConfig, enableSlack: checked})}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Discord</p>
                        <p className="text-sm text-muted-foreground">Notifications Discord</p>
                      </div>
                      <Switch
                        checked={integrationConfig.enableDiscord}
                        onCheckedChange={(checked) => setIntegrationConfig({...integrationConfig, enableDiscord: checked})}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Microsoft Teams</p>
                        <p className="text-sm text-muted-foreground">Notifications Teams</p>
                      </div>
                      <Switch
                        checked={integrationConfig.enableTeams}
                        onCheckedChange={(checked) => setIntegrationConfig({...integrationConfig, enableTeams: checked})}
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Calendriers</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Google Calendar</p>
                        <p className="text-sm text-muted-foreground">Synchronisation Google</p>
                      </div>
                      <Switch
                        checked={integrationConfig.enableGoogleCalendar}
                        onCheckedChange={(checked) => setIntegrationConfig({...integrationConfig, enableGoogleCalendar: checked})}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Outlook Calendar</p>
                        <p className="text-sm text-muted-foreground">Synchronisation Outlook</p>
                      </div>
                      <Switch
                        checked={integrationConfig.enableOutlookCalendar}
                        onCheckedChange={(checked) => setIntegrationConfig({...integrationConfig, enableOutlookCalendar: checked})}
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Automatisation</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Zapier</p>
                        <p className="text-sm text-muted-foreground">Intégration Zapier</p>
                      </div>
                      <Switch
                        checked={integrationConfig.enableZapier}
                        onCheckedChange={(checked) => setIntegrationConfig({...integrationConfig, enableZapier: checked})}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Make (Integromat)</p>
                        <p className="text-sm text-muted-foreground">Intégration Make</p>
                      </div>
                      <Switch
                        checked={integrationConfig.enableMake}
                        onCheckedChange={(checked) => setIntegrationConfig({...integrationConfig, enableMake: checked})}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">API REST</p>
                        <p className="text-sm text-muted-foreground">Accès API complet</p>
                      </div>
                      <Switch
                        checked={integrationConfig.enableRestApi}
                        onCheckedChange={(checked) => setIntegrationConfig({...integrationConfig, enableRestApi: checked})}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => handleSave('integrations', integrationConfig)} disabled={saving}>
                    {saving ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Enregistrer
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Backup Configuration */}
          <TabsContent value="backup" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Configuration de Sauvegarde
                </CardTitle>
                <CardDescription>
                  Configurez les sauvegardes automatiques et la rétention des données
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Sauvegarde automatique</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Activer les sauvegardes</p>
                        <p className="text-sm text-muted-foreground">Sauvegardes automatiques</p>
                      </div>
                      <Switch
                        checked={backupConfig.enableAutoBackup}
                        onCheckedChange={(checked) => setBackupConfig({...backupConfig, enableAutoBackup: checked})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="backupFrequency">Fréquence</Label>
                      <select
                        id="backupFrequency"
                        className="w-full p-2 bg-background border-border rounded-md"
                        value={backupConfig.backupFrequency}
                        onChange={(e) => setBackupConfig({...backupConfig, backupFrequency: e.target.value})}
                      >
                        <option value="hourly">Toutes les heures</option>
                        <option value="daily">Quotidienne</option>
                        <option value="weekly">Hebdomadaire</option>
                        <option value="monthly">Mensuelle</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="backupRetentionDays">Rention (jours)</Label>
                      <Input
                        id="backupRetentionDays"
                        type="number"
                        value={backupConfig.backupRetentionDays}
                        onChange={(e) => setBackupConfig({...backupConfig, backupRetentionDays: parseInt(e.target.value) || 0})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="backupLocation">Emplacement</Label>
                      <select
                        id="backupLocation"
                        className="w-full p-2 bg-background border-border rounded-md"
                        value={backupConfig.backupLocation}
                        onChange={(e) => setBackupConfig({...backupConfig, backupLocation: e.target.value})}
                      >
                        <option value="local">Local</option>
                        <option value="cloud">Cloud</option>
                        <option value="both">Les deux</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Configuration Cloud</h3>
                    <div>
                      <Label htmlFor="cloudProvider">Fournisseur</Label>
                      <select
                        id="cloudProvider"
                        className="w-full p-2 bg-background border-border rounded-md"
                        value={backupConfig.cloudProvider}
                        onChange={(e) => setBackupConfig({...backupConfig, cloudProvider: e.target.value})}
                      >
                        <option value="aws">AWS S3</option>
                        <option value="gcp">Google Cloud</option>
                        <option value="azure">Azure</option>
                        <option value="digitalocean">DigitalOcean</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="awsAccessKey">Clé d'accès</Label>
                      <Input
                        id="awsAccessKey"
                        type="password"
                        value={backupConfig.awsAccessKey}
                        onChange={(e) => setBackupConfig({...backupConfig, awsAccessKey: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="awsSecretKey">Clé secrète</Label>
                      <Input
                        id="awsSecretKey"
                        type="password"
                        value={backupConfig.awsSecretKey}
                        onChange={(e) => setBackupConfig({...backupConfig, awsSecretKey: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="awsBucket">Bucket</Label>
                      <Input
                        id="awsBucket"
                        value={backupConfig.awsBucket}
                        onChange={(e) => setBackupConfig({...backupConfig, awsBucket: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => handleSave('backup', backupConfig)} disabled={saving}>
                    {saving ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Enregistrer
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
