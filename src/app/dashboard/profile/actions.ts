'use server'

import { createClient } from '@/utils/supabase/server'

export async function changeOwnPassword(data: { currentPassword?: string, newPassword: string }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return { success: false, error: 'No autorizado' }

    // Verify current password only if provided
    if (data.currentPassword && data.currentPassword.trim() !== '') {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: data.currentPassword.trim(),
      })

      if (signInError) {
        return { success: false, error: 'La contraseña actual es incorrecta.' }
      }
    }

    // Update password directly in Supabase Auth
    const { error: updateError } = await supabase.auth.updateUser({
      password: data.newPassword
    })

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    return { success: true }
  } catch (err: any) {
    console.error('Error in changeOwnPassword:', err)
    return { success: false, error: err.message || 'Error interno del servidor' }
  }
}
