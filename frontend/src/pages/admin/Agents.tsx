import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search, Filter, User, Mail, Phone, Lock, Check, Loader2, Users, UserCheck, Activity, Download, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AnalyticsCard } from '@/components/ui/analytics-card';
import { DonutChart } from '@/components/ui/charts';

import { api } from '@/api/axios';

interface Service {
  id: number;
  name: string;
  description?: string;
  color?: string;
}

interface Agent {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  status: 'active' | 'inactive' | 'pending';
  /** Dernière connexion (login) */
  last_login_at?: string | null;
  /** Dernier appel API authentifié (activité réelle) */
  last_seen_at?: string | null;
  /** Tickets clôturés par l'agent sur 30 jours */
  tickets_closed_30d?: number;
  created_at: string;
  services?: { id: number; name: string }[];
  avatar?: string | null;
}

// Champ vide = pas de mot de passe saisi (création : mot de passe temporaire généré par le serveur)
const optionalPassword = z
  .union([z.literal(''), z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères')])
  .optional();

const agentSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  email: z.string().email('Adresse email invalide'),
  phone: z.string().optional(),
  status: z.enum(['active', 'inactive', 'pending']),
  password: optionalPassword,
  service_ids: z.array(z.number()).optional(),
});

/** Date API ("Y-m-d H:i:s" ou ISO) → timestamp, NaN si absente. */
const toTime = (value?: string | null) => (value ? new Date(String(value).replace(' ', 'T')).getTime() : NaN);

