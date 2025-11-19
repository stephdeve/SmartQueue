/**
 * Files d'attente (Agent/Admin)
 * - Sélection d'un service pour piloter la file d'attente
 * - Actions: appeler suivant, marquer absent, rappeler
 * - Écoute temps réel des évènements via Laravel Echo
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaTicketAlt, FaUserClock, FaUsers, FaChartLine, FaSyncAlt } from 'react-icons/fa';
import { getEcho } from '@/api/echo';

type Ticket = {
  id: number;
  ticket_number: string;
  status: string;
  created_at: string;
  service_id: number;
  service_name: string;
  priority: string;
  client_name?: string;
};

type ServiceStats = {
  service_id: number;
  service_name: string;
  waiting: number;
  processed: number;
  average_wait_time: string;
};

const Queues: React.FC = () => {
  const [serviceId, setServiceId] = useState<string>('');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<ServiceStats | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const navigate = useNavigate();
  const echo = getEcho();

  useEffect(() => {
    if (!serviceId) return;

    // Réinitialiser l'état lors du changement de service
    setTickets([]);
    setStats(null);
    setIsLoading(true);

    // S'abonner au canal de présence pour le service
    const channel = echo.join(`presence-service.${serviceId}`);
    
    channel
      .subscribed(() => {
        console.log(`Abonné au canal presence-service.${serviceId}`);
        setIsConnected(true);
        setIsLoading(false);
        setLastUpdated(new Date().toLocaleTimeString());
      })
      .listen('.service.ticket.called', (e: any) => {
        console.log('Ticket appelé reçu:', e);
        setTickets(prevTickets => [
          {
            id: e.ticket.id,
            ticket_number: e.ticket.ticket_number,
            status: e.ticket.status,
            created_at: e.ticket.created_at,
            service_id: e.ticket.service_id,
            service_name: e.ticket.service_name,
            priority: e.ticket.priority,
            client_name: e.ticket.client_name
          },
          ...prevTickets
        ].slice(0, 10)); // Garder uniquement les 10 derniers tickets
        setLastUpdated(new Date().toLocaleTimeString());
      })
      .listen('.service.stats.updated', (e: any) => {
        console.log('Statistiques mises à jour:', e);
        setStats(e.stats);
        setLastUpdated(new Date().toLocaleTimeString());
      });

    return () => {
      channel.stopListening('.service.ticket.called');
      channel.stopListening('.service.stats.updated');
      echo.leave(`presence-service.${serviceId}`);
      setIsConnected(false);
    };
  }, [echo, serviceId]);

  const handleServiceIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceId.trim()) return;
    setIsLoading(true);
    setTickets([]);
    setStats(null);
  };

  const refreshData = () => {
    if (!serviceId) return;
    setIsLoading(true);
    // La reconnexion se fera automatiquement via l'effet
  };

  if (isLoading && serviceId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-gray-50 p-4">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
          <div className="flex justify-center mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Connexion en cours</h2>
          <p className="text-gray-600 mb-6">Connexion au service {serviceId}...</p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'vip': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return '🔥';
      case 'vip': return '⭐';
      default: return '📋';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-8 border border-gray-100">
          {/* En-tête */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6 text-white">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">Tableau de bord des files d'attente</h1>
                <p className="text-blue-100 mt-1">Surveillez en temps réel l'activité de vos services</p>
              </div>
              {lastUpdated && (
                <div className="mt-4 md:mt-0 text-sm bg-blue-700 bg-opacity-50 px-3 py-1.5 rounded-full inline-flex items-center">
                  <span className="w-2 h-2 rounded-full bg-green-400 mr-2"></span>
                  <span>Mis à jour à {lastUpdated}</span>
                </div>
              )}
            </div>
          </div>

          {/* Formulaire de sélection du service */}
          <div className="p-6 border-b border-gray-100">
            <form onSubmit={handleServiceIdSubmit}>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-grow">
                  <label htmlFor="serviceId" className="block text-sm font-medium text-gray-700 mb-1">
                    Identifiant du service
                  </label>
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FaTicketAlt className="h-5 w-5 text-blue-500" />
                    </div>
                    <input
                      type="text"
                      id="serviceId"
                      value={serviceId}
                      onChange={(e) => setServiceId(e.target.value)}
                      placeholder="Entrez l'ID du service"
                      className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 pr-12 py-3 border-gray-300 rounded-lg text-base"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                      <button
                        type="submit"
                        className="p-1 text-blue-600 hover:text-blue-800 focus:outline-none"
                        title="Actualiser"
                      >
                        <FaSyncAlt className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 flex items-center justify-center"
                  >
                    <FaChartLine className="mr-2" />
                    Afficher les statistiques
                  </button>
                </div>
              </div>
            </form>

            {serviceId && (
              <div className="mt-4 flex items-center">
                <div className={`h-3 w-3 rounded-full mr-2 ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className="text-sm font-medium">
                  {isConnected 
                    ? `Connecté au service ${serviceId}` 
                    : 'Déconnecté'}
                </span>
                {isConnected && (
                  <button 
                    onClick={refreshData}
                    className="ml-4 text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
                  >
                    <FaSyncAlt className="mr-1 h-3.5 w-3.5" />
                    Actualiser
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Cartes de statistiques */}
          {stats && (
            <div className="p-6 border-b border-gray-100 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <FaChartLine className="mr-2 text-blue-600" />
                Aperçu des performances
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-white p-5 rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
                  <div className="flex items-center">
                    <div className="p-3 rounded-lg bg-blue-50 text-blue-600 mr-4">
                      <FaUserClock className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">En attente</p>
                      <p className="text-2xl font-bold text-gray-800">{stats.waiting}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Service: {stats.service_name}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
                  <div className="flex items-center">
                    <div className="p-3 rounded-lg bg-green-50 text-green-600 mr-4">
                      <FaTicketAlt className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Traités</p>
                      <p className="text-2xl font-bold text-gray-800">{stats.processed}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500">
                      <span>Service: {stats.service_name}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
                  <div className="flex items-center">
                    <div className="p-3 rounded-lg bg-purple-50 text-purple-600 mr-4">
                      <FaUsers className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Temps d'attente</p>
                      <p className="text-2xl font-bold text-gray-800">{stats.average_wait_time}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500">
                      <span>Moyenne pour {stats.service_name}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Derniers tickets appelés */}
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                <FaTicketAlt className="mr-2 text-blue-600" />
                Derniers tickets appelés
              </h2>
              {tickets.length > 0 && (
                <span className="text-sm text-gray-500">
                  Affichage des {Math.min(tickets.length, 10)} derniers
                </span>
              )}
            </div>
            
            {tickets.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <FaTicketAlt className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                <h3 className="text-lg font-medium text-gray-700">Aucun ticket récent</h3>
                <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
                  Aucun ticket n'a été appelé récemment pour ce service. Les tickets apparaîtront ici en temps réel.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Numéro
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Détails
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Statut
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Heure
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {tickets.map((ticket, index) => (
                        <tr key={`${ticket.id}-${index}`} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className="text-2xl mr-3">{getPriorityIcon(ticket.priority)}</span>
                              <div>
                                <div className="font-bold text-gray-900">{ticket.ticket_number}</div>
                                <div className="text-xs text-gray-500">#{ticket.id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 font-medium">
                              {ticket.service_name}
                            </div>
                            {ticket.client_name && (
                              <div className="text-sm text-gray-500">
                                {ticket.client_name}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getPriorityColor(ticket.priority)}`}>
                              {ticket.priority === 'high' ? 'Haute priorité' : 
                               ticket.priority === 'vip' ? 'VIP' : 'Standard'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="font-medium">
                              {new Date(ticket.created_at).toLocaleTimeString()}
                            </div>
                            <div className="text-xs text-gray-400">
                              {new Date(ticket.created_at).toLocaleDateString()}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="text-center mt-6 text-sm text-gray-500">
          <p>Système de gestion de file d'attente en temps réel • {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  );
};

export default Queues;
