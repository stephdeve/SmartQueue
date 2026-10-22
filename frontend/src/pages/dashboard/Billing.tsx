import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

/**
 * Facturation : aucun prestataire de paiement n'est branché. Le règlement se fait
 * auprès de l'équipe SmartQueue, qui active l'abonnement depuis le back-office.
 */
export default function Billing() {
  const navigate = useNavigate()

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-card rounded-xl shadow-lg border max-w-3xl mx-auto border-border p-6 space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Facturation</h1>
        <p className="text-muted-foreground">
          Le paiement en ligne n'est pas encore proposé. Le règlement de votre abonnement se fait directement auprès de
          l'équipe SmartQueue : votre abonnement passe de « Période d'essai » à « Actif » dès réception.
        </p>
        <p className="text-muted-foreground">
          L'offre choisie, son montant et la date de fin de la période en cours sont affichés dans les paramètres.
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <Button onClick={() => navigate('/dashboard/settings')}>Voir mon abonnement</Button>
          <Button variant="outline" onClick={() => navigate('/dashboard/subscription')}>
            Changer d'offre
          </Button>
        </div>
      </div>
    </div>
  )
}
