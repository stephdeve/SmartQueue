export default function Settings(){
  return (
    <div className="card">
      <div className="card-header">Paramètres</div>
      <div className="card-body space-y-2 text-sm">
        <div>API: <code>{import.meta.env.VITE_API_BASE_URL}</code></div>
        <div>Pusher Host: <code>{import.meta.env.VITE_PUSHER_HOST}</code></div>
        <div>Pusher Port: <code>{import.meta.env.VITE_PUSHER_PORT}</code></div>
      </div>
    </div>
  )
}
