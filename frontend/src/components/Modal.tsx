/**
 * Modal
 * Composant générique d'affichage de contenu dans une boîte de dialogue en overlay.
 * - Accessible via clavier (Esc pour fermer)
 * - Fermeture au clic sur l'overlay
 * - Tailwind pour le style
 */
import { useEffect } from 'react'

export default function Modal({ open, title, children, onClose, width = 'max-w-lg' }: {
  open: boolean
  title?: string
  children: React.ReactNode
  onClose: () => void
  width?: string
}) {
  // Fermer avec la touche ESC
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative w-full ${width} rounded-lg bg-white shadow-xl ring-1 ring-black/5`}>
        {title && <div className="border-b px-4 py-3 text-sm font-semibold">{title}</div>}
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  )
}
