'use server'

import { createClient } from '@/utils/supabase/server'

export async function changeOwnPassword(data: { currentPassword: string, newPassword: string }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return { success: false, error: 'No autorizado' }

    // Verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: data.currentPassword,
    })

    if (signInError) {
      return { success: false, error: 'La contraseña actual es incorrecta.' }
    }

    // Update password
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
