'use client'

import { X, Building2, Globe, Briefcase, FileText } from 'lucide-react'

interface SectionData {
  label: string
  value: string | React.ReactNode
  count?: number
}

interface EntityDetailModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  amount?: string
  sections: SectionData[]
  iconType?: 'firm' | 'country' | 'industry'
}

export default function EntityDetailModal({ 
  isOpen, 
  onClose, 
  title, 
  subtitle, 
  amount, 
  sections,
  iconType = 'firm'
}: EntityDetailModalProps) {
  if (!isOpen) return null

  const getIcon = () => {
    switch (iconType) {
      case 'country': return <Globe className="w-6 h-6 text-brand" />
      case 'industry': return <Briefcase className="w-6 h-6 text-brand" />
      default: return <Building2 className="w-6 h-6 text-brand" />
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl max-h-[90vh] bg-surface rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-border/50 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border bg-muted/30">
          <div className="flex items-center gap-4">
            <div className="bg-brand/10 p-3 rounded-xl ring-1 ring-brand/20">
              {getIcon()}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">{title}</h2>
              {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand/50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
          
          {amount && (
            <div className="bg-brand/5 border border-brand/10 rounded-xl p-4 flex flex-col items-center justify-center text-center">
              <span className="text-sm font-semibold tracking-wider text-brand/80 uppercase">Monto Consolidado Histórico</span>
              <span className="text-3xl font-black text-foreground mt-1">{amount}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6">
            {sections.map((section, idx) => (
              <div key={idx} className="bg-surface rounded-xl border border-border p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3 border-b border-border/50 pb-2">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-wide">
                    <FileText className="w-4 h-4 text-brand/70" />
                    {section.label}
                  </h4>
                  {section.count !== undefined && (
                    <span className="bg-muted text-muted-foreground text-xs font-semibold px-2 py-1 rounded-full">
                      {section.count}
                    </span>
                  )}
                </div>
                <div className="text-sm text-foreground/80 leading-relaxed font-medium">
                  {typeof section.value === 'string' ? (
                    <p className="whitespace-pre-wrap">{section.value}</p>
                  ) : (
                    section.value
                  )}
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/10 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-foreground text-background font-semibold rounded-lg hover:bg-foreground/90 transition-colors shadow-sm"
          >
            Cerrar
          </button>
        </div>
        
      </div>
    </div>
  )
}
