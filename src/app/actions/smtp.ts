'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getEmailTemplates() {
  return await prisma.emailTemplate.findMany({
    orderBy: { type: 'asc' }
  })
}

export async function saveEmailTemplate(type: string, subject: string, htmlBody: string) {
  try {
    await prisma.emailTemplate.upsert({
      where: { type },
      create: { type, subject, htmlBody },
      update: { subject, htmlBody }
    })
    
    revalidatePath('/dashboard/admin/smtp')
    return { success: true }
  } catch (error: any) {
    console.error('[SMTP_ACTION_ERROR]', error)
    return { success: false, error: error.message }
  }
}

export async function testResendConnection(testEmail: string, fromEmail: string) {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return { success: false, error: 'La variable de entorno RESEND_API_KEY no está configurada.' }
    }

    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)

    const { data, error } = await resend.emails.send({
      from: fromEmail || 'onboarding@resend.dev',
      to: [testEmail],
      subject: 'Prueba de Conexión - Ágora Plus',
      html: '<p>Si recibes este correo, la integración con Resend está funcionando correctamente.</p>'
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (error: any) {
    console.error('[RESEND_TEST_ERROR]', error)
    return { success: false, error: error.message }
  }
}
