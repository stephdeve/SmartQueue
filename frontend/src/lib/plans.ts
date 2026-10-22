/**
 * Offres d'abonnement : source unique côté serveur (GET /api/plans, config/plans.php).
 * Les pages d'accueil, d'abonnement et de paramètres lisent ce catalogue au lieu de
 * dupliquer des prix (qui divergeaient : € sur l'accueil, FCFA ailleurs).
 */
import { useEffect, useState } from 'react'
import { api } from '@/api/axios'

export interface Plan {
  id: string
  name: string
  monthly_price: number
  description: string
  popular: boolean
  limits: { agents: number | null; services: number | null; tickets_per_day: number | null }
  features: string[]
}

export interface PlanCatalog {
  currency: string
  annual_discount_percent: number
  trial_days: number
  plans: Plan[]
}

let pending: Promise<PlanCatalog> | null = null

export function fetchPlans(): Promise<PlanCatalog> {
  if (!pending) {
    pending = api.get('/api/plans').then((r) => r.data as PlanCatalog).catch((e) => {
      pending = null
      throw e
    })
  }
  return pending
}

export function usePlans() {
  const [catalog, setCatalog] = useState<PlanCatalog | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    fetchPlans()
      .then((c) => alive && setCatalog(c))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [])

  return { catalog, error, loading: !catalog && !error }
}

/** Anciens identifiants encore présents sur des souscriptions existantes. */
const PLAN_ALIASES: Record<string, string> = { basic: 'starter', pro: 'professional', free: 'starter' }

export function normalizePlanId(id?: string | null): string {
  const key = String(id ?? '').toLowerCase()
  return PLAN_ALIASES[key] ?? key
}

export function formatFcfa(amount: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(amount))} FCFA`
}

/** Prix annuel (remise annuelle appliquée). */
export function annualPrice(catalog: PlanCatalog, plan: Plan): number {
  return Math.round((plan.monthly_price * 12 * (100 - catalog.annual_discount_percent)) / 100)
}

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  trial: "Période d'essai",
  active: 'Actif',
  past_due: 'Paiement en retard',
  canceled: 'Annulé',
}
