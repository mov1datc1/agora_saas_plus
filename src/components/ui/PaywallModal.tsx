'use client'

import { X, Lock } from 'lucide-react'
import Link from 'next/link'

interface PaywallModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
}

export default function PaywallModal({ isOpen, onClose, title, message }: PaywallModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-surface rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 border border-border">
        <div className="flex justify-between items-start mb-4">
          <div className="bg-yellow-500/10 p-3 rounded-full text-yellow-500">
            <Lock className="w-6 h-6" />
          </div>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          {message}
        </p>

        <div className="flex flex-col gap-3">
          <Link href="/dashboard/billing" className="w-full text-center bg-brand text-white font-semibold py-3 px-4 rounded-xl hover:bg-brand/90 transition-colors shadow-sm">
            Actualizar Suscripción
          </Link>
          <button onClick={onClose} className="w-full text-center text-sm font-medium text-muted-foreground py-2 hover:text-foreground transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
