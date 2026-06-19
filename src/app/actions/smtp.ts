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
