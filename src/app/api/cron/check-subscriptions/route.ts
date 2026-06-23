import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0) // Normalize to start of day

    // Get all active manual subscriptions
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

    const notificationsSent = []
    const deactivatedUsers = []

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

        emailType = 'EXPIRED_DEACTIVATED'
        subject = 'Cuenta Desactivada: Ágora Plus'
        message = 'Tu acceso a la plataforma Ágora Plus ha sido suspendido debido a la expiración de tu acuerdo. Si ya has procesado tu pago, por favor notifícalo a tu asesor comercial para reactivar tu cuenta a la brevedad.'
      }

      if (emailType && process.env.RESEND_API_KEY) {
        // Enviar correo
        try {
          await resend.emails.send({
            from: 'Agora Plus <no-reply@mail.agoraplus.app>', // Change to your verified Resend domain
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

    return NextResponse.json({ 
      success: true, 
      notificationsSent, 
      deactivatedUsers 
    })
  } catch (error: any) {
    console.error('CRON Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
