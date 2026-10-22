'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/prisma'
import { supabaseAdmin } from '@/utils/supabase/admin'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = (formData.get('email') as string || '').trim()
  const password = formData.get('password') as string

  if (!email) {
    redirect('/login?error=' + encodeURIComponent('Por favor ingresa tu correo electrónico.'))
  }

  if (!password) {
    redirect('/login?error=' + encodeURIComponent('Para ingresar con contraseña debes escribirla. Si aún no tienes una, haz clic abajo en "Enviar Enlace Mágico de Acceso".'))
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    const errorMsg = error.message === 'Invalid login credentials' 
      ? 'Correo o contraseña incorrectos. Verifica tus datos o usa Enlace Mágico.' 
      : error.message
    redirect('/login?error=' + encodeURIComponent(errorMsg))
  }

  try {
    const now = new Date()
    await prisma.user.updateMany({
      where: { email: { equals: email, mode: 'insensitive' }, firstLoginAt: null },
      data: { firstLoginAt: now, lastLoginAt: now }
    })
    await prisma.user.updateMany({
      where: { email: { equals: email, mode: 'insensitive' } },
      data: { lastLoginAt: now }
    })
  } catch (trackErr) {
    console.error('[LOGIN_TRACK_ERROR]', trackErr)
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function loginWithMagicLink(formData: FormData) {
  const supabase = await createClient()
  const email = (formData.get('email') as string || '').trim().toLowerCase()

  if (!email) {
    redirect('/login?error=' + encodeURIComponent('Se requiere correo electrónico para enviar el enlace mágico.'))
  }

  // 1. Verificar si el usuario existe en la base de datos
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } }
  })

  if (!user) {
    redirect('/login?error=' + encodeURIComponent('No encontramos ninguna cuenta registrada con este correo. ¿Deseas iniciar tu prueba gratuita?'))
  }

  // 2. Generar el enlace mágico seguro a través de Supabase Admin (bypasea el SMTP interno de Supabase)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.agora-lexlatin.com'
  const redirectCallback = `${siteUrl}/auth/callback?next=/dashboard`

  let actionLink: string | null = null

  try {
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: redirectCallback,
      },
    })

    if (linkError) {
      console.error('[MAGIC_LINK_GEN_ERROR]', linkError)
      redirect('/login?error=' + encodeURIComponent(linkError.message || 'Error al generar enlace de acceso.'))
    }

    actionLink = linkData?.properties?.action_link || null
  } catch (err: any) {
    if (err.digest?.startsWith('NEXT_REDIRECT')) throw err
    console.error('[MAGIC_LINK_EXCEPTION]', err)
    redirect('/login?error=' + encodeURIComponent('No fue posible generar el enlace en este momento.'))
  }

  if (!actionLink) {
    redirect('/login?error=' + encodeURIComponent('No se pudo obtener el enlace de acceso.'))
  }

  // 3. Enviar el correo directamente usando Resend
  const resendApiKey = process.env.RESEND_API_KEY
  if (resendApiKey) {
    try {
      const { Resend } = await import('resend')
      const resend = new Resend(resendApiKey)

      const displayName = user.name && user.name !== 'Independiente' ? user.name : 'Hola'

      await resend.emails.send({
        from: 'Ágora Plus <soporte@agora-lexlatin.com>',
        to: [email],
        subject: 'Tu enlace de acceso a Ágora Plus',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 32px 20px; color: #111827;">
            <div style="text-align: center; margin-bottom: 28px;">
              <h1 style="color: #E05C50; font-size: 26px; font-weight: 800; margin: 0;">Ágora Plus</h1>
              <p style="color: #6b7280; font-size: 13px; margin-top: 4px;">Inteligencia Transaccional de América Latina</p>
            </div>
            <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
              <h2 style="font-size: 18px; font-weight: 700; margin-top: 0; color: #111827;">Acceso rápido a tu cuenta</h2>
              <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
                ${displayName}, haz clic en el botón a continuación para ingresar directamente a tu cuenta de Ágora Plus sin contraseña:
              </p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="${actionLink}" style="background-color: #E05C50; color: #ffffff; padding: 13px 30px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; display: inline-block;">
                  Ingresar a Ágora Plus
                </a>
              </div>
              <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0; border-top: 1px solid #f3f4f6; padding-top: 16px; line-height: 1.5;">
                Este enlace es de uso único y caduca automáticamente por seguridad. Si no solicitaste este acceso, puedes ignorar este correo.
              </p>
            </div>
          </div>
        `,
      })
      console.log(`[MAGIC_LINK_RESEND_SUCCESS] Email sent to ${email}`)
    } catch (emailErr: any) {
      if (emailErr.digest?.startsWith('NEXT_REDIRECT')) throw emailErr
      console.error('[RESEND_SEND_ERROR]', emailErr)
      redirect('/login?error=' + encodeURIComponent('Error al enviar el correo con el enlace. Por favor intenta más tarde.'))
    }
  } else {
    // Si no hay Resend configurado en el entorno, usar fallback
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${siteUrl}/dashboard` },
    })
    if (otpError) {
      redirect('/login?error=' + encodeURIComponent(otpError.message))
    }
  }

  redirect('/login?message=' + encodeURIComponent('¡Enlace enviado con éxito! Revisa tu bandeja de entrada o spam para acceder.'))
}
