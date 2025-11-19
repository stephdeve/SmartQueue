/**
 * Router
 * Déclare les routes de l'application avec garde d'authentification et RBAC.
 * - RequireAuth: redirige vers /login si non authentifié et vérifie les rôles autorisés
 */
import { createBrowserRouter, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Queues from './pages/Queues'
import TicketsCalled from './pages/TicketsCalled'
import TicketsAbsent from './pages/TicketsAbsent'
import TicketsPriority from './pages/TicketsPriority'
import Agents from './pages/Agents'
import Services from './pages/Services'
import Establishments from './pages/Establishments'
import Stats from './pages/Stats'
import Settings from './pages/Settings'
import { useAppSelector } from './store'

function RequireAuth({ children, roles }: { children: JSX.Element; roles?: string[] }) {
  const { token, user } = useAppSelector((s) => s.auth)
  if (!token) return <Navigate to="/login" replace />
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'queues', element: <RequireAuth roles={["agent","admin"]}><Queues /></RequireAuth> },
      { path: 'called', element: <RequireAuth roles={["agent","admin"]}><TicketsCalled /></RequireAuth> },
      { path: 'absent', element: <RequireAuth roles={["agent","admin"]}><TicketsAbsent /></RequireAuth> },
      { path: 'priority', element: <RequireAuth roles={["agent","admin"]}><TicketsPriority /></RequireAuth> },
      { path: 'agents', element: <RequireAuth roles={["admin"]}><Agents /></RequireAuth> },
      { path: 'services', element: <RequireAuth roles={["admin"]}><Services /></RequireAuth> },
      { path: 'establishments', element: <RequireAuth roles={["admin"]}><Establishments /></RequireAuth> },
      { path: 'stats', element: <RequireAuth roles={["admin"]}><Stats /></RequireAuth> },
      { path: 'settings', element: <Settings /> }
    ]
  }
])
