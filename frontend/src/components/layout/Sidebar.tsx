/**
 * Sidebar
 * Navigation latérale avec liens conditionnés par le rôle (admin/agent).
 */
import { NavLink } from 'react-router-dom'
import { useAppSelector } from '@/store'
import { LayoutDashboard, Activity, Users, Building2, Ticket, Settings as SettingsIcon, ListOrdered, BadgeAlert, Ban, BarChart } from 'lucide-react'

const LinkItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) => `
      relative group flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200
      ${isActive
        ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
    `}
  >
    {({ isActive }) => (
      <>
        <span className={`absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r ${isActive ? 'bg-blue-600' : 'bg-transparent'}`} />
        <Icon size={20} className={`flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
        <span className="truncate">{label}</span>
      </>
    )}
  </NavLink>
)

export default function Sidebar() {
  const { user } = useAppSelector((s) => s.auth)
  const role = user?.role
  const userInitial = user?.name?.charAt(0) || '?'

  return (
    <aside className="flex flex-col h-screen w-64 border-r border-gray-200 bg-white shadow-sm">
      {/* Logo et nom de l'application */}
      <div className="flex items-center h-16 px-6 border-b border-gray-100">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white font-bold text-lg">
            SQ
          </div>
          <span className="ml-3 text-lg font-semibold text-gray-800">SmartQueue</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 mb-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Navigation
        </div>
        <LinkItem to="/" icon={LayoutDashboard} label="Tableau de bord" />
        
        {(role === 'agent' || role === 'admin') && (
          <>
            <div className="px-3 mt-6 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Gestion des files
            </div>
            <LinkItem to="/queues" icon={ListOrdered} label="Files d'attente" />
            <LinkItem to="/called" icon={Activity} label="Tickets appelés" />
            <LinkItem to="/absent" icon={Ban} label="Absents" />
            <LinkItem to="/priority" icon={BadgeAlert} label="Prioritaires" />
          </>
        )}

        {role === 'admin' && (
          <>
            <div className="px-3 mt-6 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Administration
            </div>
            <LinkItem to="/agents" icon={Users} label="Agents" />
            <LinkItem to="/services" icon={Ticket} label="Services" />
            <LinkItem to="/establishments" icon={Building2} label="Établissements" />
            <LinkItem to="/stats" icon={BarChart} label="Statistiques" />
          </>
        )}
      </nav>

      {/* Profil utilisateur */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center px-2 py-2 rounded-lg hover:bg-gray-50">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium">
            {userInitial}
          </div>
          <div className="ml-3 overflow-hidden">
            <p className="text-sm font-medium text-gray-800 truncate">{user?.name || 'Utilisateur'}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email || ''}</p>
          </div>
        </div>
        <div className="mt-2">
          <LinkItem to="/settings" icon={SettingsIcon} label="Paramètres" />
        </div>
      </div>
    </aside>
  )
}
