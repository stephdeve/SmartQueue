/**
 * Axios instance
 * Configure une instance Axios avec:
 * - baseURL: VITE_API_BASE_URL (proxy/valeur fournie par Vite)
 * - Intercepteur request: ajoute l'en-tête Authorization Bearer <token>
 * - Intercepteur response: redirige vers /login si 401
 */
import axios from 'axios'

const baseURL = import.meta.env.DEV ? '/' : (import.meta.env.VITE_API_BASE_URL || '/')
export const api = axios.create({ baseURL })

// Injecte le token Sanctum dans chaque requête sortante
api.interceptors.request.use((config) => {
  const token = (typeof window !== 'undefined' && (window as any).localStorage?.getItem)
    ? (window as any).localStorage.getItem('token')
    : null
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Gestion centralisée des erreurs d'authentification
api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err?.response?.status
    const url = err?.config?.url || ''
    if (status === 401 && !url.includes('/api/auth/login')) {
      if (typeof window !== 'undefined' && (window as any).localStorage?.removeItem) {
        (window as any).localStorage.removeItem('token')
      }
      location.href = '/login'
      return
    }
    return Promise.reject(err)
  }
)
