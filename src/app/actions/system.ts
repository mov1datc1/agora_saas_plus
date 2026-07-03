'use server';

import { createClient } from '@/utils/supabase/server';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function toggleMaintenanceMode(enabled: boolean) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
      return { success: false, error: 'No autorizado' };
    }

    const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
    
    if (!dbUser || (dbUser.role !== 'SUPERADMIN' && dbUser.role !== 'ADMIN')) {
      return { success: false, error: 'No tienes permisos para realizar esta acción' };
    }

    await prisma.systemConfig.upsert({
      where: { id: 'global' },
      update: { maintenanceModeEnabled: enabled },
      create: { 
        id: 'global',
        maintenanceModeEnabled: enabled 
      }
    });

    // Revalidate paths so the layout picks up the new setting immediately
    revalidatePath('/', 'layout');

    return { success: true };
  } catch (error: any) {
    console.error('[SYSTEM_ACTION_ERROR]', error);
    return { success: false, error: 'Error interno del servidor' };
  }
}
