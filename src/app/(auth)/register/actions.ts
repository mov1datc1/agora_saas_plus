'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/prisma'

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const email = (formData.get('email') as string || '').trim().toLowerCase()
  const password = formData.get('password') as string

  if (!email) {
    redirect('/register?error=' + encodeURIComponent('El correo electrónico es requerido.'))
  }

  // 1. Verificar si el usuario ya existe en la plataforma
  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    include: { subscription: true }
  })

  if (existingUser) {
    const hadTrial = Boolean(existingUser.subscription?.trialEndsAt || existingUser.subscription?.status === 'CANCELED' || existingUser.subscription?.status === 'ACTIVE')
    if (hadTrial) {
      redirect(`/register?alreadyRegistered=true&email=${encodeURIComponent(email)}`)
    } else {
      redirect(`/login?error=${encodeURIComponent('Este correo ya está registrado. Inicia sesión con tus credenciales.')}`)
    }
  }

  // 2. Registrar usuario en Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
      }
    }
  })

  if (error) {
    redirect('/register?error=' + encodeURIComponent(error.message))
  }

  // Si la confirmación de email está desactivada (como se solicitó),
  // el usuario se crea y la sesión se inicializa de inmediato.
  if (data.user) {
    try {
      // 2. Crear espejo en la tabla pública User usando Prisma
      await prisma.user.create({
        data: {
          id: data.user.id, // Sincronizamos el ID
          email: email,
          name: name,
        }
      })
    } catch (dbError) {
      // En caso de que el usuario ya exista o falle la inserción.
      console.error('Error al sincronizar usuario en Prisma:', dbError)
    }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
