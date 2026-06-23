'use client'

import { X, AlertCircle, Loader2 } from 'lucide-react'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  isLoading?: boolean
}

export default function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  isLoading = false
}: ConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-surface rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 border border-border">
        <div className="flex justify-between items-start mb-4">
          <div className="bg-[#E05C50]/10 p-3 rounded-full text-[#E05C50]">
            <AlertCircle className="w-6 h-6" />
          </div>
          <button onClick={onClose} disabled={isLoading} className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          {message}
        </p>

        <div className="flex gap-3">
          <button 
            onClick={onClose} 
            disabled={isLoading}
            className="flex-1 text-center bg-muted text-foreground font-semibold py-3 px-4 rounded-xl hover:bg-muted/80 transition-colors shadow-sm disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm} 
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 bg-[#E05C50] text-white font-semibold py-3 px-4 rounded-xl hover:bg-[#D92B4F] transition-colors shadow-sm disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isLoading ? "Iniciando..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
