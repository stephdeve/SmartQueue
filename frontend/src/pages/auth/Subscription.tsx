// Fichier déprécié - remplacé par SubscriptionPlan.tsx
// Redirection vers la nouvelle page d'abonnement


/**
 * SubscriptionPlan
 * Page d'abonnement pour les établissements avec validation Zod.
 * - Utilise le schéma de validation du backend pour la souscription
 * - Intégration avec l'API onboarding/subscribe
 * - Design moderne et professionnel
 */
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/store'
import { refreshMe, subscribe } from '@/store/authSlice'
import { Check, Crown, Zap, Building, Users, ArrowRight, CreditCard, Shield, Headphones, TrendingUp, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { subscribeSchema, type SubscribeFormData } from '@/lib/schemas/auth'
import { cn } from '@/lib/utils'

interface Plan {
  id: string
  name: string
  price: number
  period: 'month' | 'year'
  features: string[]
  icon: any
  popular?: boolean
  color: string
  description: string
}

const plans: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 10000, // 10.000 CFA
    period: 'month',
    icon: Users,
    color: 'from-blue-600 to-blue-400',
    description: 'Parfait pour les petites entreprises',
    features: [
      'Jusqu\'à 50 tickets/jour',
      '2 agents simultanés',
      '3 services',
      'Notifications email',
      'Statistiques de base',
      'Support email 5j/7'
    ]
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 30000, // 30.000 CFA
    period: 'month',
    icon: Zap,
    popular: true,
    color: 'from-purple-600 to-purple-400',
    description: 'Idéal pour les entreprises en croissance',
    features: [
      'Jusqu\'à 200 tickets/jour',
      '5 agents simultanés',
      'Services illimités',
      'Notifications SMS & email',
      'Statistiques avancées',
      'Export de données',
      'Support prioritaire 7j/7',
      'API d\'intégration'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 80000, // 80.000 CFA
    period: 'month',
    icon: Building,
    color: 'from-emerald-600 to-emerald-400',
    description: 'Pour les grandes organisations',
    features: [
      'Tickets illimités',
      'Agents illimités',
      'Multi-établissements',
      'Personnalisation avancée',
      'Intégrations sur mesure',
      'Dedicated account manager',
      'SLA garanti',
      'Formation incluse',
      'Hébergement privé option'
    ]
  }
]

