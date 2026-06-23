'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface SearchableSelectProps {
  options: string[]
  value: string
  onChange: (val: string) => void
  placeholder?: string
  label?: string
}

export default function SearchableSelect({ options, value, onChange, placeholder = "Seleccionar...", label }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Cierra el dropdown si se hace click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const filteredOptions = options.filter(opt => {
    if (typeof opt !== 'string') return false;
    return opt.toLowerCase().includes(searchTerm.toLowerCase())
  })

  const handleSelect = (opt: string) => {
    onChange(opt)
    setIsOpen(false)
    setSearchTerm('')
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {label && <label className="block text-xs font-medium text-foreground/70 mb-1">{label}</label>}
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between rounded-lg border bg-background text-sm p-2.5 outline-none transition-all duration-200 
          ${isOpen ? 'border-[#EB3159] ring-2 ring-[#EB3159]/20' : 'border-border hover:border-[#EB3159]/50'}
        `}
      >
        <span className="truncate text-foreground">{value || placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute z-50 w-full mt-2 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden"
          >
            {/* Search Input */}
            <div className="p-2 border-b border-border bg-muted/30">
              <div className="relative flex items-center">
                <Search className="absolute left-2.5 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  className="w-full bg-background border border-border rounded-md pl-8 pr-3 py-1.5 text-sm outline-none focus:border-[#EB3159] focus:ring-1 focus:ring-[#EB3159] transition-all"
                  placeholder="Buscar filtro..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            {/* Options List */}
            <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <div
                    key={opt}
                    onClick={() => handleSelect(opt)}
                    className={`flex items-center justify-between w-full px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors
                      ${value === opt 
                        ? 'bg-[#EB3159]/10 text-[#EB3159] font-medium' 
                        : 'text-foreground hover:bg-muted'
                      }
                    `}
                  >
                    <span className="truncate">{opt}</span>
                    {value === opt && <Check className="w-4 h-4" />}
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No se encontraron resultados
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
