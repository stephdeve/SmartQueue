import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/api/axios'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatFcfa, normalizePlanId, usePlans, SUBSCRIPTION_STATUS_LABELS } from '@/lib/plans'

export type SubscriptionRow = {
  id?: number
  plan: string
  status: string
  billing_cycle?: 'month' | 'year'
  monthly_amount?: number
  current_period_end?: string | null
  plan_change_request?: { plan: string; billing_cycle?: string } | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  establishmentId: number
  establishmentName: string
  subscription: SubscriptionRow | null
  onSaved: () => void
}

/**
 * Édition d'un abonnement par le super admin (PUT /api/saas/establishments/{id}/subscription).
 * Passer en « Actif » démarre la période facturée (calculée côté serveur).
 */
export default function SubscriptionEditor({ open, onOpenChange, establishmentId, establishmentName, subscription, onSaved }: Props) {
  const { catalog } = usePlans()
  const [plan, setPlan] = useState('starter')
  const [status, setStatus] = useState('trial')
  const [cycle, setCycle] = useState<'month' | 'year'>('month')
  const [periodEnd, setPeriodEnd] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const requested = subscription?.plan_change_request?.plan
    setPlan(normalizePlanId(requested || subscription?.plan || 'starter'))
    setStatus(subscription?.status || 'trial')
    setCycle(subscription?.billing_cycle === 'year' ? 'year' : 'month')
    setPeriodEnd(subscription?.current_period_end ? subscription.current_period_end.slice(0, 10) : '')
  }, [open, subscription])

  const save = async () => {
    setSaving(true)
    try {
      await api.put(`/api/saas/establishments/${establishmentId}/subscription`, {
        plan,
        status,
        meta: { billing_cycle: cycle },
        // Date laissée vide à l'activation : le serveur démarre une nouvelle période
        ...(periodEnd && !(status === 'active' && subscription?.status !== 'active')
          ? { current_period_end: periodEnd }
          : {}),
      })
      toast.success('Abonnement mis à jour')
      onOpenChange(false)
      onSaved()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Impossible de mettre à jour l'abonnement")
    } finally {
      setSaving(false)
    }
  }

  const selected = catalog?.plans.find((p) => p.id === plan)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Abonnement — {establishmentName}</DialogTitle>
          <DialogDescription>
            Passez l'abonnement en « Actif » à réception du règlement.
            {subscription?.plan_change_request && ' Une demande de changement d’offre est en attente : elle est pré-sélectionnée.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Offre</Label>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger>
                <SelectValue placeholder="Offre" />
              </SelectTrigger>
              <SelectContent>
                {(catalog?.plans ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {formatFcfa(p.monthly_price)}/mois
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SUBSCRIPTION_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Facturation</Label>
              <Select value={cycle} onValueChange={(v) => setCycle(v as 'month' | 'year')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Mensuelle</SelectItem>
                  <SelectItem value="year">Annuelle</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Fin de période (optionnel)</Label>
            <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              À l'activation, laissez vide : la période démarre aujourd'hui pour un mois ou un an.
            </p>
          </div>
          {selected && (
            <p className="text-sm text-muted-foreground">
              Montant : {formatFcfa(cycle === 'year' && catalog ? Math.round((selected.monthly_price * (100 - catalog.annual_discount_percent)) / 100) : selected.monthly_price)} par mois
              {cycle === 'year' ? ' (facturé annuellement)' : ''}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
