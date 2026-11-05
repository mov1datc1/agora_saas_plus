'use server'

import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { supabaseAdmin } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

export async function sendPasswordResetLink(formData: FormData) {
  const email = (formData.get('email') as string || '').trim().toLowerCase()

  if (!email) {
    redirect('/forgot-password?error=' + encodeURIComponent('Por favor ingresa tu correo electrónico.'))
  }

  // 1. Verificar si el usuario existe en la base de datos
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } }
  })

  if (!user) {
    redirect(
      '/forgot-password?error=' + 
      encodeURIComponent('No encontramos ninguna cuenta registrada con este correo electrónico. Por favor verifica que esté bien escrito o regístrate.')
    )
  }

  // 2. Generar el enlace de recuperación seguro con Supabase Admin (bypasea límites de SMTP interno)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.agora-lexlatin.com'
  const redirectCallback = `${siteUrl}/auth/callback?next=/reset-password`

  let actionLink: string | null = null

  try {
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: user.email,
      options: {
        redirectTo: redirectCallback,
      },
    })

    if (linkError) {
      console.error('[PASSWORD_RESET_GEN_ERROR]', linkError)
      redirect('/forgot-password?error=' + encodeURIComponent(linkError.message || 'Error al generar enlace de recuperación.'))
    }

    actionLink = linkData?.properties?.action_link || null
  } catch (err: any) {
    if (err.digest?.startsWith('NEXT_REDIRECT')) throw err
    console.error('[PASSWORD_RESET_EXCEPTION]', err)
    redirect('/forgot-password?error=' + encodeURIComponent('No fue posible procesar la solicitud en este momento.'))
  }

  if (!actionLink) {
    redirect('/forgot-password?error=' + encodeURIComponent('No se pudo generar el enlace de recuperación.'))
  }

  // 3. Preparar plantilla de correo
  let template = null
  try {
    template = await prisma.emailTemplate.findUnique({
      where: { type: 'PASSWORD_RESET' }
    })
  } catch (dbErr) {
    console.warn('[PASSWORD_RESET_TEMPLATE_FETCH_WARN]', dbErr)
  }

  const displayName = user.name && user.name !== 'Independiente' ? user.name : 'Usuario'
  const subject = template?.subject || 'Restablece tu contraseña - Ágora Plus'

  const defaultHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 32px 20px; color: #111827;">
      <div style="text-align: center; margin-bottom: 28px;">
        <h1 style="color: #E05C50; font-size: 26px; font-weight: 800; margin: 0;">Ágora Plus</h1>
        <p style="color: #6b7280; font-size: 13px; margin-top: 4px;">Inteligencia Transaccional de América Latina</p>
      </div>
      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <h2 style="font-size: 18px; font-weight: 700; margin-top: 0; color: #111827;">Restablece tu contraseña</h2>
        <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
          Hola ${displayName}, hemos recibido una solicitud para restablecer la contraseña de acceso a tu cuenta en <strong>Ágora Plus</strong>.
        </p>
        <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
          Haz clic en el botón a continuación para definir tu nueva contraseña de forma segura:
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${actionLink}" style="background-color: #E05C50; color: #ffffff; padding: 13px 30px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; display: inline-block;">
            Restablecer Mi Contraseña
          </a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0; border-top: 1px solid #f3f4f6; padding-top: 16px; line-height: 1.5;">
          Este enlace de recuperación es de un solo uso y caduca automáticamente por seguridad. Si no solicitaste este cambio, puedes ignorar este mensaje con tranquilidad.
        </p>
      </div>
    </div>
  `

  let html = template?.htmlBody || defaultHtml
  html = html
    .replace(/{{userFirstname}}/g, displayName)
    .replace(/{{resetUrl}}/g, actionLink)
    .replace(/{{actionLink}}/g, actionLink)

  // 4. Enviar vía Resend con fallback a Supabase
  const resendApiKey = process.env.RESEND_API_KEY
  if (resendApiKey) {
    try {
      const { Resend } = await import('resend')
      const resend = new Resend(resendApiKey)
      const { error: sendError } = await resend.emails.send({
        from: 'Ágora Plus <soporte@agora-lexlatin.com>',
        to: [user.email],
        subject,
        html,
      })

      if (sendError) {
        console.error('[PASSWORD_RESET_RESEND_ERROR]', sendError)
        // Fallback a Supabase mailer
        const supabase = await createClient()
        await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: redirectCallback })
      } else {
        console.log(`[PASSWORD_RESET_RESEND_SUCCESS] Email sent to ${user.email}`)
      }
    } catch (emailErr: any) {
      if (emailErr.digest?.startsWith('NEXT_REDIRECT')) throw emailErr
      console.error('[PASSWORD_RESET_RESEND_EXCEPTION]', emailErr)
      const supabase = await createClient()
      await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: redirectCallback })
    }
  } else {
    const supabase = await createClient()
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: redirectCallback })
    if (resetErr) {
      redirect('/forgot-password?error=' + encodeURIComponent(resetErr.message))
    }
  }

  redirect(
    '/forgot-password?message=' + 
    encodeURIComponent(`Hemos enviado un enlace seguro para restablecer tu contraseña a ${user.email}. Revisa tu bandeja de entrada o spam.`)
  )
}
