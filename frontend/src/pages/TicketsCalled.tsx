import { useEffect, useState } from 'react';
import { getEcho } from '@/api/echo';
import { FaTicketAlt, FaUserClock, FaInfoCircle, FaSpinner } from 'react-icons/fa';

export default function TicketsCalled() {
  const [serviceId, setServiceId] = useState<number | ''>('' as any);
  const [rows, setRows] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!serviceId) return;
    
    setIsLoading(true);
    const echo = getEcho();
    
    try {
      const channel = echo.join(`presence-service.${serviceId}`)
        .here(() => setIsConnected(true))
        .error(() => setIsConnected(false));
      
      channel.listen('.service.ticket.called', (e: any) => {
        setRows(prev => [{
          id: e?.ticket?.id,
          number: e?.ticket?.number,
          at: new Date(),
          status: 'called'
        }, ...prev].slice(0, 50));
      });
      
      setIsConnected(true);
      
      return () => {
        echo.leave(`presence-service.${serviceId}`);
        setIsConnected(false);
      };
    } catch (error) {
      console.error('Erreur de connexion:', error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [serviceId]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 md:p-6 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-indigo-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FaTicketAlt className="text-white text-2xl" />
                <h1 className="text-xl font-semibold text-white">Tickets Appelés</h1>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span className="text-sm text-white/90">
                  {isConnected ? 'Connecté' : 'Déconnecté'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="p-4 md:p-6">
            <div className="mb-6">
              <label htmlFor="serviceId" className="block text-sm font-medium text-gray-700 mb-1">
                ID du Service
              </label>
              <div className="flex space-x-2">
                <input
                  id="serviceId"
                  type="number"
                  value={serviceId as any}
                  onChange={(e) => setServiceId(Number(e.target.value) || ('' as any))}
                  placeholder="Entrez l'ID du service"
                  className="flex-1 min-w-0 block w-full px-3 py-2 rounded-md border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  disabled={isLoading}
                />
              </div>
              <p className="mt-1 text-sm text-gray-500 flex items-center">
                <FaInfoCircle className="mr-1.5" /> Entrez l'ID du service pour commencer à recevoir les mises à jour
              </p>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <FaSpinner className="animate-spin h-8 w-8 text-blue-600" />
              </div>
            ) : serviceId ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-medium text-gray-900">Derniers tickets appelés</h2>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {rows.length} {rows.length <= 1 ? 'ticket' : 'tickets'}
                  </span>
                </div>

                {rows.length > 0 ? (
                  <div className="overflow-hidden border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            N° Ticket
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Heure d'appel
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Statut
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {rows.map((ticket, index) => (
                          <tr key={`${ticket.id}-${index}`} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-blue-100 text-blue-600">
                                  <FaTicketAlt />
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">
                                    {ticket.number || `#${ticket.id}`}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {ticket.at.toLocaleTimeString()}
                              </div>
                              <div className="text-xs text-gray-500">
                                {ticket.at.toLocaleDateString()}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                Appelé
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <FaUserClock className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Aucun ticket appelé</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Les tickets appelés apparaîtront ici en temps réel.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100">
                  <FaTicketAlt className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="mt-4 text-lg font-medium text-gray-900">Sélectionnez un service</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Entrez l'ID d'un service pour afficher les tickets appelés en temps réel.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
