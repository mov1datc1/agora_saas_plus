import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import prisma from '@/lib/prisma'
// SubscriptionStatus enum values (Prisma adapter mode doesn't export enums)
const SubscriptionStatus = {
  TRIAL: 'TRIAL' as const,
  ACTIVE: 'ACTIVE' as const,
  CANCELED: 'CANCELED' as const,
  PAST_DUE: 'PAST_DUE' as const,
  INCOMPLETE: 'INCOMPLETE' as const,
}
import { Resend } from 'resend'
import WelcomeEmail from '@/emails/WelcomeEmail'
import DunningEmail from '@/emails/DunningEmail'

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy')

export async function POST(req: Request) {
  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get('Stripe-Signature') as string

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    )
  } catch (error: any) {
    console.error(`[WEBHOOK_ERROR] ${error.message}`)
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const subscription = event.data.object as Stripe.Subscription

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        if (session.subscription) {
          const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription as string)
          const customerEmail = session.customer_details?.email
          
          if (!customerEmail) {
            console.error('[WEBHOOK_ERROR] No email found in session')
            break;
          }

          let dbUser = await prisma.user.findUnique({
            where: { email: customerEmail }
          })
          
          let inviteUrl = ''
          
          if (!dbUser) {
            // Auto-signup flow: create user in Supabase Auth using generateLink to bypass Supabase SMTP
            const { supabaseAdmin } = await import('@/utils/supabase/admin')
            let userId = ''
            
            const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
              type: 'invite',
              email: customerEmail,
            })
            
            if (linkError) {
              // If user already exists, generateLink for invite throws an error. We fallback to fetching their ID.
              const { data: listData } = await supabaseAdmin.auth.admin.listUsers()
              const existing = listData?.users?.find(u => u.email === customerEmail)
              
              if (existing) {
                userId = existing.id
                // El usuario ya existe, le generamos un magic link para que pueda entrar
                const { data: magicLinkData } = await supabaseAdmin.auth.admin.generateLink({
                  type: 'magiclink',
                  email: customerEmail,
                })
                if (magicLinkData?.properties?.action_link) {
                  inviteUrl = magicLinkData.properties.action_link
                }
              } else {
                console.error('[WEBHOOK_AUTH_ERROR]', linkError)
                throw new Error(`Auth Error: ${linkError?.message || 'Failed to create user in Supabase'}`);
              }
            } else if (linkData.user) {
              userId = linkData.user.id
              inviteUrl = linkData.properties?.action_link || ''
            }

            if (!userId) throw new Error('Failed to resolve user ID from Supabase');

            dbUser = await prisma.user.create({
              data: {
                id: userId,
                email: customerEmail,
                name: session.customer_details?.name || customerEmail.split('@')[0],
                role: 'USER',
                stripeCustomerId: session.customer as string,
              }
            })
          } else if (!dbUser.stripeCustomerId) {
            dbUser = await prisma.user.update({
              where: { id: dbUser.id },
              data: { stripeCustomerId: session.customer as string }
            })
          }
          
          if (dbUser) {
            await prisma.subscription.upsert({
              where: { userId: dbUser.id },
              create: {
                userId: dbUser.id,
                stripeSubscriptionId: stripeSubscription.id,
                status: stripeSubscription.status === 'trialing' ? SubscriptionStatus.TRIAL : SubscriptionStatus.ACTIVE,
                priceId: stripeSubscription.items.data[0].price.id,
                trialEndsAt: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
                currentPeriodEnd: new Date(((stripeSubscription as any).current_period_end || stripeSubscription.trial_end || stripeSubscription.created || Math.floor(Date.now() / 1000)) * 1000),
                cancelAtPeriodEnd: Boolean((stripeSubscription as any).cancel_at_period_end),
              },
              update: {
                stripeSubscriptionId: stripeSubscription.id,
                status: stripeSubscription.status === 'trialing' ? SubscriptionStatus.TRIAL : SubscriptionStatus.ACTIVE,
                priceId: stripeSubscription.items.data[0].price.id,
                trialEndsAt: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
                currentPeriodEnd: new Date(((stripeSubscription as any).current_period_end || stripeSubscription.trial_end || stripeSubscription.created || Math.floor(Date.now() / 1000)) * 1000),
                cancelAtPeriodEnd: Boolean((stripeSubscription as any).cancel_at_period_end),
              }
            })
            
            // Send Welcome Email for new subscriptions
            try {
              const template = await prisma.emailTemplate.findUnique({ where: { type: 'WELCOME' }})
              const dashboardUrl = process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard` : 'https://agora-plus.com/dashboard'
              
              const subject = template?.subject || '¡Bienvenido a Ágora Plus PRO!'
              let html = template?.htmlBody || `<h1>¡Bienvenido a Ágora Plus!</h1><p>Hola {{userFirstname}},</p><p>Tu suscripción PRO se ha activado con éxito. Ahora tienes acceso total a nuestra base de datos y al <strong>Ágora Copilot</strong> impulsado por IA.</p><p><a href="{{dashboardUrl}}">Ir a mi Dashboard</a></p><p>Saludos,<br>Equipo Ágora Plus</p>`
              
              // Si tenemos un inviteUrl, lo usamos como el dashboardUrl para que puedan configurar su contraseña
              const finalUrl = inviteUrl ? inviteUrl : dashboardUrl;
              
              html = html.replace(/{{userFirstname}}/g, dbUser.name || 'Usuario')
                         .replace(/{{dashboardUrl}}/g, finalUrl)

              await resend.emails.send({
                from: 'Ágora Plus <soporte@agora-lexlatin.com>',
                to: [dbUser.email],
                subject: subject,
                html: html,
              })
            } catch (emailErr) {
              console.error('[RESEND_ERROR] Failed to send welcome email', emailErr)
            }
          }
        }
        break

      case 'customer.subscription.trial_will_end':
        const trialSub = event.data.object as Stripe.Subscription
        const dbTrialUser = await prisma.user.findUnique({
          where: { stripeCustomerId: trialSub.customer as string }
        })

        if (dbTrialUser) {
          try {
            const template = await prisma.emailTemplate.findUnique({ where: { type: 'REMINDER_TRIAL' }})
            const dashboardUrl = process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard` : 'https://agora-plus.com/dashboard'
            
            const subject = template?.subject || 'Aviso: Tu prueba gratuita está por concluir'
            let html = template?.htmlBody || `<h1>Tu prueba de Ágora Plus está por terminar</h1>\n<p>Hola {{userFirstname}},</p>\n<p>Esperamos que hayas disfrutado de tu prueba gratuita. Te recordamos que en 3 días comenzará tu suscripción PRO y se realizará el cargo automático a tu método de pago registrado.</p>\n<p>Si deseas continuar con nosotros, no tienes que hacer nada. Si necesitas revisar tu método de pago o cancelación, visita el enlace abajo:</p>\n<p><a href="{{dashboardUrl}}/billing">Ver Mi Facturación</a></p>\n<p>Saludos,<br>Equipo Ágora Plus</p>`
            
            html = html.replace(/{{userFirstname}}/g, dbTrialUser.name || 'Usuario')
                       .replace(/{{dashboardUrl}}/g, dashboardUrl)

            await resend.emails.send({
              from: 'Ágora Plus <soporte@agora-lexlatin.com>',
              to: [dbTrialUser.email],
              subject: subject,
              html: html,
            })
          } catch (emailErr) {
            console.error('[RESEND_ERROR] Failed to send trial reminder email', emailErr)
          }
        }
        break

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        const dbSubUser = await prisma.user.findUnique({
          where: { stripeCustomerId: subscription.customer as string },
          include: { subscription: true }
        })

        if (dbSubUser) {
          // Map Stripe status to Prisma Enum
          let newStatus: any = SubscriptionStatus.INCOMPLETE
          if (subscription.status === 'trialing') newStatus = SubscriptionStatus.TRIAL
          if (subscription.status === 'active') newStatus = SubscriptionStatus.ACTIVE
          if (subscription.status === 'canceled') newStatus = SubscriptionStatus.CANCELED
          if (subscription.status === 'past_due' || subscription.status === 'unpaid') newStatus = SubscriptionStatus.PAST_DUE

          const wasTrial = dbSubUser.subscription?.status === 'TRIAL' || Boolean(dbSubUser.subscription?.trialEndsAt && new Date(dbSubUser.subscription.trialEndsAt) > new Date())

          await prisma.subscription.update({
            where: { userId: dbSubUser.id },
            data: {
              status: newStatus,
              priceId: subscription.items.data[0].price.id,
              currentPeriodEnd: new Date(((subscription as any).current_period_end || subscription.trial_end || subscription.created || Math.floor(Date.now() / 1000)) * 1000),
              cancelAtPeriodEnd: Boolean((subscription as any).cancel_at_period_end),
            }
          })

          // 1. Send TRIAL_CANCELLED email if cancelled during trial
          if (newStatus === SubscriptionStatus.CANCELED && wasTrial) {
            try {
              const template = await prisma.emailTemplate.findUnique({ where: { type: 'TRIAL_CANCELLED' }})
              const dashboardUrl = process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard` : 'https://www.agora-lexlatin.com/dashboard'
              
              const subject = template?.subject || 'Confirmación: Tu prueba gratuita de Ágora Plus ha sido cancelada'
              let html = template?.htmlBody || `<h1>Tu suscripción de prueba ha sido cancelada</h1><p>Hola {{userFirstname}},</p><p>Confirmamos que tu suscripción ha sido cancelada exitosamente y <strong>no se realizó ni se realizará cobro alguno</strong> a tu tarjeta.</p><p><a href="{{dashboardUrl}}">Ir a Ágora Plus</a></p><p>Saludos,<br>Equipo Ágora Plus</p>`
              
              html = html.replace(/{{userFirstname}}/g, dbSubUser.name || 'Usuario')
                         .replace(/{{dashboardUrl}}/g, dashboardUrl)

              await resend.emails.send({
                from: 'Ágora Plus <soporte@agora-lexlatin.com>',
                to: [dbSubUser.email],
                subject: subject,
                html: html,
              })
            } catch (emailErr) {
              console.error('[RESEND_ERROR] Failed to send trial cancelled email', emailErr)
            }
          }

          // 2. Send Dunning Email if past_due
          if (newStatus === SubscriptionStatus.PAST_DUE) {
            try {
              const template = await prisma.emailTemplate.findUnique({ where: { type: 'DUNNING' }})
              const dashboardUrl = process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard` : 'https://www.agora-lexlatin.com/dashboard'
              
              const subject = template?.subject || 'Acción Requerida: Actualiza tu método de pago'
              let html = template?.htmlBody || `<h1>Hubo un problema con tu pago</h1><p>Hola {{userFirstname}},</p><p>No pudimos procesar el último cargo de tu suscripción a <strong>Ágora Plus</strong>. Para evitar interrupciones, por favor actualiza tu tarjeta.</p><p><a href="{{dashboardUrl}}/billing">Actualizar Método de Pago</a></p><p>Saludos,<br>Equipo Ágora Plus</p>`
              
              html = html.replace(/{{userFirstname}}/g, dbSubUser.name || 'Usuario')
                         .replace(/{{dashboardUrl}}/g, dashboardUrl)

              await resend.emails.send({
                from: 'Ágora Plus Pagos <soporte@agora-lexlatin.com>',
                to: [dbSubUser.email],
                subject: subject,
                html: html,
              })
            } catch (emailErr) {
              console.error('[RESEND_ERROR] Failed to send dunning email', emailErr)
            }
          }
        }
        break

      case 'invoice.payment_succeeded':
      case 'invoice.paid':
        const invoice = event.data.object as Stripe.Invoice
        if (invoice.customer) {
          const dbInvoiceUser = await prisma.user.findUnique({
            where: { stripeCustomerId: invoice.customer as string },
            include: { subscription: true }
          })

          if (dbInvoiceUser) {
            // Update subscription to ACTIVE
            await prisma.subscription.updateMany({
              where: { userId: dbInvoiceUser.id },
              data: {
                status: SubscriptionStatus.ACTIVE,
                cancelAtPeriodEnd: false
              }
            })

            // Only send payment confirmation email if it was an actual charge (amount_paid > 0)
            if (invoice.amount_paid && invoice.amount_paid > 0) {
              try {
                const template = await prisma.emailTemplate.findUnique({ where: { type: 'PAYMENT_SUCCESS' }})
                const dashboardUrl = process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard` : 'https://www.agora-lexlatin.com/dashboard'
                
                const subject = template?.subject || '¡Pago confirmado! Bienvenido a tu suscripción oficial de Ágora Plus PRO'
                let html = template?.htmlBody || `<h1>¡Tu suscripción PRO está oficialmente activa!</h1><p>Hola {{userFirstname}},</p><p>Te confirmamos que el cobro de tu membresía a <strong>Ágora Plus PRO</strong> ha sido procesado exitosamente.</p><p><a href="{{dashboardUrl}}">Acceder a mi Dashboard</a></p><p>Gracias por confiar en Ágora.<br>Equipo Ágora Plus</p>`
                
                html = html.replace(/{{userFirstname}}/g, dbInvoiceUser.name || 'Usuario')
                           .replace(/{{dashboardUrl}}/g, dashboardUrl)

                await resend.emails.send({
                  from: 'Ágora Plus Pagos <soporte@agora-lexlatin.com>',
                  to: [dbInvoiceUser.email],
                  subject: subject,
                  html: html,
                })
              } catch (emailErr) {
                console.error('[RESEND_ERROR] Failed to send payment success email', emailErr)
              }
            }
          }
        }
        break

      case 'invoice.payment_failed':
        const failedInvoice = event.data.object as Stripe.Invoice
        if (failedInvoice.customer) {
          const dbFailedUser = await prisma.user.findUnique({
            where: { stripeCustomerId: failedInvoice.customer as string }
          })

          if (dbFailedUser) {
            await prisma.subscription.updateMany({
              where: { userId: dbFailedUser.id },
              data: { status: SubscriptionStatus.PAST_DUE }
            })

            try {
              const template = await prisma.emailTemplate.findUnique({ where: { type: 'DUNNING' }})
              const dashboardUrl = process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard` : 'https://www.agora-lexlatin.com/dashboard'
              
              const subject = template?.subject || 'Acción requerida: Problema al procesar tu pago de Ágora Plus'
              let html = template?.htmlBody || `<h1>Hubo un problema con tu pago</h1><p>Hola {{userFirstname}},</p><p>No pudimos procesar el último cargo de tu suscripción a <strong>Ágora Plus</strong>. Para evitar interrupciones, por favor actualiza tu tarjeta.</p><p><a href="{{dashboardUrl}}/billing">Actualizar Método de Pago</a></p><p>Saludos,<br>Equipo Ágora Plus</p>`
              
              html = html.replace(/{{userFirstname}}/g, dbFailedUser.name || 'Usuario')
                         .replace(/{{dashboardUrl}}/g, dashboardUrl)

              await resend.emails.send({
                from: 'Ágora Plus Pagos <soporte@agora-lexlatin.com>',
                to: [dbFailedUser.email],
                subject: subject,
                html: html,
              })
            } catch (emailErr) {
              console.error('[RESEND_ERROR] Failed to send payment failed email', emailErr)
            }
          }
        }
        break

      case 'invoice.upcoming':
        const upcomingInvoice = event.data.object as Stripe.Invoice
        if (upcomingInvoice.customer) {
          const dbUpcomingUser = await prisma.user.findUnique({
            where: { stripeCustomerId: upcomingInvoice.customer as string }
          })

          if (dbUpcomingUser) {
            try {
              const template = await prisma.emailTemplate.findUnique({ where: { type: 'UPCOMING_RENEWAL' }})
              const dashboardUrl = process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard` : 'https://www.agora-lexlatin.com/dashboard'
              
              const subject = template?.subject || 'Aviso: Tu suscripción a Ágora Plus se renovará en 3 días'
              let html = template?.htmlBody || `<h1>Aviso de próxima renovación mensual</h1><p>Hola {{userFirstname}},</p><p>Te informamos que en 3 días se procesará la renovación automática de tu suscripción mensual a <strong>Ágora Plus PRO</strong>.</p><p><a href="{{dashboardUrl}}/billing">Gestionar Mi Facturación</a></p><p>Saludos,<br>Equipo Ágora Plus</p>`
              
              html = html.replace(/{{userFirstname}}/g, dbUpcomingUser.name || 'Usuario')
                         .replace(/{{dashboardUrl}}/g, dashboardUrl)

              await resend.emails.send({
                from: 'Ágora Plus <soporte@agora-lexlatin.com>',
                to: [dbUpcomingUser.email],
                subject: subject,
                html: html,
              })
            } catch (emailErr) {
              console.error('[RESEND_ERROR] Failed to send upcoming renewal email', emailErr)
            }
          }
        }
        break

      default:
        console.log(`[WEBHOOK_UNHANDLED] Event type ${event.type}`)
    }
  } catch (error: any) {
    console.error('[WEBHOOK_DB_ERROR]', error)
    return new NextResponse(`Detailed Error: ${error?.message || 'Unknown error'} | Stack: ${error?.stack?.substring(0, 500)}`, { status: 500 })
  }

  return new NextResponse('Webhook processed', { status: 200 })
}
