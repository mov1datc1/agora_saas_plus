'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    // Aquí puedes redirigir con error a la URL: redirect('/login?error=Invalid credentials')
    redirect('/login?error=' + error.message)
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function loginWithMagicLink(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string

  if (!email) {
    redirect('/login?error=Se requiere correo electrónico para el enlace mágico')
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/dashboard`,
    },
  })

  if (error) {
    redirect('/login?error=' + error.message)
  }

  redirect('/login?message=Revisa tu correo para el enlace mágico de acceso')
}
