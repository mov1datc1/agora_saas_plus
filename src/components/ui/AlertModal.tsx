'use client'

import { X, AlertCircle } from 'lucide-react'

interface AlertModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
}

export default function AlertModal({ isOpen, onClose, title, message }: AlertModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-surface rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 border border-border">
        <div className="flex justify-between items-start mb-4">
          <div className="bg-red-500/10 p-3 rounded-full text-red-500">
            <AlertCircle className="w-6 h-6" />
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
          <button onClick={onClose} className="w-full text-center bg-foreground text-background font-semibold py-3 px-4 rounded-xl hover:bg-foreground/90 transition-colors shadow-sm">
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
