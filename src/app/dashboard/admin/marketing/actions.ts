'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function saveGAConfig(formData: FormData) {
  const gaId = formData.get('ga-id') as string

  await prisma.systemConfig.upsert({
    where: { id: 'global' },
    update: { gaMeasurementId: gaId },
    create: { id: 'global', gaMeasurementId: gaId }
  })

  revalidatePath('/dashboard/admin/marketing')
  revalidatePath('/') // Revalidate layout where GA is injected
}
