/**
 * Page d'affichage des tickets marqués comme absents
 * - Affiche la liste des clients absents en temps réel
 * - Permet de filtrer par service
 * - Met à jour automatiquement lors des nouveaux marquages d'absence
 */
import React, { useState, useEffect } from 'react';
import { FaUserClock, FaExclamationTriangle, FaTicketAlt, FaSyncAlt } from 'react-icons/fa';
import { getEcho } from '@/api/echo';

type Ticket = {
  id: number;
  ticket_number: string;
  service_id: number;
  service_name: string;
  created_at: string;
  client_name?: string;
  marked_absent_at?: string;
};

const TicketsAbsent: React.FC = () => {
  const [serviceId, setServiceId] = useState<string>('');
  const [absentTickets, setAbsentTickets] = useState<Ticket[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const echo = getEcho();

  useEffect(() => {
    if (!serviceId) return;

    // Réinitialiser l'état lors du changement de service
    setAbsentTickets([]);
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
      .listen('.service.ticket.absent', (e: any) => {
        console.log('Ticket absent reçu:', e);
        const newTicket = {
          id: e.ticket.id,
          ticket_number: e.ticket.ticket_number,
          service_id: e.ticket.service_id,
          service_name: e.ticket.service_name,
          created_at: e.ticket.updated_at,
          client_name: e.ticket.client_name,
          marked_absent_at: e.ticket.updated_at
        };
        
        setAbsentTickets(prevTickets => {
          // Éviter les doublons
          if (!prevTickets.some(t => t.id === newTicket.id)) {
            return [newTicket, ...prevTickets];
          }
          return prevTickets;
        });
        
        setLastUpdated(new Date().toLocaleTimeString());
      });

    return () => {
      channel.stopListening('.service.ticket.absent');
      echo.leave(`presence-service.${serviceId}`);
      setIsConnected(false);
    };
  }, [echo, serviceId]);

  const handleServiceIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceId.trim()) return;
    setIsLoading(true);
    setAbsentTickets([]);
  };

  const refreshData = () => {
    if (!serviceId) return;
    // La reconnexion se fera automatiquement via l'effet
    setIsLoading(true);
    setAbsentTickets([]);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      time: date.toLocaleTimeString(),
      date: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-gray-50 p-4">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
          <div className="flex justify-center mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Chargement en cours</h2>
          <p className="text-gray-600 mb-6">Connexion au service {serviceId}...</p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-red-500 h-2 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-gray-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-8 border border-gray-100">
          {/* En-tête */}
          <div className="bg-gradient-to-r from-red-600 to-red-800 p-6 text-white">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">Gestion des absences</h1>
                <p className="text-red-100 mt-1">Surveillez les tickets marqués comme absents en temps réel</p>
              </div>
              {lastUpdated && (
                <div className="mt-4 md:mt-0 text-sm bg-red-700 bg-opacity-50 px-3 py-1.5 rounded-full inline-flex items-center">
                  <span className="w-2 h-2 rounded-full bg-yellow-400 mr-2"></span>
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
                      <FaTicketAlt className="h-5 w-5 text-red-500" />
                    </div>
                    <input
                      type="text"
                      id="serviceId"
                      value={serviceId}
                      onChange={(e) => setServiceId(e.target.value)}
                      placeholder="Entrez l'ID du service"
                      className="focus:ring-2 focus:ring-red-500 focus:border-red-500 block w-full pl-10 pr-12 py-3 border-gray-300 rounded-lg text-base"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                      <button
                        type="submit"
                        className="p-1 text-red-600 hover:text-red-800 focus:outline-none"
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
                    className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white font-medium rounded-lg hover:from-red-700 hover:to-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200 flex items-center justify-center"
                  >
                    <FaUserClock className="mr-2" />
                    Afficher les absences
                  </button>
                </div>
              </div>
            </form>

            {serviceId && (
              <div className="mt-4 flex items-center">
                <div className={`h-3 w-3 rounded-full mr-2 ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className="text-sm font-medium">
                  {isConnected 
                    ? `Surveillance active du service ${serviceId}` 
                    : 'En attente de connexion...'}
                </span>
                {isConnected && (
                  <button 
                    onClick={refreshData}
                    className="ml-4 text-red-600 hover:text-red-800 text-sm font-medium flex items-center"
                  >
                    <FaSyncAlt className="mr-1 h-3.5 w-3.5" />
                    Actualiser
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Statistiques rapides */}
          {absentTickets.length > 0 && (
            <div className="p-6 border-b border-gray-100 bg-red-50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-white p-5 rounded-xl border border-red-100">
                  <div className="flex items-center">
                    <div className="p-3 rounded-lg bg-red-50 text-red-600 mr-4">
                      <FaExclamationTriangle className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Total des absences</p>
                      <p className="text-2xl font-bold text-gray-800">{absentTickets.length}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-5 rounded-xl border border-gray-200">
                  <div className="flex items-center">
                    <div className="p-3 rounded-lg bg-amber-50 text-amber-600 mr-4">
                      <FaUserClock className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Dernière absence</p>
                      <p className="text-lg font-semibold text-gray-800">
                        {formatDate(absentTickets[0]?.marked_absent_at || new Date().toISOString()).date}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-5 rounded-xl border border-gray-200">
                  <div className="flex items-center">
                    <div className="p-3 rounded-lg bg-blue-50 text-blue-600 mr-4">
                      <FaTicketAlt className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Service</p>
                      <p className="text-lg font-semibold text-gray-800">
                        {absentTickets[0]?.service_name || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Liste des tickets absents */}
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                <FaUserClock className="mr-2 text-red-600" />
                Tickets marqués absents
              </h2>
              {absentTickets.length > 0 && (
                <span className="text-sm text-gray-500">
                  {absentTickets.length} {absentTickets.length > 1 ? 'tickets' : 'ticket'}
                </span>
              )}
            </div>

            {absentTickets.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <FaUserClock className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                <h3 className="text-lg font-medium text-gray-700">
                  {serviceId ? 'Aucune absence enregistrée' : 'Aucun service sélectionné'}
                </h3>
                <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
                  {serviceId 
                    ? "Les tickets marqués comme absents apparaîtront ici en temps réel." 
                    : "Veuillez entrer un ID de service pour commencer la surveillance."}
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
                          Client
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Marqué absent
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {absentTickets.map((ticket) => {
                        const { time, date } = formatDate(ticket.marked_absent_at || ticket.created_at);
                        return (
                          <tr key={ticket.id} className="hover:bg-red-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-red-100 rounded-full">
                                  <FaExclamationTriangle className="h-5 w-5 text-red-500" />
                                </div>
                                <div className="ml-4">
                                  <div className="text-lg font-bold text-gray-900">{ticket.ticket_number}</div>
                                  <div className="text-xs text-gray-500">#{ticket.id}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-gray-900">{ticket.service_name}</div>
                              <div className="text-xs text-gray-500">Service ID: {ticket.service_id}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900 font-medium">
                                {ticket.client_name || 'Client non renseigné'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900 font-medium">{time}</div>
                              <div className="text-xs text-gray-500">{date}</div>
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

        <div className="text-center mt-6 text-sm text-gray-500">
          <p>Système de gestion des absences en temps réel • {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  );
};

export default TicketsAbsent;
