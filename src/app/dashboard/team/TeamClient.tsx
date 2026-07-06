'use client'

import { useState } from 'react'
import { inviteTeamMember, removeTeamMember } from './actions'
import { Plus, Trash2, Mail, User as UserIcon, AlertCircle, Copy, Check } from 'lucide-react'

interface TeamMember {
  id: string
  name: string
  email: string
  createdAt: string
}

export default function TeamClient({ teamMembers }: { teamMembers: TeamMember[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  
  const [successData, setSuccessData] = useState<{email: string, pass: string} | null>(null)
  const [copied, setCopied] = useState(false)

  const canInvite = teamMembers.length < 4

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')
    setSuccessData(null)

    const result = await inviteTeamMember({ email, name })
    
    if (result.success) {
      setSuccessData({ email, pass: result.tempPassword! })
      setIsOpen(false)
      setName('')
      setEmail('')
    } else {
      setError(result.error || 'Ocurrió un error')
    }
    
    setIsSubmitting(false)
  }

  const handleRemove = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar a este usuario de tu equipo? Perderá el acceso de inmediato.')) return
    
    const result = await removeTeamMember(id)
    if (!result.success) {
      alert(result.error)
    }
  }

  const copyCredentials = () => {
    if (successData) {
      navigator.clipboard.writeText(`¡Hola!\nTienes acceso a Ágora Plus.\nLink: https://agora-plus.com/login\nCorreo: ${successData.email}\nContraseña Temporal: ${successData.pass}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    }
  }

  return (
    <div className="space-y-6">
      {successData && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-4 border border-emerald-200 dark:border-emerald-800">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">Usuario creado exitosamente</h3>
              <div className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
                <p>Copia estas credenciales y envíaselas de forma segura a tu colega para que pueda ingresar:</p>
                <div className="mt-2 font-mono bg-white dark:bg-emerald-950 p-3 rounded-lg border border-emerald-100 dark:border-emerald-800">
                  <p><strong>Correo:</strong> {successData.email}</p>
                  <p><strong>Contraseña Temporal:</strong> {successData.pass}</p>
                </div>
              </div>
            </div>
            <button
              onClick={copyCredentials}
              className="flex items-center gap-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiado' : 'Copiar Credenciales'}
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => setIsOpen(true)}
          disabled={!canInvite}
          className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" />
          Invitar Colega
        </button>
      </div>

      <div className="bg-surface shadow-sm ring-1 ring-border sm:rounded-xl overflow-hidden">
        <table className="min-w-full divide-y divide-border">
          <thead>
            <tr>
              <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">Nombre</th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Correo Electrónico</th>
              <th className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Fecha de Unión</th>
              <th className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {teamMembers.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-foreground/50">
                  Aún no has invitado a nadie. Tienes 4 espacios disponibles.
                </td>
              </tr>
            ) : (
              teamMembers.map((member) => (
                <tr key={member.id}>
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-foreground sm:pl-6">
                    {member.name}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-foreground/70">
                    {member.email}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-foreground/70">
                    {new Date(member.createdAt).toLocaleDateString()}
                  </td>
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <button
                      onClick={() => handleRemove(member.id)}
                      className="text-red-500 hover:text-red-700 transition-colors inline-flex items-center gap-1"
                      title="Eliminar acceso"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remover
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md overflow-hidden ring-1 ring-border">
            <div className="p-6">
              <h3 className="text-lg font-bold text-foreground mb-4">Invitar Nuevo Colega</h3>
              <p className="text-sm text-foreground/60 mb-6">
                Agrega a un miembro de tu firma. Se le generará una contraseña temporal que podrás enviarle.
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-2 border border-red-200 dark:border-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Nombre Completo
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <UserIcon className="h-4 w-4 text-foreground/40" />
                    </div>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="block w-full pl-10 rounded-lg border-0 py-2 bg-muted/50 text-foreground ring-1 ring-inset ring-border placeholder:text-foreground/40 focus:ring-2 focus:ring-inset focus:ring-brand sm:text-sm sm:leading-6"
                      placeholder="Ej. María Pérez"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Correo Electrónico (Corporativo)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-foreground/40" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-10 rounded-lg border-0 py-2 bg-muted/50 text-foreground ring-1 ring-inset ring-border placeholder:text-foreground/40 focus:ring-2 focus:ring-inset focus:ring-brand sm:text-sm sm:leading-6"
                      placeholder="maria@tu-firma.com"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors ring-1 ring-inset ring-border"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 rounded-lg bg-brand px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
                  >
                    {isSubmitting ? 'Generando...' : 'Crear Acceso'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
