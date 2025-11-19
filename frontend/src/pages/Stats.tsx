/**
 * Statistiques (Admin)
 * - Vue d'ensemble (overview) et statistiques par service.
 * - Consomme /api/admin/stats/overview et /api/admin/stats/services/{id}
 */
import { useEffect, useState } from 'react'
import { api } from '@/api/axios'
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts'

export default function Stats(){
  const [overview, setOverview] = useState<any>(null)
  const [serviceId, setServiceId] = useState<number | ''>('' as any)
  const [serviceStats, setServiceStats] = useState<any>(null)

  useEffect(()=>{ api.get('/api/admin/stats/overview').then(r=>setOverview(r.data)).catch(()=>setOverview(null)) },[])
  useEffect(()=>{ if(serviceId) api.get(`/api/admin/stats/services/${serviceId}`).then(r=>setServiceStats(r.data)) },[serviceId])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="card"><div className="card-header">Créés</div><div className="card-body text-2xl font-bold">{overview?.tickets?.created ?? '—'}</div></div>
        <div className="card"><div className="card-header">Clos</div><div className="card-body text-2xl font-bold">{overview?.tickets?.closed ?? '—'}</div></div>
        <div className="card"><div className="card-header">Absents</div><div className="card-body text-2xl font-bold">{overview?.tickets?.absent ?? '—'}</div></div>
        <div className="card"><div className="card-header">Attente moyenne</div><div className="card-body text-2xl font-bold">{overview?.tickets?.wait_avg_minutes ?? '—'} min</div></div>
      </div>

      <div className="card">
        <div className="card-header">Statistiques par service</div>
        <div className="card-body space-y-3">
          <input className="w-40 rounded-md border-gray-300" value={serviceId as any} onChange={e=>setServiceId(Number(e.target.value)||'' as any)} placeholder="Service ID" />
          {serviceStats && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="card"><div className="card-header">Créés</div><div className="card-body text-2xl font-bold">{serviceStats.tickets?.created ?? '—'}</div></div>
              <div className="card"><div className="card-header">Clos</div><div className="card-body text-2xl font-bold">{serviceStats.tickets?.closed ?? '—'}</div></div>
              <div className="card"><div className="card-header">Absents</div><div className="card-body text-2xl font-bold">{serviceStats.tickets?.absent ?? '—'}</div></div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
