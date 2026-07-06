'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'

export async function getSystemConfig() {
  const config = await prisma.systemConfig.findUnique({
    where: { id: 'global' }
  })
  if (!config) {
    return prisma.systemConfig.create({
      data: { id: 'global', trialRestrictionsEnabled: false }
    })
  }
  return config
}

export async function toggleTrialRestrictions(enabled: boolean) {
  await prisma.systemConfig.upsert({
    where: { id: 'global' },
    update: { trialRestrictionsEnabled: enabled },
    create: { id: 'global', trialRestrictionsEnabled: enabled }
  })
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/admin/settings')
}

export async function saveLeadFormScript(script: string) {
  await prisma.systemConfig.upsert({
    where: { id: 'global' },
    update: { leadFormScript: script },
    create: { id: 'global', leadFormScript: script }
  })
  revalidatePath('/iniciar-prueba-gratuita')
  revalidatePath('/dashboard/admin/settings')
  return { success: true }
}
