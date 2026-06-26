'use server'

import { createClient } from '@/utils/supabase/server'
import { supabaseAdmin } from '@/utils/supabase/admin'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function createManualUser(data: { email: string, name: string, password: string, expiryDate: string, role: 'USER' | 'ADMIN' }) {
  try {
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    
    if (!currentUser) return { success: false, error: 'No autorizado' }

    const dbUser = await prisma.user.findUnique({ where: { email: currentUser.email } })
    if (!dbUser || (dbUser.role !== 'ADMIN' && dbUser.role !== 'SUPERADMIN')) return { success: false, error: 'Acceso denegado' }

    if (data.role === 'ADMIN' && dbUser.role !== 'SUPERADMIN') {
      return { success: false, error: 'Acceso denegado: Solo un SuperAdmin puede crear nuevos administradores.' }
    }

    // Create user in Supabase Auth via Admin API (bypasses email confirmation if configured, or just auto-confirms)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.name
      }
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
         return { success: false, error: 'El correo electrónico ya está registrado.' }
      }
      return { success: false, error: authError.message }
    }

    if (!authData.user) return { success: false, error: 'Error desconocido al crear usuario en Auth' }

    // Create user in Prisma
    const newPrismaUser = await prisma.user.create({
      data: {
        id: authData.user.id,
        email: data.email,
        name: data.name,
        role: data.role,
        isActive: true
      }
    })

    // If it's a legacy user (USER role), create a manual subscription
    if (data.role === 'USER') {
      await prisma.subscription.create({
        data: {
          userId: newPrismaUser.id,
          status: 'ACTIVE',
          currentPeriodEnd: new Date(data.expiryDate),
          cancelAtPeriodEnd: false
        }
      })
    }

    revalidatePath('/dashboard/admin/users')
    return { success: true }
  } catch (err: any) {
    console.error('Error in createManualUser:', err)
    return { success: false, error: err.message || 'Error interno del servidor' }
  }
}

export async function updateManualSubscription(userId: string, newExpiryDate: string) {
  try {
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) return { success: false, error: 'No autorizado' }

    const dbUser = await prisma.user.findUnique({ where: { email: currentUser.email } })
    if (!dbUser || (dbUser.role !== 'ADMIN' && dbUser.role !== 'SUPERADMIN')) return { success: false, error: 'Acceso denegado' }

    await prisma.subscription.upsert({
      where: { userId },
      update: {
        status: 'ACTIVE',
        currentPeriodEnd: new Date(newExpiryDate)
      },
      create: {
        userId,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(newExpiryDate),
        cancelAtPeriodEnd: false
      }
    })

    // Asegurar que el usuario esté activo si se renueva
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: true }
    })

    revalidatePath('/dashboard/admin/users')
    return { success: true }
  } catch (err: any) {
    console.error('Error in updateManualSubscription:', err)
    return { success: false, error: err.message || 'Error interno del servidor' }
  }
}

export async function toggleUserActiveStatus(userId: string, isActive: boolean) {
  try {
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) return { success: false, error: 'No autorizado' }

    const dbUser = await prisma.user.findUnique({ where: { email: currentUser.email } })
    if (!dbUser || (dbUser.role !== 'ADMIN' && dbUser.role !== 'SUPERADMIN')) return { success: false, error: 'Acceso denegado' }

    if (currentUser.id === userId) return { success: false, error: 'No puedes desactivar tu propio usuario' }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } })
    if (targetUser && (targetUser.role === 'ADMIN' || targetUser.role === 'SUPERADMIN') && dbUser.role !== 'SUPERADMIN') {
      return { success: false, error: 'Solo un SuperAdmin puede desactivar a otros administradores' }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive }
    })

    // If deactivated and it's a regular user, maybe update subscription status to PAST_DUE or CANCELED
    // But keeping it separated is fine, isActive blocks login middleware

    revalidatePath('/dashboard/admin/users')
    return { success: true }
  } catch (err: any) {
    console.error('Error in toggleUserActiveStatus:', err)
    return { success: false, error: err.message || 'Error interno del servidor' }
  }
}
