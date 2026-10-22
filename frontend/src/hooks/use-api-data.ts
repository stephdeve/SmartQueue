import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/api/axios'
import { toast } from 'sonner'

interface UseApiDataOptions<T> {
  initialData?: T | null
  onSuccess?: (data: T) => void
  onError?: (error: any) => void
  showToast?: boolean
}

interface UseApiDataReturn<T> {
  data: T | null
  loading: boolean
  refreshing: boolean
  error: string | null
  load: () => Promise<void>
  refresh: () => Promise<void>
  setData: (data: T | null) => void
}

function errorMessageFor(error: any): string {
  const status = error?.response?.status
  switch (status) {
    case 401:
      return 'Session expirée. Veuillez vous reconnecter.'
    case 403:
      return 'Accès refusé. Permissions requises.'
    case 404:
      return 'Ressource introuvable.'
    case 422:
      return 'Données invalides. Vérifiez votre requête.'
    case 429:
      return 'Trop de requêtes. Veuillez réessayer plus tard.'
    default:
      if (status >= 500) return "Erreur serveur. Contactez l'administrateur."
      return error?.message || 'Erreur lors du chargement des données'
  }
}

/**
 * Charge un endpoint au montage (et à chaque changement d'endpoint).
 *
 * Les options sont lues via une ref : passées en littéral par les pages, elles
 * changeaient à chaque rendu, recréaient le chargeur et relançaient la requête
 * en boucle (rafale d'appels API infinie).
 */
export function useApiData<T>(
  endpoint: string,
  options: UseApiDataOptions<T> = {}
): UseApiDataReturn<T> {
  const optionsRef = useRef(options)
  optionsRef.current = options

  const [data, setData] = useState<T | null>(options.initialData ?? null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async (isRefresh = false) => {
    const opts = optionsRef.current
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      const response = await api.get(endpoint)
      const responseData = response.data?.data || response.data

      setData(responseData)
      opts.onSuccess?.(responseData)
    } catch (err) {
      const message = errorMessageFor(err)
      setError(message)
      if (opts.showToast !== false) toast.error(message)
      opts.onError?.(err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [endpoint])

  const load = useCallback(() => loadData(false), [loadData])
  const refresh = useCallback(() => loadData(true), [loadData])

  // Chargement initial (sauf si des données initiales sont fournies)
  useEffect(() => {
    if ((optionsRef.current.initialData ?? null) === null) {
      load()
    }
  }, [load])

  return {
    data,
    loading,
    refreshing,
    error,
    load,
    refresh,
    setData
  }
}

// Hook for paginated data (réponses Laravel paginate : { data, current_page, total, ... })
export function usePaginatedApiData<T>(
  endpoint: string,
  options: UseApiDataOptions<T> & { perPage?: number } = {}
) {
  const perPage = options.perPage ?? 100
  const optionsRef = useRef(options)
  optionsRef.current = options

  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    current_page: 1,
    total: 0,
    per_page: perPage,
    last_page: 1
  })
  // Derniers filtres utilisés : un refresh() sans argument les conserve
  const paramsRef = useRef<Record<string, any>>({})

  const loadData = useCallback(async (params?: Record<string, any>, isRefresh = false) => {
    const opts = optionsRef.current
    if (params) paramsRef.current = params
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      const response = await api.get(endpoint, {
        params: { per_page: perPage, ...paramsRef.current }
      })

      const responseData = response.data
      const items = responseData?.data || []

      setData(Array.isArray(items) ? items : [])
      setPagination({
        current_page: responseData?.current_page || 1,
        total: responseData?.total || 0,
        per_page: responseData?.per_page || perPage,
        last_page: responseData?.last_page || 1
      })
      opts.onSuccess?.(items)
    } catch (err) {
      const message = errorMessageFor(err)
      setError(message)
      if (opts.showToast !== false) toast.error(message)
      opts.onError?.(err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [endpoint, perPage])

  const load = useCallback((params?: Record<string, any>) => loadData(params, false), [loadData])
  const refresh = useCallback((params?: Record<string, any>) => loadData(params, true), [loadData])

  useEffect(() => {
    load()
  }, [load])

  return {
    data,
    loading,
    refreshing,
    error,
    pagination,
    load,
    refresh,
    setData
  }
}
