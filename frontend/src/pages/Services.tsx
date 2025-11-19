/**
 * Services (Admin)
 * Gestion des services avec modals de création/édition.
 * - GET /api/admin/services (liste)
 * - POST /api/admin/services (création)
 * - PUT /api/admin/services/{id} (édition)
 * Champs: establishment_id, name, avg_service_time_minutes, status (open/closed), priority_support
 */
import { useEffect, useState } from 'react'
import { api } from '@/api/axios'
import DataTable from '@/components/DataTable'
import Modal from '@/components/Modal'
import { z } from 'zod'
import { toast } from 'react-hot-toast'
import { Plus, Ticket } from 'lucide-react'

type Service = { id:number; name:string; status:string; avg_service_time_minutes?:number; priority_support?:boolean; establishment?: { id:number; name:string } }
type Establishment = { id:number; name:string }

export default function Services(){
  const [rows, setRows] = useState<Service[]>([])
  const [ests, setEsts] = useState<Establishment[]>([])

  const [openCreate, setOpenCreate] = useState(false)
  const [openEdit, setOpenEdit] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)

  // Formulaires
  const [createForm, setCreateForm] = useState({ establishment_id: 0, name:'', avg_service_time_minutes: 5, status:'open', priority_support:false })
  const [editForm, setEditForm] = useState({ establishment_id: 0, name:'', avg_service_time_minutes: 5, status:'open', priority_support:false })
  const [createErrors, setCreateErrors] = useState<Record<string,string>>({})
  const [editErrors, setEditErrors] = useState<Record<string,string>>({})

  // Schémas de validation Zod
  const serviceSchema = z.object({
    establishment_id: z.number().int().positive('Établissement requis'),
    name: z.string().min(2, 'Nom trop court'),
    avg_service_time_minutes: z.number().int().min(1).max(240),
    status: z.enum(['open','closed']),
    priority_support: z.boolean(),
  })

  const load = () => api.get('/api/admin/services?per_page=50').then(r=> setRows(r.data.data || r.data))
  const loadEsts = () => api.get('/api/admin/establishments?per_page=50').then(r=> setEsts(r.data.data || r.data))
  useEffect(()=>{ load(); loadEsts() },[])

  /** Ouverture du modal d'édition avec pré-remplissage. */
  const openEditModal = (s: Service) => {
    setEditing(s)
    setEditForm({
      establishment_id: s.establishment?.id || 0,
      name: s.name,
      avg_service_time_minutes: s.avg_service_time_minutes || 5,
      status: s.status || 'open',
      priority_support: !!s.priority_support
    })
    setOpenEdit(true)
  }

  /** Création d'un service. */
  const createService = async () => {
    setCreateErrors({})
    const parsed = serviceSchema.safeParse({ ...createForm })
    if (!parsed.success) {
      const errs: Record<string,string> = {}
      parsed.error.issues.forEach(i=>{ if(i.path[0]) errs[String(i.path[0])] = i.message })
      setCreateErrors(errs); toast.error('Veuillez corriger le formulaire'); return
    }
    try {
      await api.post('/api/admin/services', parsed.data)
      toast.success('Service créé')
      setOpenCreate(false)
      setCreateForm({ establishment_id: 0, name:'', avg_service_time_minutes:5, status:'open', priority_support:false })
      load()
    } catch(e:any) {
      toast.error(e?.response?.data?.error?.message || 'Erreur de création')
    }
  }

  /** Mise à jour d'un service. */
  const updateService = async () => {
    if (!editing) return
    setEditErrors({})
    const parsed = serviceSchema.safeParse({ ...editForm })
    if (!parsed.success) {
      const errs: Record<string,string> = {}
      parsed.error.issues.forEach(i=>{ if(i.path[0]) errs[String(i.path[0])] = i.message })
      setEditErrors(errs); toast.error('Veuillez corriger le formulaire'); return
    }
    try {
      await api.put(`/api/admin/services/${editing.id}`, parsed.data)
      toast.success('Service mis à jour')
      setOpenEdit(false)
      setEditing(null)
      load()
    } catch(e:any) {
      toast.error(e?.response?.data?.error?.message || 'Erreur de mise à jour')
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
            <Ticket className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Services</h1>
            <p className="text-sm text-gray-500">Gérez les services et leurs établissements</p>
          </div>
        </div>
        <button 
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          onClick={()=>setOpenCreate(true)}
        >
          <Plus className="h-4 w-4" />
          Nouveau service
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <DataTable columns={[
          { key:'id', header:'ID' },
          { key:'name', header:'Service' },
          { key:'status', header:'Statut', render:(r:Service)=> (
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${r.status === 'open' ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-200' : 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200'}`}>
              {r.status}
            </span>
          ) },
          { key:'avg_service_time_minutes', header:'Temps moyen (min)' },
          { key:'establishment', header:'Établissement', render:(r:Service)=> r.establishment?.name },
          { key:'actions', header:'Actions', render:(r:Service)=> (
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={()=>openEditModal(r)}>Éditer</button>
              <button className="btn btn-secondary" onClick={async ()=>{
                if (!confirm(`Supprimer le service ${r.name} ?`)) return
                try { await api.delete(`/api/admin/services/${r.id}`); toast.success('Service supprimé'); load() } catch(e:any){ toast.error(e?.response?.data?.error?.message || 'Suppression impossible') }
              }}>Supprimer</button>
            </div>
          ) },
        ]} data={rows} />
      </div>

      {/* Modal Création */}
      <Modal open={openCreate} onClose={()=>setOpenCreate(false)} title="Créer un service">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-sm">Établissement</label>
            <select className="w-full rounded-md border-gray-300" value={createForm.establishment_id} onChange={e=>setCreateForm({...createForm, establishment_id: Number(e.target.value)})}>
              <option value={0}>—</option>
              {ests.map(e=> <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            {createErrors.establishment_id && <p className="text-xs text-red-600">{createErrors.establishment_id}</p>}
          </div>
          <div>
            <label className="text-sm">Nom</label>
            <input className="w-full rounded-md border-gray-300" value={createForm.name} onChange={e=>setCreateForm({...createForm, name:e.target.value})} />
            {createErrors.name && <p className="text-xs text-red-600">{createErrors.name}</p>}
          </div>
          <div>
            <label className="text-sm">Temps moyen (min)</label>
            <input type="number" className="w-full rounded-md border-gray-300" value={createForm.avg_service_time_minutes} onChange={e=>setCreateForm({...createForm, avg_service_time_minutes:Number(e.target.value)})} />
            {createErrors.avg_service_time_minutes && <p className="text-xs text-red-600">{createErrors.avg_service_time_minutes}</p>}
          </div>
          <div>
            <label className="text-sm">Statut</label>
            <select className="w-full rounded-md border-gray-300" value={createForm.status} onChange={e=>setCreateForm({...createForm, status:e.target.value})}>
              <option value="open">Ouvert</option>
              <option value="closed">Fermé</option>
            </select>
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={createForm.priority_support} onChange={e=>setCreateForm({...createForm, priority_support: e.target.checked})} />
            <span>Support prioritaire</span>
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn btn-secondary" onClick={()=>setOpenCreate(false)}>Annuler</button>
          <button className="btn btn-primary" onClick={createService}>Créer</button>
        </div>
      </Modal>

      {/* Modal Édition */}
      <Modal open={openEdit} onClose={()=>setOpenEdit(false)} title={`Éditer le service ${editing?.name ?? ''}`}>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-sm">Établissement</label>
            <select className="w-full rounded-md border-gray-300" value={editForm.establishment_id} onChange={e=>setEditForm({...editForm, establishment_id: Number(e.target.value)})}>
              <option value={0}>—</option>
              {ests.map(e=> <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            {editErrors.establishment_id && <p className="text-xs text-red-600">{editErrors.establishment_id}</p>}
          </div>
          <div>
            <label className="text-sm">Nom</label>
            <input className="w-full rounded-md border-gray-300" value={editForm.name} onChange={e=>setEditForm({...editForm, name:e.target.value})} />
            {editErrors.name && <p className="text-xs text-red-600">{editErrors.name}</p>}
          </div>
          <div>
            <label className="text-sm">Temps moyen (min)</label>
            <input type="number" className="w-full rounded-md border-gray-300" value={editForm.avg_service_time_minutes} onChange={e=>setEditForm({...editForm, avg_service_time_minutes:Number(e.target.value)})} />
            {editErrors.avg_service_time_minutes && <p className="text-xs text-red-600">{editErrors.avg_service_time_minutes}</p>}
          </div>
          <div>
            <label className="text-sm">Statut</label>
            <select className="w-full rounded-md border-gray-300" value={editForm.status} onChange={e=>setEditForm({...editForm, status:e.target.value})}>
              <option value="open">Ouvert</option>
              <option value="closed">Fermé</option>
            </select>
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editForm.priority_support} onChange={e=>setEditForm({...editForm, priority_support: e.target.checked})} />
            <span>Support prioritaire</span>
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn btn-secondary" onClick={()=>setOpenEdit(false)}>Annuler</button>
          <button className="btn btn-primary" onClick={updateService}>Enregistrer</button>
        </div>
      </Modal>
    </div>
  )
}
