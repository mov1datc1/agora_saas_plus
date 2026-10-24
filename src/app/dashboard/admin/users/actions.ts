'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function deactivateUser(userId: string) {
  try {
    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        status: 'CANCELED',
        cancelAtPeriodEnd: false,
      },
      update: {
        status: 'CANCELED',
        cancelAtPeriodEnd: false,
      }
    })
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false }
    })
    revalidatePath('/dashboard/admin/users')
    revalidatePath('/dashboard/admin')
    return { success: true }
  } catch (error) {
    console.error('Error deactivating user:', error)
    return { success: false, error: 'Failed to deactivate user' }
  }
}

export async function reactivateUser(userId: string) {
  try {
    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
      },
      update: {
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
      }
    })
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: true }
    })
    revalidatePath('/dashboard/admin/users')
    revalidatePath('/dashboard/admin')
    return { success: true }
  } catch (error) {
    console.error('Error reactivating user:', error)
    return { success: false, error: 'Failed to reactivate user' }
  }
}
