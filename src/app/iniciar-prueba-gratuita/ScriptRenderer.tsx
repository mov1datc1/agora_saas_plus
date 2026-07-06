'use client'

import { useEffect, useRef } from 'react'

export default function ScriptRenderer({ script }: { script: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || !script) return

    // Limpiar contenedor previo (por si hay re-render)
    containerRef.current.innerHTML = ''

    try {
      // createContextualFragment permite que las etiquetas <script> dentro del string se ejecuten
      const range = document.createRange()
      range.selectNode(document.getElementsByTagName("body").item(0)!)
      const fragment = range.createContextualFragment(script)
      
      containerRef.current.appendChild(fragment)
    } catch (e) {
      console.error('Error inyectando el script del CRM:', e)
      containerRef.current.innerHTML = '<p class="text-red-500 text-sm">Error cargando el formulario.</p>'
    }
  }, [script])

  return <div ref={containerRef} className="w-full form-container-ayudantex" />
}
