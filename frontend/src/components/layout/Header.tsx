/**
 * Header
 * Barre supérieure affichant l'utilisateur connecté et l'action de déconnexion.
 * - Utilise Redux pour récupérer l'utilisateur courant
 * - Déclenche l'action logout (API + nettoyage localStorage)
 */
import { useAppDispatch, useAppSelector } from '@/store'
import { logout } from '@/store/authSlice'
import { BellIcon, LogOut, Menu, Search } from 'lucide-react'
import { useState } from 'react'

type HeaderProps = {
  onMenuToggle?: () => void
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const { user } = useAppSelector((s) => s.auth)
  const dispatch = useAppDispatch()
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  const handleLogout = () => {
    if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
      dispatch(logout())
    }
  }

  if (!user) return null

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm">
      <div className="flex items-center">
        <button 
          onClick={onMenuToggle}
          className="mr-2 rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-600 md:hidden"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Ouvrir le menu</span>
        </button>
        
        <div className="relative
        ">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6"
            placeholder="Rechercher..."
          />
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <button 
          type="button" 
          className="rounded-full p-1 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <span className="sr-only">Notifications</span>
          <div className="relative">
            <BellIcon className="h-6 w-6" aria-hidden="true" />
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-xs font-medium text-white flex items-center justify-center">
              3
            </span>
          </div>
        </button>

        <div className="relative">
          <div className="flex items-center">
            <div className="text-right mr-3 hidden md:block">
              <p className="text-sm font-medium text-gray-700">{user.name}</p>
              <p className="text-xs text-gray-500 capitalize">{user.role}</p>
            </div>
            
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex rounded-full bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <span className="sr-only">Ouvrir le menu utilisateur</span>
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium">
                {user.name?.charAt(0) || 'U'}
              </div>
            </button>
          </div>

          {/* Menu déroulant du profil */}
          {isProfileOpen && (
            <div className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              <a
                href="#"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Mon profil
              </a>
              <a
                href="#"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Paramètres
              </a>
              <button
                onClick={handleLogout}
                className="flex w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
