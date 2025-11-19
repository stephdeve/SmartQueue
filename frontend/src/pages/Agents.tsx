/**
 * Agents (Admin)
 * Page de gestion des agents avec modaux de création et d'édition.
 * - Liste paginée des agents avec recherche et filtres
 * - Création et édition avec validation des données
 * - Gestion des services associés aux agents
 */
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search, Filter, User, Mail, Phone, Lock, Check, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Composants UI
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// API
import { api } from '@/api/axios';

// Types et schémas de validation
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
  last_login?: string | null;
  created_at: string;
  services?: { id: number; name: string }[];
  avatar?: string | null;
}

// Schéma de validation Zod
const agentSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  email: z.string().email('Adresse email invalide'),
  phone: z.string().optional(),
  role: z.enum(['admin', 'agent', 'supervisor']),
  status: z.enum(['active', 'inactive', 'pending']),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères').optional(),
  confirmPassword: z.string().optional(),
  service_ids: z.array(z.number()).optional(),
}).refine((data) => !data.confirmPassword || data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

type AgentFormData = z.infer<typeof agentSchema>;

export default function Agents() {
  // États
  const [agents, setAgents] = useState<Agent[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState({
    agents: true,
    services: true,
    submitting: false,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  
  // États des modaux
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  
  // Formulaire avec react-hook-form
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
      role: 'agent',
      status: 'active',
      service_ids: [],
    },
  });
  
  const selectedServices = watch('service_ids') || [];
  
  // Fonction pour récupérer les agents
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
  
  // Fonction pour récupérer les services
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
      const status = error?.response?.status
      if (status === 401 || status === 403) {
        toast.error("Accès refusé. Connectez-vous avec un compte administrateur pour voir les services.")
      } else {
        toast.error('Impossible de charger la liste des services');
      }
      console.error('Erreur lors de la récupération des services:', error);
    } finally {
      setLoading(prev => ({ ...prev, services: false }));
    }
  };
  
  // Effets
  useEffect(() => {
    fetchAgents();
    fetchServices();
  }, []);
  
  // Filtrage des agents (fonction principale)
  const filteredAgents = useMemo(() => {
    const list = Array.isArray(agents) ? agents : [];
    return list.filter(agent => {
      const matchesSearch = 
        agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (agent.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
      
      const matchesStatus = statusFilter === 'all' || agent.status === statusFilter;
      const matchesRole = roleFilter === 'all' || agent.role === roleFilter;
      
      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [agents, searchTerm, statusFilter, roleFilter]);
  
  // Gestion des services sélectionnés
  const toggleService = (serviceId: number) => {
    const newServices = selectedServices.includes(serviceId)
      ? selectedServices.filter(id => id !== serviceId)
      : [...selectedServices, serviceId];
    
    setValue('service_ids', newServices);
  };
  
  
  // Ouverture du modal de création
  const openCreateModal = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };
  
  // Ouverture du modal d'édition
  const openEditModal = (agent: Agent) => {
    setCurrentAgent(agent);
    reset({
      name: agent.name,
      email: agent.email,
      phone: agent.phone || '',
      role: agent.role as any,
      status: agent.status as any,
      service_ids: agent.services?.map(s => s.id) || [],
    });
    setIsEditModalOpen(true);
  };

  // Soumission du formulaire (création et édition)
  const onSubmit = async (data: AgentFormData) => {
    setLoading(prev => ({ ...prev, submitting: true }));
    
    try {
      if (currentAgent) {
        // Mise à jour d'un agent existant
        await api.put(`/admin/agents/${currentAgent.id}`, data);
        toast.success('Agent mis à jour avec succès');
      } else {
        // Création d'un nouvel agent
        await api.post('/admin/agents', {
          ...data,
          password: data.password || 'password123', // Mot de passe par défaut si non fourni
        });
        toast.success('Agent créé avec succès');
      }
      
      // Rafraîchir la liste des agents
      await fetchAgents();
      
      // Fermer les modaux
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
  
  // Suppression d'un agent
  const handleDeleteAgent = async (agentId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet agent ? Cette action est irréversible.')) {
      return;
    }
    
    try {
      await api.delete(`/admin/agents/${agentId}`);
      toast.success('Agent supprimé avec succès');
      await fetchAgents();
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'agent:', error);
      toast.error('Impossible de supprimer l\'agent');
    }
  };
  
  // Statut et rôle (badges)
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Actif</Badge>;
      case 'inactive':
        return <Badge variant="destructive">Inactif</Badge>;
      case 'pending':
        return <Badge variant="warning">En attente</Badge>;
      default:
        return <Badge variant="outline">Inconnu</Badge>;
    }
  };
  
  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge variant="default">Administrateur</Badge>;
      case 'supervisor':
        return <Badge variant="secondary">Superviseur</Badge>;
      case 'agent':
      default:
        return <Badge variant="outline">Agent</Badge>;
    }
  };

  // Réinitialisation du formulaire
  const resetForm = () => {
    reset({
      name: '',
      email: '',
      phone: '',
      role: 'agent',
      status: 'active',
      password: '',
      confirmPassword: '',
      service_ids: []
    });
    setCurrentAgent(null);
  };


  

  if (loading.agents || loading.services) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="container mx-auto px-4 py-6">
      {/* En-tête de la page */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des agents</h1>
          <p className="mt-1 text-sm text-gray-500">
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

      {/* Filtres et recherche */}
      <Card className="mb-6">
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
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
            
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <User className="mr-2 h-4 w-4" />
                <span className="mr-2">Rôle:</span>
                <SelectValue placeholder="Tous les rôles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                <SelectItem value="admin">Administrateur</SelectItem>
                <SelectItem value="supervisor">Superviseur</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="flex items-center justify-end">
              <Button variant="outline" size="sm" className="mr-2">
                <span className="sr-only">Exporter</span>
                <span>Exporter</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="ml-2 h-4 w-4"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Tableau des agents */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <span className="sr-only">Photo</span>
                </TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Services</TableHead>
                <TableHead>Dernière connexion</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAgents.length > 0 ? (
                filteredAgents.map((agent) => (
                  <TableRow key={agent.id} className="hover:bg-gray-50">
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
                      <div className="font-medium">{agent.name}</div>
                      <div className="text-sm text-gray-500">{agent.email}</div>
                      {agent.phone && (
                        <div className="text-sm text-gray-500 flex items-center">
                          <Phone className="mr-1 h-3 w-3" />
                          {agent.phone}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{getRoleBadge(agent.role)}</TableCell>
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
                      {agent.last_login ? (
                        <div className="text-sm text-gray-500">
                          {format(new Date(agent.last_login), 'PPpp', { locale: fr })}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Jamais connecté</span>
                      )}
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
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
        
        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 border-t">
          <div className="text-sm text-gray-500">
            Affichage de <span className="font-medium">1</span> à{' '}
            <span className="font-medium">{Math.min(10, filteredAgents.length)}</span> sur{' '}
            <span className="font-medium">{filteredAgents.length}</span> agents
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" disabled>
              Précédent
            </Button>
            <Button variant="outline" size="sm" disabled>
              Suivant
            </Button>
          </div>
        </div>
      </Card>

      {/* Modal de création */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
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
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="name"
                    placeholder="Jean Dupont"
                    className="pl-10"
                    {...register('name')}
                  />
                </div>
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Adresse email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="jean.dupont@exemple.com"
                    className="pl-10"
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone (optionnel)</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+33 6 12 34 56 78"
                    className="pl-10"
                    {...register('phone')}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Rôle</Label>
                  <Select
                    value={watch('role')}
                    onValueChange={(value) => setValue('role', value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un rôle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agent">Agent</SelectItem>
                      <SelectItem value="supervisor">Superviseur</SelectItem>
                      <SelectItem value="admin">Administrateur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
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
                <Label htmlFor="password">Mot de passe temporaire</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                    {...register('password')}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  L'agent devra changer ce mot de passe lors de sa première connexion.
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

      {/* Modal d'édition */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Modifier l'agent</DialogTitle>
              <DialogDescription>
                Modifiez les informations de l'agent. Les changements seront enregistrés après validation.
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nom complet</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="edit-name"
                    placeholder="Jean Dupont"
                    className="pl-10"
                    {...register('name')}
                  />
                </div>
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-email">Adresse email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="edit-email"
                    type="email"
                    placeholder="jean.dupont@exemple.com"
                    className="pl-10"
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Téléphone (optionnel)</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="edit-phone"
                    type="tel"
                    placeholder="+33 6 12 34 56 78"
                    className="pl-10"
                    {...register('phone')}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-role">Rôle</Label>
                  <Select
                    value={watch('role')}
                    onValueChange={(value) => setValue('role', value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un rôle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agent">Agent</SelectItem>
                      <SelectItem value="supervisor">Superviseur</SelectItem>
                      <SelectItem value="admin">Administrateur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
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
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="edit-password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                    {...register('password')}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Laissez vide pour ne pas modifier le mot de passe.
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
    </div>
    </TooltipProvider>
  );
}
