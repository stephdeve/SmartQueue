import React, { useState, useEffect } from "react";
import {
  FaStar,
  FaCrown,
  FaTicketAlt,
  FaSyncAlt,
  FaUserTie,
  FaBuilding,
  FaSpinner,
} from "react-icons/fa";
import { getEcho } from "@/api/echo";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { api } from "@/api/axios";

type Ticket = {
  id: number;
  number: string;
  ticket_number?: string;
  status: string;
  service_id: number;
  service_name: string;
  created_at: string;
  priority: string;
  client_name?: string;
  customer_name?: string;
  user?: { name: string };
};

type Service = {
  id: number;
  name: string;
  status: string;
};

const TicketsPriority: React.FC = () => {
  const [serviceId, setServiceId] = useState<string>("");
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState<boolean>(false);
  const [priorityTickets, setPriorityTickets] = useState<Ticket[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [channel, setChannel] = useState<any>(null);

  // Charger les services disponibles de l'utilisateur
  const loadUserServices = async () => {
    setLoadingServices(true);
    try {
      const response = await api.get('/api/agent/services');
      const servicesData = response.data?.data || [];
      setServices(servicesData);

      // Sélectionner automatiquement le premier service si disponible
      if (servicesData.length > 0 && !serviceId) {
        setServiceId(String(servicesData[0].id));
      }
    } catch (err: any) {
      console.error('Erreur chargement services:', err);
      toast.error('Impossible de charger vos services');
    } finally {
      setLoadingServices(false);
    }
  };

  // Récupérer le nom du client depuis différentes sources
  const getClientName = (ticket: any): string => {
    if (ticket.customer_name) return ticket.customer_name;
    if (ticket.client_name) return ticket.client_name;
    if (ticket.user?.name) return ticket.user.name;
    if (ticket.customer?.name) return ticket.customer.name;
    return "—";
  };

  // Load existing priority tickets from API
  const loadPriorityTickets = async (numericId: number): Promise<boolean> => {
    try {
      const response = await api.get('/api/agent/tickets', {
        params: {
          service_id: numericId,
          per_page: 50,
        }
      });
      const tickets = response.data?.data || [];
      // Filter for high/vip priority
      const priorityFiltered = tickets.filter((t: any) =>
        t.priority === 'high' || t.priority === 'vip'
      );
      setPriorityTickets(priorityFiltered.map((t: any) => ({
        id: t.id,
        number: t.number,
        ticket_number: t.number,
        status: t.status,
        service_id: t.service?.id || t.service_id,
        service_name: t.service?.name || `Service ${t.service_id}`,
        created_at: t.created_at,
        priority: t.priority,
        client_name: getClientName(t),
        customer_name: t.customer_name,
        user: t.user,
      })));
      setLastUpdated(new Date().toLocaleTimeString());
      return true;
    } catch (e: any) {
      console.error('Error loading priority tickets:', e);
      if (e?.response?.status === 404 || e?.response?.status === 403) {
        setError('Service non trouvé ou accès non autorisé');
        return false;
      }
      setError(e?.response?.data?.message || 'Erreur lors du chargement');
      return false;
    }
  };

  // Charger les services au montage
  useEffect(() => {
    loadUserServices();
  }, []);

  // Gestion de la connexion WebSocket
  useEffect(() => {
    const numericId = Number(serviceId);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      setIsConnected(false);
      setIsLoading(false);
      setPriorityTickets([]);
      setError("");
      return;
    }

    setIsLoading(true);
    setError("");
    const echo = getEcho();

    // First load existing tickets from API
    loadPriorityTickets(numericId).then((success) => {
      if (!success) {
        setIsLoading(false);
        setIsConnected(false);
        return;
      }

      // Canal de présence (le backend diffuse sur presence-service.{id}, réservé au personnel)
      try {
        const newChannel = echo.join(`service.${numericId}`);

        // Écouter l'événement d'ajout de ticket
        newChannel.listen('.service.ticket.enqueued', (e: any) => {
          const t = e?.ticket;
          if (!t) return;
          if (t.priority === 'high' || t.priority === 'vip' || t.priority === 'urgence') {
            console.log('📢 Événement prioritaire reçu:', t);
            setPriorityTickets(prev => {
              if (prev.some(x => x.id === t.id)) return prev;
              return [{
                id: t.id,
                number: t.number || t.ticket_number || String(t.id),
                ticket_number: t.number || t.ticket_number || String(t.id),
                status: t.status || 'waiting',
                service_id: t.service_id || numericId,
                service_name: t.service_name || `Service ${numericId}`,
                created_at: t.created_at || new Date().toISOString(),
                priority: t.priority,
                client_name: getClientName(t),
              }, ...prev].slice(0, 50);
            });
            setLastUpdated(new Date().toLocaleTimeString());
            toast.info(`Ticket ${t.number || t.ticket_number} (${t.priority === 'urgence' ? 'Urgence' : t.priority === 'vip' ? 'VIP' : 'Prioritaire'}) ajouté`);
          }
        });

        // Écouter la clôture pour retirer de la liste
        newChannel.listen('.service.ticket.served', (e: any) => {
          const t = e?.ticket;
          if (!t) return;
          setPriorityTickets(prev => prev.filter(x => x.id !== t.id));
        });

        // Écouter l'absence pour retirer de la liste
        newChannel.listen('.service.ticket.absent', (e: any) => {
          const t = e?.ticket;
          if (!t) return;
          setPriorityTickets(prev => prev.filter(x => x.id !== t.id));
        });

        setChannel(newChannel);
        setIsConnected(true);
        setIsLoading(false);
        console.log(`✅ Connecté au canal service.${numericId}`);

      } catch (err) {
        console.error('Erreur de connexion WebSocket:', err);
        setIsConnected(false);
        setIsLoading(false);
      }
    });

    return () => {
      // `channel` (state) vaut encore null dans cette closure : quitter par nom,
      // sinon chaque changement de service empilait un abonnement supplémentaire.
      try {
        getEcho().leave(`service.${numericId}`);
      } catch (_) { }
      setChannel(null);
      setIsConnected(false);
    };
  }, [serviceId]);

  const handleServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newServiceId = e.target.value;
    setServiceId(newServiceId);
    setPriorityTickets([]);
    setError("");
  };

  const refreshData = () => {
    if (!serviceId) {
      toast.error("Aucun service sélectionné");
      return;
    }
    const numericId = Number(serviceId);
    if (numericId > 0) {
      loadPriorityTickets(numericId);
      toast.info("Rafraîchissement des données");
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return { time: "--:--", date: "---" };
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return { time: "--:--", date: "---" };
      return {
        time: date.toLocaleTimeString(),
        date: date.toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
      };
    } catch {
      return { time: "--:--", date: "---" };
    }
  };

  const getPriorityBadge = (priority: string) => {
    const baseClasses =
      "px-3 py-1 text-xs font-bold rounded-full flex items-center";

    switch (priority) {
      case "vip":
        return (
          <span
            className={`${baseClasses} bg-gradient-to-r from-purple-600 to-purple-800 text-white`}
          >
            <FaCrown className="mr-1.5 text-yellow-300" /> VIP
          </span>
        );
      case "high":
        return (
          <span
            className={`${baseClasses} bg-gradient-to-r from-red-600 to-red-700 text-white`}
          >
            <FaStar className="mr-1.5 text-yellow-300" /> Haute priorité
          </span>
        );
      default:
        return (
          <span className={`${baseClasses} bg-muted text-foreground`}>
            Normale
          </span>
        );
    }
  };

  if (loadingServices) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 to-gray-50 p-4">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
          <div className="flex justify-center mb-4">
            <FaSpinner className="animate-spin h-8 w-8 text-purple-600" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Chargement des services
          </h2>
          <p className="text-muted-foreground mb-6">
            Récupération de vos services...
          </p>
          <div className="w-full bg-muted rounded-full h-2">
            <div className="bg-primary h-2 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 to-gray-50 p-4">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
          <div className="flex justify-center mb-4">
            <FaSpinner className="animate-spin h-8 w-8 text-purple-600" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Chargement en cours
          </h2>
          <p className="text-muted-foreground mb-6">
            Connexion au service {services.find(s => String(s.id) === serviceId)?.name || serviceId}...
          </p>
          <div className="w-full bg-muted rounded-full h-2">
            <div className="bg-primary h-2 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  const selectedServiceName = services.find(s => String(s.id) === serviceId)?.name;

  // Trier les tickets par priorité (VIP d'abord, puis haute priorité)
  const sortedTickets = [...priorityTickets].sort((a, b) => {
    if (a.priority === "vip" && b.priority !== "vip") return -1;
    if (a.priority !== "vip" && b.priority === "vip") return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Compter les tickets par priorité
  const vipCount = priorityTickets.filter((t) => t.priority === "vip").length;
  const highPriorityCount = priorityTickets.filter(
    (t) => t.priority === "high",
  ).length;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="mx-auto">
        <div className="bg-card rounded-2xl shadow-xl overflow-hidden mb-8 border border-border">
          {/* En-tête */}
          <div className="bg-gradient-to-r from-purple-600 to-purple-800 p-6 text-white">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">
                  Gestion des priorités
                </h1>
                <p className="text-purple-100 mt-1">
                  Surveillez les clients VIP et les tickets prioritaires
                </p>
              </div>
              {lastUpdated && (
                <div className="mt-4 md:mt-0 text-sm bg-purple-700 bg-opacity-50 px-3 py-1.5 rounded-full inline-flex items-center">
                  <span className={`w-2 h-2 rounded-full mr-2 ${isConnected ? "bg-green-400 animate-pulse" : "bg-yellow-400"}`}></span>
                  <span>Mis à jour à {lastUpdated}</span>
                </div>
              )}
            </div>
          </div>

          {/* Sélection du service */}
          <div className="p-6 border-b border-border">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="flex-grow">
                <label
                  htmlFor="serviceId"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Service
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaBuilding className="h-5 w-5 text-purple-500" />
                  </div>
                  <select
                    id="serviceId"
                    value={serviceId}
                    onChange={handleServiceChange}
                    className="focus:ring-2 focus:ring-purple-500 focus:border-purple-500 block w-full pl-10 pr-10 border-border rounded-lg text-base bg-background appearance-none cursor-pointer"
                  >
                    <option value="">Sélectionner un service</option>
                    {services.map((service) => (
                      <option key={service.id} value={String(service.id)}>
                        {service.name} ({service.status === 'open' ? '🟢 Ouvert' : '🔴 Fermé'})
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="h-5 w-5 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <p className="mt-1 text-sm text-muted-foreground flex items-center">
                  <FaTicketAlt className="mr-1.5 h-3 w-3" />
                  Sélectionnez un service pour voir les priorités en temps réel
                </p>
              </div>
              <div className="flex items-end gap-2">
                {serviceId && (
                  <button
                    onClick={refreshData}
                    className="px-4 py-2.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800/40 transition-all duration-200 flex items-center"
                  >
                    <FaSyncAlt className="mr-2 h-4 w-4" />
                    Actualiser
                  </button>
                )}
              </div>
            </div>

            {serviceId && (
              <div className="mt-4 flex items-center gap-3">
                <div
                  className={`h-2.5 w-2.5 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-yellow-500"}`}
                ></div>
                <span className="text-sm font-medium text-foreground">
                  {isConnected ? (
                    <>✅ Connecté en temps réel - {selectedServiceName || `Service ${serviceId}`}</>
                  ) : (
                    <>🔄 Mode veille - en attente des événements</>
                  )}
                </span>
              </div>
            )}
          </div>

          {error && (
            <div className="p-4 mx-6 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Statistiques rapides */}
          {priorityTickets.length > 0 && (
            <div className="p-6 border-b border-border bg-purple-50/50 dark:bg-purple-900/10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-card p-5 rounded-xl border border-purple-200 dark:border-purple-800/30">
                  <div className="flex items-center">
                    <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 mr-4">
                      <FaStar className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Total des priorités
                      </p>
                      <p className="text-2xl font-bold text-foreground">
                        {priorityTickets.length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-card p-5 rounded-xl border border-border">
                  <div className="flex items-center">
                    <div className="p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 mr-4">
                      <FaCrown className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Clients VIP
                      </p>
                      <p className="text-2xl font-bold text-foreground">
                        {vipCount}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-card p-5 rounded-xl border border-border">
                  <div className="flex items-center">
                    <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 mr-4">
                      <FaStar className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Haute priorité
                      </p>
                      <p className="text-2xl font-bold text-foreground">
                        {highPriorityCount}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Liste des tickets prioritaires */}
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center">
                <FaStar className="mr-2 text-purple-600" />
                Tickets prioritaires
              </h2>
              {priorityTickets.length > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200">
                    <FaCrown className="mr-1 text-yellow-500" /> {vipCount} VIP
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200">
                    <FaStar className="mr-1 text-red-500" /> {highPriorityCount}{" "}
                    Haute
                  </span>
                </div>
              )}
            </div>

            {!serviceId ? (
              <div className="text-center py-12 bg-muted/50 rounded-xl border-2 border-dashed border-border">
                <FaBuilding className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <h3 className="text-lg font-medium text-foreground">
                  Aucun service sélectionné
                </h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
                  Veuillez sélectionner un service pour voir les priorités.
                </p>
              </div>
            ) : priorityTickets.length === 0 ? (
              <div className="text-center py-12 bg-muted/50 rounded-xl border-2 border-dashed border-border">
                <FaUserTie className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <h3 className="text-lg font-medium text-foreground">
                  Aucun ticket prioritaire
                </h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
                  Les tickets prioritaires (VIP/Haute) apparaîtront ici en temps réel.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Numéro
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Détails
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Client
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Priorité
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Créé
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                      {sortedTickets.map((ticket) => {
                        const { time, date } = formatDate(ticket.created_at);
                        const isVip = ticket.priority === "vip";

                        return (
                          <tr
                            key={ticket.id}
                            className={`transition-colors hover:bg-muted/50 ${isVip
                                ? "bg-gradient-to-r from-purple-50/50 to-transparent dark:from-purple-950/20"
                                : ""
                              }`}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div
                                  className={`flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full ${isVip
                                      ? "bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/50 dark:to-purple-800/50"
                                      : "bg-red-100 dark:bg-red-900/30"
                                    }`}
                                >
                                  {isVip ? (
                                    <FaCrown className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                  ) : (
                                    <FaStar className="h-5 w-5 text-red-500 dark:text-red-400" />
                                  )}
                                </div>
                                <div className="ml-4">
                                  <div
                                    className={`text-lg font-bold ${isVip
                                        ? "text-purple-600 dark:text-purple-400"
                                        : "text-foreground"
                                      }`}
                                  >
                                    {ticket.ticket_number || ticket.number}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    #{ticket.id}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-foreground">
                                {ticket.service_name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                ID: {ticket.service_id}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-foreground font-medium">
                                {ticket.client_name || "—"}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {getPriorityBadge(ticket.priority)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-foreground font-medium">
                                {time}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {date}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="text-center mt-6 text-sm text-muted-foreground">
          <p>
            Système de gestion des priorités en temps réel •{" "}
            {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TicketsPriority;