/**
 * Laravel Echo (temps réel)
 * Fournit une instance singleton d'Echo configurée pour Pusher.
 * - Authentification Bearer via header Authorization (Sanctum)
 * - Paramètres lus depuis import.meta.env (Vite)
 * - Utilisé pour écouter les événements: TicketCalled, ServiceStatsUpdated, etc.
 */
import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

// Create a singleton Echo instance configured for Bearer auth with Sanctum token
let echoInstance: any = null

export function getEcho(): any {
  if (echoInstance) return echoInstance
  // Token Sanctum pour l'auth broadcast privé
  const token = (typeof window !== 'undefined' && (window as any).localStorage && typeof (window as any).localStorage.getItem === 'function')
    ? (window as any).localStorage.getItem('token')
    : null
  const key = import.meta.env.VITE_REVERB_APP_KEY || import.meta.env.VITE_PUSHER_KEY
  const host = import.meta.env.VITE_REVERB_HOST || import.meta.env.VITE_PUSHER_HOST || window.location.hostname
  const port = Number(import.meta.env.VITE_REVERB_PORT || import.meta.env.VITE_PUSHER_PORT || 8080)
  const scheme = (import.meta.env.VITE_REVERB_SCHEME || (import.meta.env.VITE_PUSHER_FORCE_TLS === 'true' ? 'https' : 'http')) as string

  ;(window as any).Pusher = Pusher
  echoInstance = new Echo({
    broadcaster: 'pusher', // Reverb parle le protocole Pusher
    key,
    cluster: import.meta.env.VITE_REVERB_CLUSTER || import.meta.env.VITE_PUSHER_CLUSTER,
    wsHost: host,
    wsPort: port,
    wssPort: port,
    forceTLS: scheme === 'https',
    disableStats: true,
    enabledTransports: ['ws', 'wss'],
    authEndpoint: `${import.meta.env.VITE_API_BASE_URL || ''}/api/broadcasting/auth`,
    auth: { headers: { Authorization: token ? `Bearer ${token}` : '' } }
  })
  return echoInstance
}
