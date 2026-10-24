import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { Resend } from 'resend'
import { sendCrmWebhook } from '@/lib/crm'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const cronStartTime = Date.now()
  let cronLogId: string | null = null

  try {
    const authHeader = request.headers.get('authorization')
    const { searchParams } = new URL(request.url)
    const secretParam = searchParams.get('secret')

    const isCronAuthorized = Boolean(
      process.env.CRON_SECRET && 
      (authHeader === `Bearer ${process.env.CRON_SECRET}` || secretParam === process.env.CRON_SECRET)
    )

    let isAdmin = false
    try {
      const { createClient } = await import('@/utils/supabase/server')
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        const dbAdmin = await prisma.user.findUnique({ where: { email: user.email } })
        if (dbAdmin?.role === 'ADMIN' || dbAdmin?.role === 'SUPERADMIN') {
          isAdmin = true
        }
      }
    } catch {
      // Ignore if not running in authenticated browser context
    }

    if (!isCronAuthorized && !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create CronLog entry
    try {
      const cronLog = await prisma.cronLog.create({
        data: { jobName: 'check-subscriptions', status: 'RUNNING', trigger: isAdmin ? 'manual' : 'cron' }
      })
      cronLogId = cronLog.id
    } catch (logErr) {
      console.error('Failed to create CronLog:', logErr)
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0) // Normalize to start of day

    const notificationsSent: any[] = []
    const deactivatedUsers: string[] = []

    // -------------------------------------------------------------------------
    // 1. TRIAL SUBSCRIPTIONS (Stripe / Self-Serve trials expiring soon)
    // -------------------------------------------------------------------------
    const activeTrialUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        subscription: {
          status: 'TRIAL',
          trialEndsAt: { not: null }
        }
      },
      include: {
        subscription: true
      }
    })

    const trialTemplate = await prisma.emailTemplate.findUnique({ where: { type: 'REMINDER_TRIAL' } })
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.agora-lexlatin.com'
    const dashboardUrl = `${siteUrl}/dashboard`

    for (const user of activeTrialUsers) {
      if (!user.subscription?.trialEndsAt) continue

      const trialEnd = new Date(user.subscription.trialEndsAt)
      trialEnd.setHours(0, 0, 0, 0)

      const diffTime = trialEnd.getTime() - today.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      // Avisar si faltan 3, 2, 1 o 0 días y aún no se ha enviado recordatorio
      if (diffDays <= 3 && diffDays >= 0 && !user.subscription.trialReminderSentAt) {
        if (resend) {
          try {
            const subject = trialTemplate?.subject || 'Aviso: Tu prueba gratuita de Ágora Plus finaliza en 3 días'
            let html = trialTemplate?.htmlBody || `<h1>Tu prueba de Ágora Plus está por concluir</h1>\n<p>Hola {{userFirstname}},</p>\n<p>Esperamos que estés aprovechando al máximo la plataforma y las herramientas de analítica legal y financiera de Ágora Plus.</p>\n<p>Te recordamos que en <strong>${diffDays <= 1 ? '1 día' : `${diffDays} días`}</strong> finalizará tu periodo de prueba gratuita y se procesará automáticamente el cobro de tu suscripción mensual oficial a tu tarjeta registrada.</p>\n<p><a href="{{dashboardUrl}}/billing" style="background-color: #1f2937; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Ver Mi Facturación y Métodos de Pago</a></p>\n<p>Saludos,<br>Equipo Ágora Plus</p>`

            html = html.replace(/{{userFirstname}}/g, user.name && user.name !== 'Independiente' ? user.name : 'Usuario')
                       .replace(/{{dashboardUrl}}/g, dashboardUrl)

            await resend.emails.send({
              from: 'Ágora Plus <soporte@agora-lexlatin.com>',
              to: [user.email],
              subject,
              html,
            })

            await prisma.subscription.update({
              where: { id: user.subscription.id },
              data: { trialReminderSentAt: new Date() }
            })

            notificationsSent.push({ email: user.email, type: 'REMINDER_TRIAL', daysLeft: diffDays })

            // Sincronizar evento con CRM (Ayudante X / Arquitex)
            await sendCrmWebhook({
              event: 'TRIAL_EXPIRING',
              email: user.email,
              name: user.name,
              trialEndsAt: user.subscription.trialEndsAt,
            }).catch(err => console.error('[CRM Webhook] Error in trial expiring webhook:', err))

          } catch (emailErr) {
            console.error(`[CRON_RESEND_ERROR] Failed to send trial reminder to ${user.email}`, emailErr)
          }
        }
      } else if (diffDays < 0) {
        // Periodo de prueba finalizado sin conversión a suscripción activa
        await prisma.user.update({
          where: { id: user.id },
          data: { isActive: false }
        })
        await prisma.subscription.update({
          where: { id: user.subscription.id },
          data: { status: 'PAST_DUE' }
        })
        deactivatedUsers.push(user.email)

        // Sincronizar expiración con CRM
        await sendCrmWebhook({
          event: 'TRIAL_EXPIRED',
          email: user.email,
          name: user.name,
          trialEndsAt: user.subscription.trialEndsAt,
        }).catch(err => console.error('[CRM Webhook] Error in trial expired webhook:', err))
      }
    }

    // -------------------------------------------------------------------------
    // 2. ACTIVE MANUAL SUBSCRIPTIONS (Legacy / Corporate agreements)
    // -------------------------------------------------------------------------
    const activeManualUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        subscription: {
          status: 'ACTIVE',
          stripeSubscriptionId: null // It's manual
        }
      },
      include: {
        subscription: true
      }
    })

    for (const user of activeManualUsers) {
      if (!user.subscription?.currentPeriodEnd) continue

      const endDate = new Date(user.subscription.currentPeriodEnd)
      endDate.setHours(0, 0, 0, 0) // Normalize to start of day

      const diffTime = endDate.getTime() - today.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      let emailType = ''
      let subject = ''
      let message = ''

      if (diffDays === 3) {
        emailType = 'EXPIRING_3_DAYS'
        subject = 'Aviso: Tu acceso a Ágora Plus vence en 3 días'
        message = 'Tu acuerdo de acceso a la plataforma Ágora Plus expira en exactamente 3 días. Por favor, comunícate con tu asesor comercial para procesar el pago o la renovación de tu plan.'
      } else if (diffDays === 2) {
        emailType = 'EXPIRING_2_DAYS'
        subject = 'Aviso: Tu acceso a Ágora Plus vence en 2 días'
        message = 'Tu acuerdo de acceso a la plataforma Ágora Plus expira en exactamente 2 días. Para evitar la interrupción del servicio, por favor comunícate con tu asesor comercial.'
      } else if (diffDays === 1) {
        emailType = 'EXPIRING_1_DAY'
        subject = 'Urgente: Tu acceso a Ágora Plus vence MAÑANA'
        message = 'Este es el último aviso. Tu acceso a Ágora Plus expira el día de mañana. Si no se procesa tu pago, el sistema desactivará automáticamente tu cuenta.'
      } else if (diffDays === 0) {
        emailType = 'EXPIRING_TODAY'
        subject = 'Importante: Tu acceso a Ágora Plus vence HOY'
        message = 'Tu acuerdo de acceso a la plataforma Ágora Plus expira el día de hoy. Por favor, realiza el pago de inmediato para mantener tu acceso a la plataforma de analítica.'
      } else if (diffDays < 0) {
        // EXPIRED!
        // Desactivar usuario
        await prisma.user.update({
          where: { id: user.id },
          data: { isActive: false }
        })
        await prisma.subscription.update({
          where: { userId: user.id },
          data: { status: 'PAST_DUE' }
        })

        deactivatedUsers.push(user.email)

        // Sincronizar cancelación/expiración con CRM (Ayudante X / Arquitex)
        await sendCrmWebhook({
          event: 'TRIAL_EXPIRED',
          email: user.email,
          name: user.name,
          customTag: 'cancelo'
        }).catch(err => console.error('[CRM Webhook] Error in cron expiration:', err))

        emailType = 'EXPIRED_DEACTIVATED'
        subject = 'Cuenta Desactivada: Ágora Plus'
        message = 'Tu acceso a la plataforma Ágora Plus ha sido suspendido debido a la expiración de tu acuerdo. Si ya has procesado tu pago, por favor notifícalo a tu asesor comercial para reactivar tu cuenta a la brevedad.'
      }

      if (emailType && resend) {
        // Enviar correo
        try {
          await resend.emails.send({
            from: 'Ágora Plus <soporte@agora-lexlatin.com>',
            to: [user.email],
            subject: subject,
            html: `
              <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #eaeaec; border-radius: 8px; padding: 24px;">
                <h2 style="color: #1a1a1a; margin-top: 0;">Hola, ${user.name || 'Usuario'}</h2>
                <p style="color: #4a4a4a; line-height: 1.6; font-size: 16px;">
                  ${message}
                </p>
                <br/>
                <hr style="border: none; border-top: 1px solid #eaeaec; margin: 24px 0;" />
                <p style="color: #888; font-size: 12px; margin: 0;">
                  Este es un mensaje automático del sistema Ágora Plus.
                </p>
              </div>
            `
          })
          notificationsSent.push({ email: user.email, type: emailType })
        } catch (error) {
          console.error(`Failed to send email to ${user.email}`, error)
        }
      }
    }

    // Update CronLog with success
    if (cronLogId) {
      try {
        await prisma.cronLog.update({
          where: { id: cronLogId },
          data: {
            status: 'SUCCESS',
            completedAt: new Date(),
            durationMs: Date.now() - cronStartTime,
            recordsProcessed: notificationsSent.length,
            recordsSkipped: deactivatedUsers.length,
            details: JSON.stringify({ notificationsSent, deactivatedUsers })
          }
        })
      } catch (logErr) {
        console.error('Failed to update CronLog:', logErr)
      }
    }

    return NextResponse.json({ 
      success: true, 
      notificationsSent, 
      deactivatedUsers 
    })
  } catch (error: any) {
    console.error('CRON Error:', error)

    if (cronLogId) {
      try {
        await prisma.cronLog.update({
          where: { id: cronLogId },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            durationMs: Date.now() - cronStartTime,
            errorMessage: error.message || 'Unknown error',
          }
        })
      } catch (logErr) {
        console.error('Failed to update CronLog on error:', logErr)
      }
    }

    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