type AgentFormData = z.infer<typeof agentSchema>;

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState({
    agents: true,
    services: true,
    submitting: false,
    exporting: false,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);

  const [createdAgentCredentials, setCreatedAgentCredentials] = useState<{
    email: string;
    temporary_password: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AgentFormData>({
    resolver: zodResolver(agentSchema),
    defaultValues: {
      status: 'active',
      service_ids: [],
    },
  });

  const selectedServices = watch('service_ids') || [];

  const fetchAgents = async () => {
    try {
      setLoading(prev => ({ ...prev, agents: true }));
      const { data } = await api.get('/api/admin/agents');
      const list = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.data)
        ? (data as any).data
        : Array.isArray((data as any)?.agents)
        ? (data as any).agents
        : Array.isArray((data as any)?.results)
        ? (data as any).results
        : Array.isArray((data as any)?.items)
        ? (data as any).items
        : [];
      setAgents(list);
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401 || status === 403) {
        toast.error("Accès refusé. Connectez-vous avec un compte administrateur pour voir les agents.")
      } else {
        toast.error('Impossible de charger la liste des agents');
      }
      console.error('Erreur lors de la récupération des agents:', error);
    } finally {
      setLoading(prev => ({ ...prev, agents: false }));
    }
  };

  const copyCredentials = async () => {
    if (!createdAgentCredentials) return;
    const text = `Email: ${createdAgentCredentials.email}\nMot de passe temporaire: ${createdAgentCredentials.temporary_password}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Identifiants copiés');
    } catch {
      toast.error('Impossible de copier (clipboard)');
    }
  };

  const fetchServices = async () => {
    try {
      setLoading(prev => ({ ...prev, services: true }));
      const { data } = await api.get('/api/admin/services');
      const list = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.data)
        ? (data as any).data
        : Array.isArray((data as any)?.services)
        ? (data as any).services
        : Array.isArray((data as any)?.results)
        ? (data as any).results
        : Array.isArray((data as any)?.items)
        ? (data as any).items
        : [];
      setServices(list);
    } catch (error: any) {
      console.error('Erreur lors de la récupération des services:', error);
    } finally {
      setLoading(prev => ({ ...prev, services: false }));
    }
  };

  useEffect(() => {
    fetchAgents();
    fetchServices();
  }, []);

  const filteredAgents = useMemo(() => {
    const list = Array.isArray(agents) ? agents : [];
    return list.filter(agent => {
      const matchesSearch = 
        agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (agent.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
      
      const matchesStatus = statusFilter === 'all' || agent.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [agents, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAgents.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedAgents = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredAgents.slice(start, start + pageSize);
  }, [filteredAgents, safePage]);

  const toggleService = (serviceId: number) => {
    const newServices = selectedServices.includes(serviceId)
      ? selectedServices.filter(id => id !== serviceId)
      : [...selectedServices, serviceId];
    
    setValue('service_ids', newServices);
  };

  const openCreateModal = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  const openEditModal = (agent: Agent) => {
    setCurrentAgent(agent);
    reset({
      name: agent.name,
      email: agent.email,
      phone: agent.phone || '',
      status: agent.status as any,
      password: '',
      service_ids: agent.services?.map(s => s.id) || [],
    });
    setIsEditModalOpen(true);
  };

  const onSubmit = async (data: AgentFormData) => {
    setLoading(prev => ({ ...prev, submitting: true }));
    
    try {
      const payload: any = { ...data };
      if (!data.password) {
        // Modification : mot de passe inchangé ; création : généré par le serveur
        delete payload.password;
      }
      if (currentAgent) {
        await api.put(`/api/admin/agents/${currentAgent.id}`, payload);
        toast.success('Agent mis à jour avec succès');
      } else {
        const resp = await api.post('/api/admin/agents', payload);
        if (resp?.data?.temporary_password) {
          setCreatedAgentCredentials({
            email: String(resp.data.email || data.email),
            temporary_password: String(resp.data.temporary_password),
          });
        }
        toast.success('Agent créé avec succès');
      }
      
      await fetchAgents();
      
      setIsCreateModalOpen(false);
      setIsEditModalOpen(false);
      setCurrentAgent(null);
      resetForm();
      
    } catch (error: any) {
      console.error('Erreur lors de la soumission du formulaire:', error);
      const errorMessage = error.response?.data?.message || 'Une erreur est survenue';
      toast.error(`Erreur: ${errorMessage}`);
    } finally {
      setLoading(prev => ({ ...prev, submitting: false }));
    }
  };

  const handleDeleteAgent = async (agentId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet agent ? Cette action est irréversible.')) {
      return;
    }
    
    try {
      await api.delete(`/api/admin/agents/${agentId}`);
      toast.success('Agent supprimé avec succès');
      setIsEditModalOpen(false);
      setCurrentAgent(null);
      await fetchAgents();
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'agent:', error);
      toast.error('Impossible de supprimer l\'agent');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-200 ring-1 ring-inset ring-green-200 dark:ring-green-800/30">Actif</span>;
      case 'inactive':
        return <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200 ring-1 ring-inset ring-red-200 dark:ring-red-800/30">Inactif</span>;
      case 'pending':
        return <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-200 ring-1 ring-inset ring-yellow-200 dark:ring-yellow-800/30">En attente</span>;
      default:
        return <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-200 ring-1 ring-inset ring-gray-200 dark:ring-gray-800/30">Inconnu</span>;
    }
  };

  const getActivityDot = (agent: Agent) => {
    const lastActivity = Math.max(toTime(agent.last_seen_at) || 0, toTime(agent.last_login_at) || 0);
    if (!lastActivity) return <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" title="Jamais connecté" />;
    const hoursDiff = (Date.now() - lastActivity) / (1000 * 60 * 60);
    if (hoursDiff <= 24) return <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" title="Actif récemment" />;
    if (hoursDiff <= 168) return <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" title="Actif cette semaine" />;
    return <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" title="Inactif depuis longtemps" />;
  };

  // Actif = au moins un appel API dans les 15 dernières minutes
  const isOnline = (agent: Agent) => {
    const seen = toTime(agent.last_seen_at);
    return Number.isFinite(seen) && Date.now() - seen < 15 * 60 * 1000;
  };

  const countByStatus = (status: string) => filteredAgents.filter(a => a.status === status).length;
  const actifCount = countByStatus('active');
  const enLigneCount = filteredAgents.filter(isOnline).length;
  const closedCount = filteredAgents.reduce((sum, a) => sum + Number(a.tickets_closed_30d ?? 0), 0);

  const statusChartData = [
    { name: 'Actifs', value: countByStatus('active'), color: '#22c55e' },
    { name: 'Inactifs', value: countByStatus('inactive'), color: '#ef4444' },
    { name: 'En attente', value: countByStatus('pending'), color: '#f59e0b' },
  ];

  const resetForm = () => {
    reset({
      name: '',
      email: '',
      phone: '',
      status: 'active',
      password: '',
      service_ids: []
    });
    setCurrentAgent(null);
  };

  const exportCSV = () => {
    setLoading(prev => ({ ...prev, exporting: true }));
    toast.success('Préparation de l\'export...');

    try {
      const headers = ['Nom', 'Email', 'Téléphone', 'Statut', 'Services', 'Tickets clôturés (30 j)', 'Dernière connexion'];
      const rows = filteredAgents.map(agent => [
        agent.name,
        agent.email,
        agent.phone || '',
        agent.status,
        (agent.services || []).map(s => s.name).join('; '),
        String(agent.tickets_closed_30d ?? 0),
        agent.last_login_at || '',
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `agents_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Export terminé');
    } catch (error) {
      toast.error('Erreur lors de l\'export');
      console.error(error);
    } finally {
      setLoading(prev => ({ ...prev, exporting: false }));
    }
  };

  if (loading.agents || loading.services) {
    return (
      <TooltipProvider>
        <div className="w-full mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Gestion des agents</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Gérez les comptes des agents et leurs accès aux services
              </p>
            </div>
          </div>
          <Card className="mb-6 shadow-lg">
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Rechercher un agent..." disabled className="pl-10" />
                </div>
                <Select disabled>
                  <SelectTrigger>
                    <Filter className="mr-2 h-4 w-4" />
                    <span className="mr-2">Statut:</span>
                    <SelectValue placeholder="Tous les statuts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                  </SelectContent>
                </Select>
                <div />
                <div className="flex items-center justify-end" />
              </div>
            </div>
          </Card>
          <Card className="shadow-lg">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"><span className="sr-only">Photo</span></TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Services</TableHead>
                    <TableHead>Dernière connexion</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}>
                          <div className="h-4 bg-muted rounded animate-pulse" style={{ width: j === 0 ? 32 : j === 1 ? 160 : j === 6 ? 80 : 100 }} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="w-full mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestion des agents</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gérez les comptes des agents et leurs accès aux services
            </p>
          </div>
          <Button 
            onClick={openCreateModal}
            className="mt-4 md:mt-0"
          >
            <Plus className="mr-2 h-4 w-4" />
            Ajouter un agent
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AnalyticsCard
              title="Total agents"
              value={filteredAgents.length}
              icon={Users}
              description="Agents affichés"
            />
            <AnalyticsCard
              title="Actifs"
              value={actifCount}
              icon={UserCheck}
              description={`${filteredAgents.length > 0 ? Math.round(actifCount / filteredAgents.length * 100) : 0}% des agents affichés`}
            />
            <AnalyticsCard
              title="En ligne"
              value={enLigneCount}
              icon={Activity}
              description="Activité dans les 15 dernières minutes"
            />
            <AnalyticsCard
              title="Tickets clôturés"
              value={closedCount}
              icon={CheckCircle}
              description="Par les agents affichés, sur 30 jours"
            />
          </div>
          <Card className="shadow-lg">
            <div className="p-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Répartition par statut</h3>
              <DonutChart data={statusChartData} height={160} innerRadius={45} outerRadius={65} />
              <div className="flex items-center justify-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#22c55e' }} />
                  <span className="text-xs text-muted-foreground">Actifs</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#ef4444' }} />
                  <span className="text-xs text-muted-foreground">Inactifs</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
                  <span className="text-xs text-muted-foreground">En attente</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Card className="mb-6 shadow-lg">
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un agent..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <Filter className="mr-2 h-4 w-4" />
                  <span className="mr-2">Statut:</span>
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="inactive">Inactif</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="hidden md:block" />

              <div className="flex items-center justify-end">
                <Button variant="outline" size="sm" onClick={exportCSV} disabled={loading.exporting || filteredAgents.length === 0}>
                  {loading.exporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  <span>Exporter</span>
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Card className='shadow-lg w-full'>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <span className="sr-only">Photo</span>
                  </TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Dernière connexion</TableHead>
                  <TableHead>Tickets clôturés (30 j)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedAgents.length > 0 ? (
                  paginatedAgents.map((agent) => (
                    <TableRow key={agent.id} className="hover-card">
                      <TableCell>
                        <Avatar className="h-8 w-8">
                          {agent.avatar ? (
                            <AvatarImage src={agent.avatar} alt={agent.name} />
                          ) : (
                            <AvatarFallback>
                              {agent.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')}
                            </AvatarFallback>
                          )}
                        </Avatar>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{agent.name}</div>
                        <div className="text-sm text-muted-foreground">{agent.email}</div>
                        {agent.phone && (
                          <div className="text-sm text-muted-foreground flex items-center">
                            <Phone className="mr-1 h-3 w-3" />
                            {agent.phone}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(agent.status)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {agent.services?.slice(0, 3).map((service) => (
                            <Badge key={service.id} variant="outline" className="text-xs">
                              {service.name}
                            </Badge>
                          ))}
                          {agent.services && agent.services.length > 3 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="text-xs">
                                  +{agent.services.length - 3}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1">
                                  {agent.services.slice(3).map((service) => (
                                    <div key={service.id}>{service.name}</div>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>{getActivityDot(agent)}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {Number.isFinite(toTime(agent.last_seen_at))
                                ? `Dernière activité : ${format(toTime(agent.last_seen_at), 'PPpp', { locale: fr })}`
                                : 'Aucune activité enregistrée'}
                            </TooltipContent>
                          </Tooltip>
                          {Number.isFinite(toTime(agent.last_login_at)) ? (
                            <div className="text-sm text-muted-foreground">
                              {format(toTime(agent.last_login_at), 'PPpp', { locale: fr })}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Jamais connecté</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">{agent.tickets_closed_30d ?? 0}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditModal(agent)}
                              >
                                <Pencil className="h-4 w-4" />
                                <span className="sr-only">Modifier</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Modifier l'agent</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-600 hover:text-red-700 hover-accent"
                                onClick={() => handleDeleteAgent(agent.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Supprimer</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Supprimer l'agent</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      Aucun agent trouvé
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <div className="text-sm text-muted-foreground">
              Affichage de <span className="font-medium">{filteredAgents.length === 0 ? 0 : (safePage - 1) * pageSize + 1}</span> à{' '}
              <span className="font-medium">{Math.min(safePage * pageSize, filteredAgents.length)}</span> sur{' '}
              <span className="font-medium">{filteredAgents.length}</span> agents
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                Précédent
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                Page {safePage} sur {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              >
                Suivant
              </Button>
            </div>
          </div>
        </Card>

        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent className="sm:max-w-[600px] shadow-lg">
            <form onSubmit={handleSubmit(onSubmit)}>
              <DialogHeader>
                <DialogTitle>Ajouter un nouvel agent</DialogTitle>
                <DialogDescription>
                  Remplissez les informations pour créer un nouveau compte agent.
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom complet</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      placeholder="Jean Dupont"
                      className="pl-10"
                      {...register('name')}
                    />
                  </div>
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Adresse email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="jean.dupont@exemple.com"
                      className="pl-10"
                      {...register('email')}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone (optionnel)</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+229 01 00 00 00 00"
                      className="pl-10"
                      {...register('phone')}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Statut</Label>
                    <Select
                      value={watch('status')}
                      onValueChange={(value) => setValue('status', value as any)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un statut" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Actif</SelectItem>
                        <SelectItem value="inactive">Inactif</SelectItem>
                        <SelectItem value="pending">En attente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Services associés</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border rounded">
                    {services.map((service) => (
                      <div key={service.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`service-${service.id}`}
                          checked={selectedServices.includes(service.id)}
                          onCheckedChange={() => toggleService(service.id)}
                        />
                        <Label
                          htmlFor={`service-${service.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {service.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe (optionnel)</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10"
                      {...register('password')}
                    />
                  </div>
                  {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                  <p className="text-xs text-muted-foreground">
                    Laissez vide pour générer un mot de passe temporaire, affiché une seule fois après la création.
                  </p>
                </div>
              </div>
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={loading.submitting}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={loading.submitting}>
                  {loading.submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Création...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Créer l'agent
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Modifier un agent</DialogTitle>
              <DialogDescription>
                Modifiez les informations de l'agent et ses services associés.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Nom complet</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="edit-name"
                      placeholder="Jean Dupont"
                      className="pl-10"
                      {...register('name')}
                    />
                  </div>
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Adresse email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="edit-email"
                      type="email"
                      placeholder="jean.dupont@exemple.com"
                      className="pl-10"
                      {...register('email')}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Téléphone (optionnel)</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="edit-phone"
                      type="tel"
                      placeholder="+229 01 00 00 00 00"
                      className="pl-10"
                      {...register('phone')}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-status">Statut</Label>
                    <Select
                      value={watch('status')}
                      onValueChange={(value) => setValue('status', value as any)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un statut" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Actif</SelectItem>
                        <SelectItem value="inactive">Inactif</SelectItem>
                        <SelectItem value="pending">En attente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Services associés</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border rounded">
                    {services.map((service) => (
                      <div key={service.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-service-${service.id}`}
                          checked={selectedServices.includes(service.id)}
                          onCheckedChange={() => toggleService(service.id)}
                        />
                        <Label
                          htmlFor={`edit-service-${service.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {service.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-password">Nouveau mot de passe (optionnel)</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="edit-password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10"
                      {...register('password')}
                    />
                  </div>
                  {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                  <p className="text-xs text-muted-foreground">
                    Laissez vide pour ne pas modifier le mot de passe. Un compte passé « Inactif » est déconnecté immédiatement.
                  </p>
                </div>

              </div>

              <DialogFooter>
                <div className="flex justify-between w-full">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      if (currentAgent) {
                        handleDeleteAgent(currentAgent.id);
                      }
                    }}
                    disabled={loading.submitting}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Supprimer
                  </Button>
                  <div className="space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditModalOpen(false)}
                      disabled={loading.submitting}
                    >
                      Annuler
                    </Button>
                    <Button type="submit" disabled={loading.submitting}>
                      {loading.submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Enregistrement...
                        </>
                      ) : (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Enregistrer
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!createdAgentCredentials}
          onOpenChange={(open) => {
            if (!open) setCreatedAgentCredentials(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Identifiants de l'agent</DialogTitle>
              <DialogDescription>
                Ce mot de passe temporaire n'est affiché qu'une seule fois. Copiez-le et transmettez-le à l'agent.
              </DialogDescription>
            </DialogHeader>

            {createdAgentCredentials && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input value={createdAgentCredentials.email} readOnly />
                </div>
                <div className="space-y-1">
                  <Label>Mot de passe temporaire</Label>
                  <Input value={createdAgentCredentials.temporary_password} readOnly />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" type="button" onClick={copyCredentials}>
                    Copier
                  </Button>
                  <Button type="button" onClick={() => setCreatedAgentCredentials(null)}>
                    Fermer
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
