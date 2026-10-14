'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

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

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function loginWithMagicLink(formData: FormData) {
  const supabase = await createClient()
  const email = (formData.get('email') as string || '').trim()

  if (!email) {
    redirect('/login?error=' + encodeURIComponent('Se requiere correo electrónico para enviar el enlace mágico.'))
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.agora-lexlatin.com'
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteUrl}/dashboard`,
    },
  })

  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message))
  }

  redirect('/login?message=' + encodeURIComponent('Te hemos enviado un enlace mágico a tu correo. Revisa tu bandeja de entrada o spam.'))
}
