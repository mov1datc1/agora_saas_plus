import prisma from '@/lib/prisma'

export type CrmEventType = 
  | 'TRIAL_STARTED' 
  | 'SUBSCRIPTION_ACTIVATED' 
  | 'TRIAL_EXPIRING' 
  | 'SUBSCRIPTION_CANCELED' 
  | 'TRIAL_EXPIRED'
  | 'TEST_PING'

export interface CrmEventPayload {
  event: CrmEventType
  email: string
  name?: string | null
  phone?: string | null
  company?: string | null
  plan?: string | null
  amount?: number | null
  currency?: string | null
  trialEndsAt?: Date | null
  customTag?: string | null
}

export async function sendCrmWebhook(payload: CrmEventPayload): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { id: 'global' },
      select: {
        crmWebhookUrl: true,
        crmSyncEnabled: true,
        crmTagTrial: true,
        crmTagActive: true,
        crmTagCanceled: true,
      }
    })

    // Allow test ping even if crmSyncEnabled is false, as long as URL exists
    const isTest = payload.event === 'TEST_PING'
    if (!config?.crmWebhookUrl || (!config.crmSyncEnabled && !isTest)) {
      return { success: true, skipped: true }
    }

    // Determine the tag based on the event and config
    let tag = payload.customTag
    if (!tag) {
      if (payload.event === 'TRIAL_STARTED' || payload.event === 'TRIAL_EXPIRING') {
        tag = config.crmTagTrial || 'agora_en_prueba'
      } else if (payload.event === 'SUBSCRIPTION_ACTIVATED') {
        tag = config.crmTagActive || 'agora_suscriptor'
      } else if (payload.event === 'SUBSCRIPTION_CANCELED' || payload.event === 'TRIAL_EXPIRED') {
        tag = config.crmTagCanceled || 'agora_cancelo'
      } else if (payload.event === 'TEST_PING') {
        tag = 'agora_test'
      }
    }

    // Standard payload compatible with HighLevel / LeadConnector / Webhooks
    const body = {
      event: payload.event,
      email: payload.email,
      name: payload.name || undefined,
      phone: payload.phone || undefined,
      company: payload.company || undefined,
      plan: payload.plan || undefined,
      amount: payload.amount || undefined,
      currency: payload.currency || 'USD',
      tag,
      tags: tag ? [tag] : [],
      trialEndsAt: payload.trialEndsAt ? payload.trialEndsAt.toISOString() : undefined,
      timestamp: new Date().toISOString(),
      source: 'Agora Plus SaaS'
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(config.crmWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Agora-Plus-CRM-Integration/1.0',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error(`[CRM_WEBHOOK_ERROR] HTTP ${res.status}: ${errText}`)
      return { success: false, error: `HTTP ${res.status}: ${errText.slice(0, 200)}` }
    }

    return { success: true }
  } catch (error: any) {
    console.error('[CRM_WEBHOOK_ERROR]', error)
    return { success: false, error: error.message || 'Error de conexión de red' }
  }
}
