/**
 * Établissements (Admin)
 * Modals de création/édition pour gérer les établissements.
 * - GET /api/admin/establishments
 * - POST /api/admin/establishments
 * - PUT /api/admin/establishments/{id}
 * Champs: name, address, lat, lng, open_at, close_at, is_active
 */
import { useEffect, useState } from 'react'
import { api } from '@/api/axios'
import DataTable from '@/components/DataTable'
import Modal from '@/components/Modal'
import { z } from 'zod'
import { toast } from 'react-hot-toast'

type Establishment = { id:number; name:string; address?:string|null; lat?:number|null; lng?:number|null; open_at?:string|null; close_at?:string|null; is_active?:boolean }

export default function Establishments(){
  const [rows, setRows] = useState<Establishment[]>([])
  const [openCreate, setOpenCreate] = useState(false)
  const [openEdit, setOpenEdit] = useState(false)
  const [editing, setEditing] = useState<Establishment | null>(null)

  const [createForm, setCreateForm] = useState<Establishment>({ id:0, name:'', address:'', lat:null, lng:null, open_at:'', close_at:'', is_active:true })
  const [editForm, setEditForm] = useState<Establishment>({ id:0, name:'', address:'', lat:null, lng:null, open_at:'', close_at:'', is_active:true })
  const [createErrors, setCreateErrors] = useState<Record<string,string>>({})
  const [editErrors, setEditErrors] = useState<Record<string,string>>({})

  // Validation Zod pour établissement
  const estSchema = z.object({
    name: z.string().min(2, 'Nom trop court'),
    address: z.string().optional(),
    lat: z.number().nullable().optional(),
    lng: z.number().nullable().optional(),
    open_at: z.string().optional(),
    close_at: z.string().optional(),
    is_active: z.boolean().optional()
  })

  const load = () => api.get('/api/admin/establishments?per_page=50').then(r=> setRows(r.data.data || r.data))
  useEffect(()=>{ load() },[])

  /** Ouvre le modal d'édition avec données existantes. */
  const openEditModal = (e: Establishment) => {
    setEditing(e)
    setEditForm({
      id: e.id,
      name: e.name,
      address: e.address || '',
      lat: e.lat ?? null,
      lng: e.lng ?? null,
      open_at: e.open_at || '',
      close_at: e.close_at || '',
      is_active: e.is_active ?? true
    })
    setOpenEdit(true)
  }

  /** Création d'un établissement. */
  const createEst = async () => {
    setCreateErrors({})
    const { id, ...payload } = createForm
    const parsed = estSchema.safeParse(payload)
    if (!parsed.success) {
      const errs: Record<string,string> = {}
      parsed.error.issues.forEach(i=>{ if(i.path[0]) errs[String(i.path[0])] = i.message })
      setCreateErrors(errs); toast.error('Veuillez corriger le formulaire'); return
    }
    try {
      await api.post('/api/admin/establishments', parsed.data)
      toast.success('Établissement créé')
      setOpenCreate(false)
      setCreateForm({ id:0, name:'', address:'', lat:null, lng:null, open_at:'', close_at:'', is_active:true })
      load()
    } catch(e:any) {
      toast.error(e?.response?.data?.error?.message || 'Erreur de création')
    }
  }

  /** Mise à jour d'un établissement. */
  const updateEst = async () => {
    if (!editing) return
    setEditErrors({})
    const { id, ...payload } = editForm
    const parsed = estSchema.safeParse(payload)
    if (!parsed.success) {
      const errs: Record<string,string> = {}
      parsed.error.issues.forEach(i=>{ if(i.path[0]) errs[String(i.path[0])] = i.message })
      setEditErrors(errs); toast.error('Veuillez corriger le formulaire'); return
    }
    try {
      await api.put(`/api/admin/establishments/${editing.id}`, parsed.data)
      toast.success('Établissement mis à jour')
      setOpenEdit(false)
      setEditing(null)
      load()
    } catch(e:any) {
      toast.error(e?.response?.data?.error?.message || 'Erreur de mise à jour')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Établissements</h1>
        <button className="btn btn-primary" onClick={()=>setOpenCreate(true)}>Nouvel établissement</button>
      </div>

      <DataTable columns={[
        { key:'id', header:'ID' },
        { key:'name', header:'Nom' },
        { key:'address', header:'Adresse' },
        { key:'is_active', header:'Actif' },
        { key:'actions', header:'Actions', render:(r:Establishment)=> (
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={()=>openEditModal(r)}>Éditer</button>
            <button className="btn btn-secondary" onClick={async ()=>{
              if (!confirm(`Supprimer l'établissement ${r.name} ?`)) return
              try { await api.delete(`/api/admin/establishments/${r.id}`); toast.success('Établissement supprimé'); load() } catch(e:any){ toast.error(e?.response?.data?.error?.message || 'Suppression impossible') }
            }}>Supprimer</button>
          </div>
        )},
      ]} data={rows} />

      {/* Modal Création */}
      <Modal open={openCreate} onClose={()=>setOpenCreate(false)} title="Créer un établissement">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-sm">Nom</label>
            <input className="w-full rounded-md border-gray-300" value={createForm.name} onChange={e=>setCreateForm({...createForm, name:e.target.value})} />
            {createErrors.name && <p className="text-xs text-red-600">{createErrors.name}</p>}
          </div>
          <div className="md:col-span-2">
            <label className="text-sm">Adresse</label>
            <input className="w-full rounded-md border-gray-300" value={createForm.address ?? ''} onChange={e=>setCreateForm({...createForm, address:e.target.value})} />
          </div>
          <div>
            <label className="text-sm">Latitude</label>
            <input type="number" step="any" className="w-full rounded-md border-gray-300" value={createForm.lat ?? ''} onChange={e=>setCreateForm({...createForm, lat: e.target.value===''? null : Number(e.target.value)})} />
          </div>
          <div>
            <label className="text-sm">Longitude</label>
            <input type="number" step="any" className="w-full rounded-md border-gray-300" value={createForm.lng ?? ''} onChange={e=>setCreateForm({...createForm, lng: e.target.value===''? null : Number(e.target.value)})} />
          </div>
          <div>
            <label className="text-sm">Ouverture</label>
            <input placeholder="08:00:00" className="w-full rounded-md border-gray-300" value={createForm.open_at ?? ''} onChange={e=>setCreateForm({...createForm, open_at:e.target.value})} />
          </div>
          <div>
            <label className="text-sm">Fermeture</label>
            <input placeholder="17:00:00" className="w-full rounded-md border-gray-300" value={createForm.close_at ?? ''} onChange={e=>setCreateForm({...createForm, close_at:e.target.value})} />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!createForm.is_active} onChange={e=>setCreateForm({...createForm, is_active: e.target.checked})} />
            <span>Actif</span>
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn btn-secondary" onClick={()=>setOpenCreate(false)}>Annuler</button>
          <button className="btn btn-primary" onClick={createEst}>Créer</button>
        </div>
      </Modal>

      {/* Modal Édition */}
      <Modal open={openEdit} onClose={()=>setOpenEdit(false)} title={`Éditer ${editing?.name ?? ''}`}>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-sm">Nom</label>
            <input className="w-full rounded-md border-gray-300" value={editForm.name} onChange={e=>setEditForm({...editForm, name:e.target.value})} />
            {editErrors.name && <p className="text-xs text-red-600">{editErrors.name}</p>}
          </div>
          <div className="md:col-span-2">
            <label className="text-sm">Adresse</label>
            <input className="w-full rounded-md border-gray-300" value={editForm.address ?? ''} onChange={e=>setEditForm({...editForm, address:e.target.value})} />
          </div>
          <div>
            <label className="text-sm">Latitude</label>
            <input type="number" step="any" className="w-full rounded-md border-gray-300" value={editForm.lat ?? ''} onChange={e=>setEditForm({...editForm, lat: e.target.value===''? null : Number(e.target.value)})} />
          </div>
          <div>
            <label className="text-sm">Longitude</label>
            <input type="number" step="any" className="w-full rounded-md border-gray-300" value={editForm.lng ?? ''} onChange={e=>setEditForm({...editForm, lng: e.target.value===''? null : Number(e.target.value)})} />
          </div>
          <div>
            <label className="text-sm">Ouverture</label>
            <input placeholder="08:00:00" className="w-full rounded-md border-gray-300" value={editForm.open_at ?? ''} onChange={e=>setEditForm({...editForm, open_at:e.target.value})} />
          </div>
          <div>
            <label className="text-sm">Fermeture</label>
            <input placeholder="17:00:00" className="w-full rounded-md border-gray-300" value={editForm.close_at ?? ''} onChange={e=>setEditForm({...editForm, close_at:e.target.value})} />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!editForm.is_active} onChange={e=>setEditForm({...editForm, is_active: e.target.checked})} />
            <span>Actif</span>
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn btn-secondary" onClick={()=>setOpenEdit(false)}>Annuler</button>
          <button className="btn btn-primary" onClick={updateEst}>Enregistrer</button>
        </div>
      </Modal>
    </div>
  )
}
