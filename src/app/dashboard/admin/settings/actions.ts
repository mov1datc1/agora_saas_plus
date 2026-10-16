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

export async function toggleMaintenanceMode(enabled: boolean) {
  await prisma.systemConfig.upsert({
    where: { id: 'global' },
    update: { maintenanceModeEnabled: enabled },
    create: { id: 'global', maintenanceModeEnabled: enabled }
  })
  revalidatePath('/')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/admin/settings')
}

export async function toggleCopilotEnabled(enabled: boolean) {
  await prisma.systemConfig.upsert({
    where: { id: 'global' },
    update: { copilotEnabled: enabled },
    create: { id: 'global', copilotEnabled: enabled }
  })
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/admin/settings')
}

export async function toggleGlobalMetrics(enabled: boolean) {
  await prisma.systemConfig.upsert({
    where: { id: 'global' },
    update: { showGlobalMetricsToUsers: enabled },
    create: { id: 'global', showGlobalMetricsToUsers: enabled }
  })
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/admin/settings')
}

export async function toggleRankingsVisibility(enabled: boolean) {
  await prisma.systemConfig.upsert({
    where: { id: 'global' },
    update: { showRankingsToUsers: enabled },
    create: { id: 'global', showRankingsToUsers: enabled }
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

export async function saveCrmConfig(data: {
  crmWebhookUrl: string
  crmSyncEnabled: boolean
  crmTagTrial: string
  crmTagActive: string
  crmTagCanceled: string
}) {
  await prisma.systemConfig.upsert({
    where: { id: 'global' },
    update: {
      crmWebhookUrl: data.crmWebhookUrl.trim() || null,
      crmSyncEnabled: data.crmSyncEnabled,
      crmTagTrial: data.crmTagTrial.trim() || 'agora_en_prueba',
      crmTagActive: data.crmTagActive.trim() || 'agora_suscriptor',
      crmTagCanceled: data.crmTagCanceled.trim() || 'agora_cancelo',
    },
    create: {
      id: 'global',
      crmWebhookUrl: data.crmWebhookUrl.trim() || null,
      crmSyncEnabled: data.crmSyncEnabled,
      crmTagTrial: data.crmTagTrial.trim() || 'agora_en_prueba',
      crmTagActive: data.crmTagActive.trim() || 'agora_suscriptor',
      crmTagCanceled: data.crmTagCanceled.trim() || 'agora_cancelo',
    }
  })
  revalidatePath('/dashboard/admin/settings')
  return { success: true }
}

export async function testCrmWebhookAction(options: {
  testEmail?: string
  name?: string
  eventType?: 'TRIAL_STARTED' | 'SUBSCRIPTION_ACTIVATED' | 'SUBSCRIPTION_CANCELED' | 'TEST_PING'
} = {}) {
  const { sendCrmWebhook } = await import('@/lib/crm')
  
  const email = options.testEmail?.trim() || 'pedro.perez@demolexlatin.com'
  const name = options.name?.trim() || 'Pedro Pérez'
  const event = options.eventType || 'TRIAL_STARTED'
  
  const trialEnds = new Date()
  trialEnds.setDate(trialEnds.getDate() + 7)

  const result = await sendCrmWebhook({
    event,
    email,
    name,
    company: 'Pérez & Asociados Legal',
    phone: '+52 55 1234 5678',
    plan: 'INDIVIDUAL',
    amount: event === 'SUBSCRIPTION_ACTIVATED' ? 149.00 : undefined,
    currency: 'USD',
    trialEndsAt: event === 'TRIAL_STARTED' ? trialEnds : undefined,
    isSimulation: true,
  })
  return result
}

