/**
 * SubscriptionPlan
 * Choix de l'offre d'un établissement (catalogue servi par GET /api/plans).
 *
 * Aucun paiement n'est encaissé en ligne : la souscription ouvre une période
 * d'essai et l'abonnement est activé par l'équipe SmartQueue à réception du
 * règlement (back-office super admin → Abonnements).
 */
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/store'
import { logout, refreshMe, subscribe } from '@/store/authSlice'
import { Check, Crown, Zap, Building, Users, ArrowRight, Shield, Headphones, TrendingUp, AlertCircle, CalendarClock } from 'lucide-react'
import { toast } from 'sonner'
import { annualPrice, formatFcfa, usePlans, type Plan } from '@/lib/plans'

const PLAN_STYLE: Record<string, { icon: any; color: string }> = {
  starter: { icon: Users, color: 'from-blue-600 to-blue-400' },
  professional: { icon: Zap, color: 'from-purple-600 to-purple-400' },
  enterprise: { icon: Building, color: 'from-emerald-600 to-emerald-400' },
}

export default function SubscriptionPlan() {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [billingCycle, setBillingCycle] = useState<'month' | 'year'>('month')
  const [isProcessing, setIsProcessing] = useState(false)

  const dispatch = useAppDispatch()
  const { user } = useAppSelector((s) => s.auth)
  const navigate = useNavigate()
  const { catalog, error: plansError, loading: plansLoading } = usePlans()

  const handleSubscribe = async () => {
    if (!selectedPlan) {
      toast.error('Veuillez sélectionner une offre')
      return
    }

    setIsProcessing(true)
    try {
      const result = await dispatch(subscribe({ plan: selectedPlan.id, billing_cycle: billingCycle })).unwrap()
      toast.success("Demande enregistrée : votre période d'essai commence.")
      setSelectedPlan(null)

      const me = await dispatch(refreshMe()).unwrap()

      if (result?.next_step === 'create_establishment' || !me?.establishment_id) {
        navigate('/dashboard/setup-establishment', { replace: true })
        return
      }

      navigate('/dashboard', { replace: true })
    } catch (error: any) {
      const status = error?.status
      if (status === 422) {
        toast.error('Offre invalide. Veuillez réessayer.')
      } else if (status === 403) {
        toast.error('Votre compte ne peut pas souscrire à une offre.')
      } else if (status === 401) {
        toast.error('Session expirée. Veuillez vous reconnecter.')
        navigate('/login')
      } else if (status >= 500) {
        toast.error('Erreur serveur. Veuillez réessayer plus tard.')
      } else {
        toast.error(error?.message || 'Erreur lors de la souscription. Veuillez réessayer.')
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const handleLogout = async () => {
    await dispatch(logout())
    navigate('/login', { replace: true })
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Accès refusé</h2>
          <p className="text-muted-foreground mb-4">Vous devez être connecté pour accéder à cette page.</p>
          <Link to="/login" className="text-blue-600 hover:text-blue-500">
            Se connecter
          </Link>
        </div>
      </div>
    )
  }

  const priceFor = (plan: Plan) => (catalog && billingCycle === 'year' ? annualPrice(catalog, plan) : plan.monthly_price)
  const periodText = billingCycle === 'month' ? '/mois' : '/an'
  const trialDays = catalog?.trial_days ?? 30

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white font-bold">
                SQ
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent dark:from-blue-400 dark:to-blue-300">
                SmartQueue
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="hidden sm:inline text-sm text-gray-600 dark:text-gray-300">
                Connecté en tant que {user.name}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
              >
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="text-center py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Choisissez votre offre
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
              pour gérer vos files d'attente
            </span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            Votre espace est utilisable immédiatement pendant {trialDays} jours d'essai. L'abonnement est activé par
            l'équipe SmartQueue à réception de votre règlement.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 p-1 mb-12">
            <button
              onClick={() => setBillingCycle('month')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                billingCycle === 'month'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Facturation mensuelle
            </button>
            <button
              onClick={() => setBillingCycle('year')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all relative ${
                billingCycle === 'year'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Facturation annuelle
              {!!catalog?.annual_discount_percent && (
                <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                  -{catalog.annual_discount_percent}%
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {plansLoading && (
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-96 rounded-xl bg-white/60 dark:bg-gray-800/60 animate-pulse" />
            ))}
          </div>
        )}
        {plansError && (
          <div className="text-center py-12 text-gray-600 dark:text-gray-300">
            Impossible de charger les offres pour le moment. Veuillez actualiser la page.
          </div>
        )}
        {catalog && (
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {catalog.plans.map((plan) => {
              const style = PLAN_STYLE[plan.id] ?? PLAN_STYLE.starter
              const Icon = style.icon
              const isSelected = selectedPlan?.id === plan.id

              return (
                <div
                  key={plan.id}
                  className={`relative bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 transition-all duration-300 hover:shadow-xl hover:scale-105 cursor-pointer p-6 ${
                    plan.popular
                      ? 'border-purple-500 ring-4 ring-purple-100 dark:ring-purple-900'
                      : 'border-gray-200 dark:border-gray-600'
                  } ${isSelected ? 'ring-4 ring-blue-100 dark:ring-blue-900 border-blue-500' : ''}`}
                  onClick={() => setSelectedPlan(plan)}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <span className="bg-gradient-to-r from-purple-600 to-purple-400 text-white px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                        <Crown className="w-4 h-4" />
                        Recommandé
                      </span>
                    </div>
                  )}

                  <div className="p-6">
                    <div className="text-center mb-6">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${style.color} flex items-center justify-center mx-auto mb-3`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{plan.name}</h3>
                      <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">{plan.description}</p>
                      <div className="flex items-baseline justify-center">
                        <span className="text-4xl font-bold text-gray-900 dark:text-white">
                          {new Intl.NumberFormat('fr-FR').format(priceFor(plan))}
                        </span>
                        <span className="text-gray-600 dark:text-gray-300 ml-2">
                          {catalog.currency}
                          {periodText}
                        </span>
                      </div>
                      {billingCycle === 'year' && catalog.annual_discount_percent > 0 && (
                        <p className="text-green-600 dark:text-green-400 text-sm mt-2">
                          Économisez {formatFcfa(plan.monthly_price * 12 - annualPrice(catalog, plan))} par an
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 mb-6">
                      {plan.features.map((feature) => (
                        <div key={feature} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-700 dark:text-gray-300 text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      className={`w-full py-2.5 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 text-sm ${
                        isSelected
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : plan.popular
                          ? 'bg-gradient-to-r from-purple-600 to-purple-400 text-white hover:from-purple-700 hover:to-purple-500 shadow-lg'
                          : 'bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-800 dark:hover:bg-gray-600'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <Check className="w-4 h-4" />
                          Sélectionnée
                        </>
                      ) : (
                        <>
                          Choisir {plan.name}
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Confirmation */}
      {selectedPlan && catalog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Démarrer votre période d'essai</h3>

            <div className="mb-6 space-y-3">
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Offre sélectionnée : <strong>{selectedPlan.name}</strong>
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-300">
                  {formatFcfa(priceFor(selectedPlan))}
                  {periodText}
                </p>
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 p-4">
                <CalendarClock className="h-5 w-5 text-gray-500 dark:text-gray-300 shrink-0 mt-0.5" />
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Aucun paiement n'est demandé maintenant. Vous disposez de {trialDays} jours d'essai ; l'équipe
                  SmartQueue vous contactera pour le règlement et activera l'abonnement à sa réception.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setSelectedPlan(null)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void handleSubscribe()}
                disabled={isProcessing}
                className={`flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 ${
                  isProcessing ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isProcessing ? 'Enregistrement…' : "Démarrer l'essai"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trust Section */}
      <div className="bg-gray-50 dark:bg-gray-900 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Pourquoi choisir SmartQueue ?</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Données cloisonnées</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Chaque établissement n'accède qu'à ses propres services, agents et tickets.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Évolutif</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Changez d'offre à tout moment : la demande est prise en compte par notre équipe.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Headphones className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Accompagnement</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Une équipe pour vous aider à configurer vos services et former vos agents.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-600 dark:text-gray-300">
          © {new Date().getFullYear()} SmartQueue. Tous droits réservés.
        </div>
      </div>
    </div>
  )
}
