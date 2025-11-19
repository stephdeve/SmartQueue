import { useEffect, useState } from 'react'
import { api } from '@/api/axios'
import { useAppSelector } from '@/store'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { 
  Ticket, 
  CheckCircle, 
  UserX, 
  Clock, 
  Users, 
  Building2, 
  Activity, 
  TrendingUp,
  Calendar as CalendarIcon,
  Clock as ClockIcon,
  Settings
} from 'lucide-react'

// Composant de carte de statistique
const StatCard = ({ title, value, icon: Icon, color = 'blue' }: { title: string; value: string | number; icon: any; color?: string }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-200 hover:shadow-md">
    <div className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
        </div>
        <div className={`p-3 rounded-lg bg-${color}-50`}>
          <Icon className={`h-6 w-6 text-${color}-600`} />
        </div>
      </div>
    </div>
  </div>
)

// Composant d'onglet amélioré avec icônes, variantes et animations
const TabButton = ({ 
  active, 
  onClick, 
  children, 
  icon: Icon, 
  color = 'blue',
  className = '' 
}: { 
  active: boolean; 
  onClick: () => void; 
  children: React.ReactNode; 
  icon?: any;
  color?: 'blue' | 'emerald' | 'amber' | 'purple';
  className?: string;
}) => {
  const accents: Record<string, { text: string; hoverText: string; bg: string; hoverBg: string; underline: string; iconInactive: string; iconActive: string }> = {
    blue:    { text: 'text-blue-600',    hoverText: 'hover:text-blue-600',    bg: 'bg-blue-50',    hoverBg: 'hover:bg-blue-50',    underline: 'bg-blue-600',    iconInactive: 'text-gray-400 group-hover:text-gray-600', iconActive: 'text-blue-600' },
    emerald: { text: 'text-emerald-600', hoverText: 'hover:text-emerald-600', bg: 'bg-emerald-50', hoverBg: 'hover:bg-emerald-50', underline: 'bg-emerald-600', iconInactive: 'text-gray-400 group-hover:text-gray-600', iconActive: 'text-emerald-600' },
    amber:   { text: 'text-amber-600',   hoverText: 'hover:text-amber-600',   bg: 'bg-amber-50',   hoverBg: 'hover:bg-amber-50',   underline: 'bg-amber-600',   iconInactive: 'text-gray-400 group-hover:text-gray-600', iconActive: 'text-amber-600' },
    purple:  { text: 'text-purple-600',  hoverText: 'hover:text-purple-600',  bg: 'bg-purple-50',  hoverBg: 'hover:bg-purple-50',  underline: 'bg-purple-600',  iconInactive: 'text-gray-400 group-hover:text-gray-600', iconActive: 'text-purple-600' },
  };
  const accent = accents[color] || accents.blue;

  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`relative px-6 py-3 text-sm font-medium transition-all duration-300 flex items-center space-x-2 rounded-md group ${
        active 
          ? `${accent.text} ${accent.bg}` 
          : `text-gray-500 ${accent.hoverText} ${accent.hoverBg}`
      } ${className}`}
    >
      {Icon && <Icon className={`h-5 w-5 ${active ? accent.iconActive : accent.iconInactive}`} />}
      <span>{children}</span>
      <span className={`absolute bottom-0 left-0 w-full h-0.5 ${accent.underline} transform transition-all duration-300 ${
        active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-50'
      }`}></span>
    </button>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null)
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week')
  const [activeTab, setActiveTab] = useState('overview')
  const role = useAppSelector((s) => s.auth.user?.role)
  const user = useAppSelector((s) => s.auth.user)

  useEffect(() => {
    if (role === 'admin') {
      api.get(`/api/admin/stats/overview?range=${timeRange}`)
        .then(r => setStats(r.data))
        .catch(() => setStats(null))
    }
  }, [role, timeRange])

  // Données factices pour la démo
  const mockData = [
    { name: 'Lun', value: 12 },
    { name: 'Mar', value: 19 },
    { name: 'Mer', value: 15 },
    { name: 'Jeu', value: 27 },
    { name: 'Ven', value: 23 },
    { name: 'Sam', value: 18 },
    { name: 'Dim', value: 8 },
  ]

  return (
    <div className="space-y-6">
      {/* En-tête avec titre et sélecteur de période */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="mt-1 text-sm text-gray-500">
            Aperçu des performances et des statistiques
          </p>
        </div>
        
        <div className="inline-flex rounded-md shadow-sm" role="group">
          <button
            type="button"
            onClick={() => setTimeRange('day')}
            className={`px-4 py-2 text-sm font-medium rounded-l-lg border ${
              timeRange === 'day' 
                ? 'bg-blue-50 text-blue-700 border-blue-300' 
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Aujourd'hui
          </button>
          <button
            type="button"
            onClick={() => setTimeRange('week')}
            className={`px-4 py-2 text-sm font-medium border-t border-b ${
              timeRange === 'week' 
                ? 'bg-blue-50 text-blue-700 border-blue-300' 
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Cette semaine
          </button>
          <button
            type="button"
            onClick={() => setTimeRange('month')}
            className={`px-4 py-2 text-sm font-medium rounded-r-lg border ${
              timeRange === 'month' 
                ? 'bg-blue-50 text-blue-700 border-blue-300' 
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Ce mois-ci
          </button>
        </div>
      </div>

      {/* Onglets améliorés */}
      <div className="border-b border-gray-200 bg-white rounded-lg shadow-sm">
        <nav className="flex overflow-x-auto hide-scrollbar">
          <div className="flex space-x-1 px-4">
            <TabButton 
              active={activeTab === 'overview'} 
              onClick={() => setActiveTab('overview')}
              icon={Activity}
            >
              Vue d'ensemble
            </TabButton>
            {role === 'admin' && (
              <>
                <TabButton 
                  active={activeTab === 'agents'} 
                  onClick={() => setActiveTab('agents')}
                  icon={Users}
                >
                  Agents
                </TabButton>
                <TabButton 
                  active={activeTab === 'services'} 
                  onClick={() => setActiveTab('services')}
                  icon={Ticket}
                  color="blue"
                >
                  Services
                </TabButton>
                <TabButton 
                  active={activeTab === 'establishments'} 
                  onClick={() => setActiveTab('establishments')}
                  icon={Building2}
                  color="emerald"
                >
                  Établissements
                </TabButton>
                <TabButton 
                  active={activeTab === 'stats'} 
                  onClick={() => setActiveTab('stats')}
                  icon={TrendingUp}
                  color="amber"
                >
                  Statistiques
                </TabButton>
              </>
            )}
            <TabButton 
              active={activeTab === 'settings'} 
              onClick={() => setActiveTab('settings')}
              icon={Settings}
              color="purple"
            >
              Paramètres
            </TabButton>
          </div>
        </nav>
      </div>
      <style dangerouslySetInnerHTML={{
        __html: `
          .hide-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
        `
      }} />

      {/* Contenu des onglets */}
      <div className="space-y-6">
        {activeTab === 'overview' && (
          <>
            {/* Cartes de statistiques */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard 
                title="Tickets créés" 
                value={stats?.tickets?.created ?? '—'} 
                icon={Ticket} 
                color="blue"
              />
              <StatCard 
                title="Tickets clôturés" 
                value={stats?.tickets?.closed ?? '—'} 
                icon={CheckCircle} 
                color="green"
              />
              <StatCard 
                title="Absents" 
                value={stats?.tickets?.absent ?? '—'} 
                icon={UserX} 
                color="red"
              />
              <StatCard 
                title="Temps d'attente moyen" 
                value={stats?.tickets?.wait_avg_minutes ? `${stats.tickets.wait_avg_minutes} min` : '—'} 
                icon={Clock} 
                color="yellow"
              />
            </div>

            {/* Graphique d'activité */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-5 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Activité récente</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Évolution du nombre de tickets sur la période sélectionnée
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <CalendarIcon className="h-4 w-4" />
                    <span>
                      {timeRange === 'day' 
                        ? 'Aujourd\'hui' 
                        : timeRange === 'week' 
                          ? 'Cette semaine' 
                          : 'Ce mois-ci'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="p-5 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={(stats?.series?.length ? stats.series : mockData).map((v: any, i: number) => ({
                      name: v.name || `Jour ${i + 1}`,
                      value: v.y ?? v.value
                    }))}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: '#6b7280' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <YAxis 
                      tick={{ fill: '#6b7280' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.375rem',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#3b82f6' }}
                      activeDot={{ r: 6, stroke: '#2563eb', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Dernières activités */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-5 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Dernières activités</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {[1, 2, 3, 4, 5].map((item) => (
                  <div key={item} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Users className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-900">Nouveau ticket créé</p>
                        <p className="text-sm text-gray-500">Ticket #{1000 + item} - Service Accueil</p>
                      </div>
                      <div className="ml-auto text-sm text-gray-500 flex items-center">
                        <ClockIcon className="h-4 w-4 mr-1" />
                        {item * 15} min
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'agents' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Gestion des agents</h2>
            <p className="text-gray-500">Contenu de la section Agents à venir...</p>
          </div>
        )}

        {activeTab === 'services' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Gestion des services</h2>
            <p className="text-gray-500">Contenu de la section Services à venir...</p>
          </div>
        )}

        {activeTab === 'establishments' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Gestion des établissements</h2>
            <p className="text-gray-500">Contenu de la section Établissements à venir...</p>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Statistiques avancées</h2>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'Jan', value: 65 },
                      { name: 'Fév', value: 59 },
                      { name: 'Mar', value: 80 },
                      { name: 'Avr', value: 81 },
                      { name: 'Mai', value: 56 },
                      { name: 'Juin', value: 55 },
                      { name: 'Juil', value: 40 }
                    ]}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: '#6b7280' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <YAxis 
                      tick={{ fill: '#6b7280' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.375rem',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                      }}
                    />
                    <Bar 
                      dataKey="value" 
                      fill="#3b82f6" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-medium text-gray-900 mb-4">Répartition par service</h3>
                <div className="space-y-3">
                  {['Accueil', 'Comptabilité', 'RH', 'Direction'].map((service, index) => (
                    <div key={service} className="flex items-center">
                      <div className="w-2/5 text-sm font-medium text-gray-700">{service}</div>
                      <div className="w-3/5">
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div 
                            className="bg-blue-600 h-2.5 rounded-full" 
                            style={{ width: `${75 - index * 15}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="w-10 text-right text-sm font-medium text-gray-700 ml-2">
                        {75 - index * 15}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-medium text-gray-900 mb-4">Métriques clés</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm text-gray-500 mb-1">
                      <span>Taux de résolution</span>
                      <span className="font-medium">87%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: '87%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm text-gray-500 mb-1">
                      <span>Satisfaction client</span>
                      <span className="font-medium">4.5/5</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '90%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm text-gray-500 mb-1">
                      <span>Temps de réponse moyen</span>
                      <span className="font-medium">12 min</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: '60%' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6">Paramètres</h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-medium text-gray-900 mb-3">Profil</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center">
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium text-lg">
                      {user?.name?.charAt(0) || 'U'}
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-900">
                        {user?.name || 'Utilisateur'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {user?.email || ''}
                      </p>
                    </div>
                    <button className="ml-auto text-sm font-medium text-blue-600 hover:text-blue-500">
                      Modifier
                    </button>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-base font-medium text-gray-900 mb-3">Préférences</h3>
                <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Notifications par email</p>
                      <p className="text-sm text-gray-500">Recevoir des notifications par email</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" value="" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Mode sombre</p>
                      <p className="text-sm text-gray-500">Activer le mode sombre</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" value="" className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-200">
                <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                  Enregistrer les modifications
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