export default function SubscriptionPlan() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [billingCycle, setBillingCycle] = useState<'month' | 'year'>('month')
  const [isProcessing, setIsProcessing] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  
  const dispatch = useAppDispatch()
  const { user, loading } = useAppSelector((s) => s.auth)
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<SubscribeFormData>({
    resolver: zodResolver(subscribeSchema),
    defaultValues: {
      plan: '',
      paid: false,
    },
  })

  const watchedPlan = watch('plan')

  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId)
    setValue('plan', planId)
    setShowPaymentForm(true)
  }

  const handlePayment = async () => {
    if (!selectedPlan) {
      toast.error('Veuillez sélectionner un plan')
      return
    }

    const token = (typeof window !== 'undefined' && (window as any).localStorage?.getItem)
      ? (window as any).localStorage.getItem('token')
      : null
    if (!token) {
      toast.error('Session expirée. Veuillez vous reconnecter.')
      navigate('/login')
      return
    }

    setIsProcessing(true)
    
    try {
      // Simuler le processus de paiement
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Marquer comme payé et soumettre
      setValue('paid', true)
      
      const formData = {
        plan: selectedPlan,
        paid: true,
      }

      const result = await dispatch(subscribe(formData)).unwrap()
      toast.success('Abonnement souscrit avec succès ! Redirection...')

      setShowPaymentForm(false)
      
      const me = await dispatch(refreshMe()).unwrap()

      // Petit délai pour permettre au router de se mettre à jour avec les nouvelles routes
      // basées sur le state Redux mis à jour
      await new Promise(resolve => setTimeout(resolve, 100))

      if (result?.next_step === 'create_establishment' || result?.next_step === 'setup_establishment' || !me?.establishment_id) {
        navigate('/dashboard/setup-establishment', { replace: true })
        return
      }

      navigate('/dashboard', { replace: true })
    } catch (error: any) {
      console.error('Subscription payment failed', error)
      const status = error?.status
      if (status === 422) {
        toast.error('Données invalides. Veuillez vérifier les champs.')
      } else if (status === 403) {
        toast.error('Accès refusé. Vous devez être administrateur.')
      } else if (status === 401) {
        toast.error('Non authentifié. Veuillez vous reconnecter.')
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

  const getAnnualPrice = (monthlyPrice: number) => {
    return Math.round(monthlyPrice * 12 * 0.8) // 20% de réduction annuelle
  }

  // Vérifier si l'utilisateur est authentifié (user ou admin)
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Accès refusé</h2>
          <p className="text-muted-foreground mb-4">Vous devez être connecté pour accéder à cette page.</p>
          <Link
            to="/login"
            className="text-blue-600 hover:text-blue-500"
          >
            Se connecter
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white font-bold">
                SQ
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent dark:from-blue-400 dark:to-blue-300">
                SmartQueue
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Connecté en tant que {user.name}
              </span>
              <Link
                to="/login"
                className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
              >
                Déconnexion
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="text-center py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Choisissez votre plan
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
              pour gérer intelligemment vos files d'attente
            </span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            Des tarifs transparents et adaptés à vos besoins. Commencez gratuitement et évoluez à votre rythme.
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
              <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                -20%
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {plans.map((plan) => {
            const Icon = plan.icon
            const displayPrice = billingCycle === 'month' 
              ? plan.price 
              : getAnnualPrice(plan.price)
            const periodText = billingCycle === 'month' ? '/mois' : '/an'
            
            // Formater le prix en CFA
            const formattedPrice = new Intl.NumberFormat('fr-FR').format(displayPrice)

            return (
              <div
                key={plan.id}
                className={`relative bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 transition-all duration-300 hover:shadow-xl hover:scale-105 cursor-pointer p-6 ${
                  plan.popular 
                    ? 'border-purple-500 ring-4 ring-purple-100 dark:ring-purple-900' 
                    : 'border-gray-200 dark:border-gray-600'
                } ${
                  selectedPlan === plan.id ? 'ring-4 ring-blue-100 dark:ring-blue-900 border-blue-500' : ''
                }`}
                onClick={() => handlePlanSelect(plan.id)}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-purple-600 to-purple-400 text-white px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                      <Crown className="w-4 h-4" />
                      Plus populaire
                    </span>
                  </div>
                )}

                <div className="p-6">
                  {/* Plan Header */}
                  <div className="text-center mb-6">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center mx-auto mb-3`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{plan.name}</h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">{plan.description}</p>
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-bold text-gray-900 dark:text-white">{formattedPrice}</span>
                      <span className="text-gray-600 dark:text-gray-300 ml-2">FCFA{periodText}</span>
                    </div>
                    {billingCycle === 'year' && (
                      <p className="text-green-600 dark:text-green-400 text-sm mt-2">
                        Économisez {new Intl.NumberFormat('fr-FR').format(plan.price * 12 * 0.2)} FCFA par an
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <div className="space-y-2 mb-6">
                    {plan.features.map((feature, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700 dark:text-gray-300 text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA Button */}
                  <button
                    type="button"
                    className={`w-full py-2.5 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 text-sm ${
                      selectedPlan === plan.id
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : plan.popular
                        ? 'bg-gradient-to-r from-purple-600 to-purple-400 text-white hover:from-purple-700 hover:to-purple-500 shadow-lg'
                        : 'bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-800 dark:hover:bg-gray-600'
                    }`}
                  >
                    {selectedPlan === plan.id ? (
                      <>
                        <Check className="w-4 h-4" />
                        Sélectionné
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
      </div>

      {/* Payment Form Modal */}
      {showPaymentForm && selectedPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Finaliser la souscription
            </h3>
            
            <div className="mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  Plan sélectionné : <strong>{plans.find(p => p.id === selectedPlan)?.name}</strong>
                </p>
                <p className="text-sm text-blue-600">
                  {billingCycle === 'month' 
                    ? `${new Intl.NumberFormat('fr-FR').format(plans.find(p => p.id === selectedPlan)?.price || 0)} FCFA/mois`
                    : `${new Intl.NumberFormat('fr-FR').format(getAnnualPrice(plans.find(p => p.id === selectedPlan)?.price || 0))} FCFA/an`
                  }
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handlePayment()
              }}
              className="space-y-4"
            >
              <input type="hidden" {...register('plan')} />
              <input type="hidden" {...register('paid')} />
              
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Paiement simulé</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Cliquez sur le bouton ci-dessous pour simuler le paiement et activer votre abonnement.
                </p>
                
                {errors.plan && (
                  <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.plan.message}
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPaymentForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => void handlePayment()}
                  disabled={isProcessing}
                  className={`flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 ${
                    isProcessing ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Traitement...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      Payer et activer
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Trust Section */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Pourquoi choisir SmartQueue ?
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Sécurisé</h3>
              <p className="text-gray-600">Vos données sont protégées par un chiffrement de bout en bout et des sauvegardes automatiques.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Évolutif</h3>
              <p className="text-gray-600">Notre solution grandit avec votre entreprise. Changez de plan à tout moment sans interruption.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Headphones className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Support</h3>
              <p className="text-gray-600">Une équipe dédiée pour vous accompagner et répondre à toutes vos questions rapidement.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <CreditCard className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">Paiement sécurisé via Stripe</span>
            </div>
            <div className="text-sm text-gray-600">
              © {new Date().getFullYear()} SmartQueue. Tous droits réservés.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}