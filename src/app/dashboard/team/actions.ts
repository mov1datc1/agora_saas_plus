'use server'

import { createClient } from '@/utils/supabase/server'
import { supabaseAdmin } from '@/utils/supabase/admin'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function inviteTeamMember(data: { email: string, name: string, password?: string }) {
  try {
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    
    if (!currentUser) return { success: false, error: 'No autorizado' }

    const dbUser = await prisma.user.findUnique({ 
      where: { email: currentUser.email },
      include: { children: true, subscription: true }
    })

    if (!dbUser || dbUser.accountType !== 'CORPORATE' || dbUser.parentId) {
      return { success: false, error: 'Acceso denegado. Solo titulares de cuentas corporativas pueden invitar.' }
    }

    if (dbUser.children.length >= 4) {
      return { success: false, error: 'Has alcanzado el límite de 5 usuarios por cuenta (1 titular + 4 invitados).' }
    }

    // Usar la contraseña provista o generar una aleatoria segura
    const tempPassword = data.password || Math.random().toString(36).slice(-10) + 'A1!'

    // Crear el usuario en Supabase
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: data.name
      }
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
         return { success: false, error: 'Este correo electrónico ya está registrado en Ágora.' }
      }
      return { success: false, error: authError.message }
    }

    if (!authData.user) return { success: false, error: 'Error al crear usuario.' }

    // Crear en Prisma DB
    const newPrismaUser = await prisma.user.create({
      data: {
        id: authData.user.id,
        email: data.email,
        name: data.name,
        role: 'USER',
        accountType: 'CORPORATE',
        parentId: dbUser.id,
        isActive: true
      }
    })

    // Heredar la suscripción del titular
    if (dbUser.subscription) {
      await prisma.subscription.create({
        data: {
          userId: newPrismaUser.id,
          status: 'ACTIVE',
          currentPeriodEnd: dbUser.subscription.currentPeriodEnd,
          cancelAtPeriodEnd: false
        }
      })
    }

    revalidatePath('/dashboard/team')
    return { success: true, tempPassword }
  } catch (err: any) {
    console.error('Error in inviteTeamMember:', err)
    return { success: false, error: err.message || 'Error interno del servidor' }
  }
}

export async function removeTeamMember(childId: string) {
  try {
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) return { success: false, error: 'No autorizado' }

    const dbUser = await prisma.user.findUnique({ where: { email: currentUser.email } })
    if (!dbUser || dbUser.accountType !== 'CORPORATE') return { success: false, error: 'Acceso denegado' }

    const targetChild = await prisma.user.findUnique({ where: { id: childId } })
    if (!targetChild || targetChild.parentId !== dbUser.id) {
      return { success: false, error: 'El usuario no pertenece a tu equipo.' }
    }

    // Eliminar completamente de la BD y Supabase (o solo desactivar, pero liberar asiento)
    await prisma.user.delete({ where: { id: childId } })
    await supabaseAdmin.auth.admin.deleteUser(childId)

    revalidatePath('/dashboard/team')
    return { success: true }
  } catch (err: any) {
    console.error('Error in removeTeamMember:', err)
    return { success: false, error: err.message || 'Error interno del servidor' }
  }
}
