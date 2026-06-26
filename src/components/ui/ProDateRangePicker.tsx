'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronDown, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface DateRange {
  start: string
  end: string
}

interface ProDateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
}

export default function ProDateRangePicker({ value, onChange }: ProDateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [activePreset, setActivePreset] = useState<string>('Personalizado')

  // Detect clicks outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Presets Definition
  const applyPreset = (preset: string) => {
    const today = new Date()
    let start = ''
    let end = ''

    if (preset !== 'Personalizado') {
      end = today.toISOString().split('T')[0]
    }

    switch (preset) {
      case 'Mes pasado':
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate())
        start = lastMonth.toISOString().split('T')[0]
        break
      case 'Últimos 3 meses':
        const last3Months = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate())
        start = last3Months.toISOString().split('T')[0]
        break
      case 'Últimos 6 meses':
        const last6Months = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate())
        start = last6Months.toISOString().split('T')[0]
        break
      case 'Este año':
        start = `${today.getFullYear()}-01-01`
        break
      case 'El año pasado':
        start = `${today.getFullYear() - 1}-01-01`
        end = `${today.getFullYear() - 1}-12-31`
        break
      case 'Todos los tiempos':
        start = ''
        end = ''
        break
      case 'Personalizado':
        // Keep existing values but don't force change
        start = value.start
        end = value.end
        break
    }

    setActivePreset(preset)
    onChange({ start, end })
    
    // Si no es personalizado, podemos cerrar el dropdown automáticamente para mejor UX
    if (preset !== 'Personalizado') {
      setIsOpen(false)
    }
  }

  // Determine label to display
  let displayLabel = "Seleccionar fechas"
  if (activePreset !== 'Personalizado') {
    displayLabel = activePreset
  } else if (value.start && value.end) {
    displayLabel = `${value.start} a ${value.end}`
  } else if (value.start) {
    displayLabel = `Desde ${value.start}`
  } else if (value.end) {
    displayLabel = `Hasta ${value.end}`
  } else {
    displayLabel = "Todas las fechas"
  }

  const presets = [
    'Todos los tiempos',
    'Mes pasado',
    'Últimos 3 meses',
    'Últimos 6 meses',
    'Este año',
    'El año pasado',
    'Personalizado'
  ]

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-3 bg-surface border rounded-xl px-3 py-2.5 text-sm font-medium shadow-sm transition-all duration-200 outline-none w-full sm:w-[220px] ${
          isOpen ? 'border-brand ring-1 ring-brand/20' : 'border-border hover:border-brand/50'
        }`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <Calendar className="h-4 w-4 text-brand shrink-0" />
          <span className="truncate text-foreground">{displayLabel}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute z-50 mt-2 right-0 w-[300px] sm:w-[350px] bg-surface border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col sm:flex-row"
          >
            {/* Sidebar Presets */}
            <div className="w-full sm:w-[150px] bg-muted/30 border-b sm:border-b-0 sm:border-r border-border py-2">
              {presets.map(preset => (
                <button
                  key={preset}
                  onClick={() => applyPreset(preset)}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between ${
                    activePreset === preset ? 'bg-brand/10 text-brand font-semibold' : 'text-foreground hover:bg-muted'
                  }`}
                >
                  <span className="truncate">{preset}</span>
                  {activePreset === preset && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              ))}
            </div>

            {/* Custom Range Inputs */}
            <div className={`p-4 flex-1 flex flex-col justify-center gap-4 transition-opacity ${activePreset === 'Personalizado' ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Fecha Inicial</label>
                <input 
                  type="date" 
                  className="w-full bg-background border border-border rounded-lg text-sm px-3 py-2 outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-all cursor-pointer"
                  value={value.start}
                  onChange={(e) => {
                    setActivePreset('Personalizado')
                    onChange({ ...value, start: e.target.value })
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Fecha Final</label>
                <input 
                  type="date" 
                  className="w-full bg-background border border-border rounded-lg text-sm px-3 py-2 outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-all cursor-pointer"
                  value={value.end}
                  onChange={(e) => {
                    setActivePreset('Personalizado')
                    onChange({ ...value, end: e.target.value })
                  }}
                />
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="mt-2 w-full bg-foreground text-background py-2 rounded-lg text-sm font-semibold hover:bg-foreground/80 transition-colors"
              >
                Aplicar Rango
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
