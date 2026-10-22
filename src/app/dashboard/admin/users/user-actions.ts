'use server'

import { createClient } from '@/utils/supabase/server'
import { supabaseAdmin } from '@/utils/supabase/admin'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function createManualUser(data: { email: string, name: string, password: string, expiryDate: string, role: 'USER' | 'ADMIN', accountType?: string }) {
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
        accountType: (data.accountType as any) || 'INDIVIDUAL',
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

export async function resetUserPassword(userId: string) {
  try {
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) return { success: false, error: 'No autorizado' }

    const dbUser = await prisma.user.findUnique({ where: { email: currentUser.email } })
    if (!dbUser || (dbUser.role !== 'ADMIN' && dbUser.role !== 'SUPERADMIN')) return { success: false, error: 'Acceso denegado' }

    // Generate a secure temporary password
    const tempPassword = 'Agora' + Math.random().toString(36).slice(-6).toUpperCase() + '!'

    // Update password via Supabase Admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: tempPassword
    })

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    revalidatePath('/dashboard/admin/users')
    return { success: true, tempPassword }
  } catch (err: any) {
    console.error('Error in resetUserPassword:', err)
    return { success: false, error: err.message || 'Error interno del servidor' }
  }
}

export async function promoteUserToLegacy(userId: string, accountType: string, expiryDate: string) {
  try {
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) return { success: false, error: 'No autorizado' }

    const dbUser = await prisma.user.findUnique({ where: { email: currentUser.email } })
    if (!dbUser || dbUser.role !== 'SUPERADMIN') {
      return { success: false, error: 'Acceso denegado: Solo un SuperAdmin puede promover usuarios.' }
    }

    // Verify the target user exists
    const targetUser = await prisma.user.findUnique({ where: { id: userId } })
    if (!targetUser) return { success: false, error: 'Usuario no encontrado.' }

    // Update accountType and activate
    await prisma.user.update({
      where: { id: userId },
      data: {
        accountType: accountType as any,
        isActive: true,
      }
    })

    // Create or update manual subscription (Legacy = ACTIVE without Stripe)
    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(expiryDate),
        cancelAtPeriodEnd: false,
      },
      update: {
        status: 'ACTIVE',
        currentPeriodEnd: new Date(expiryDate),
        cancelAtPeriodEnd: false,
        stripeSubscriptionId: null,
      }
    })

    revalidatePath('/dashboard/admin/users')
    return { success: true }
  } catch (err: any) {
    console.error('Error in promoteUserToLegacy:', err)
    return { success: false, error: err.message || 'Error interno del servidor' }
  }
}

export async function sendTrialReminderManually(userId: string) {
  try {
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) return { success: false, error: 'No autorizado' }

    const dbAdmin = await prisma.user.findUnique({ where: { email: currentUser.email } })
    if (!dbAdmin || (dbAdmin.role !== 'ADMIN' && dbAdmin.role !== 'SUPERADMIN')) {
      return { success: false, error: 'Acceso denegado' }
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true }
    })

    if (!targetUser) return { success: false, error: 'Usuario no encontrado' }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return { success: false, error: 'RESEND_API_KEY no configurada' }
    }

    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)

    const template = await prisma.emailTemplate.findUnique({ where: { type: 'REMINDER_TRIAL' } })
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.agora-lexlatin.com'
    const dashboardUrl = `${siteUrl}/dashboard`

    const subject = template?.subject || 'Aviso: Tu prueba gratuita de Ágora Plus finaliza en 3 días'
    let html = template?.htmlBody || `<h1>Tu prueba de Ágora Plus está por concluir</h1>\n<p>Hola {{userFirstname}},</p>\n<p>Esperamos que estés aprovechando al máximo la plataforma y las herramientas de analítica legal y financiera de Ágora Plus.</p>\n<p>Te recordamos que tu periodo de prueba gratuita está por concluir y se procesará automáticamente el cobro de tu suscripción mensual oficial a tu tarjeta registrada.</p>\n<p><a href="{{dashboardUrl}}/billing" style="background-color: #1f2937; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Ver Mi Facturación y Métodos de Pago</a></p>\n<p>Saludos,<br>Equipo Ágora Plus</p>`

    html = html.replace(/{{userFirstname}}/g, targetUser.name && targetUser.name !== 'Independiente' ? targetUser.name : 'Usuario')
               .replace(/{{dashboardUrl}}/g, dashboardUrl)

    const emailRes = await resend.emails.send({
      from: 'Ágora Plus <soporte@agora-lexlatin.com>',
      to: [targetUser.email],
      subject,
      html,
    })

    if (emailRes.error) {
      return { success: false, error: emailRes.error.message }
    }

    if (targetUser.subscription) {
      await prisma.subscription.update({
        where: { id: targetUser.subscription.id },
        data: { trialReminderSentAt: new Date() }
      })
    }

    const { sendCrmWebhook } = await import('@/lib/crm')
    await sendCrmWebhook({
      event: 'TRIAL_EXPIRING',
      email: targetUser.email,
      name: targetUser.name,
      trialEndsAt: targetUser.subscription?.trialEndsAt,
    }).catch(err => console.error('[CRM_WEBHOOK_ERROR]', err))

    revalidatePath('/dashboard/admin/users')
    return { success: true, message: `Recordatorio de prueba enviado exitosamente a ${targetUser.email}` }
  } catch (err: any) {
    console.error('Error in sendTrialReminderManually:', err)
    return { success: false, error: err.message || 'Error al enviar recordatorio' }
  }
}
