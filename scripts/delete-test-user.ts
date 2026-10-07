import prisma from '../src/lib/prisma'
import { supabaseAdmin } from '../src/utils/supabase/admin'

async function deleteUser() {
  const email = 'henryjinfantec2366@gmail.com'
  console.log(`🗑️ Eliminando usuario de prueba: ${email}...`)

  // 1. Buscar en Prisma
  const user = await prisma.user.findUnique({
    where: { email },
    include: { subscription: true }
  })

  if (user) {
    if (user.subscription) {
      await prisma.subscription.delete({
        where: { id: user.subscription.id }
      })
      console.log('✅ Suscripción eliminada de Prisma.')
    }
    await prisma.user.delete({
      where: { id: user.id }
    })
    console.log(`✅ Usuario ${user.id} eliminado de Prisma.`)
  } else {
    console.log('ℹ️ Usuario no encontrado en Prisma.')
  }

  // 2. Buscar y eliminar en Supabase Auth
  const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers()
  if (listErr) {
    console.error('Error listando usuarios de Supabase:', listErr)
  } else {
    const sbUser = users.find(u => u.email === email)
    if (sbUser) {
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(sbUser.id)
      if (delErr) {
        console.error('Error eliminando de Supabase Auth:', delErr)
      } else {
        console.log(`✅ Usuario ${sbUser.id} eliminado de Supabase Auth.`)
      }
    } else {
      console.log('ℹ️ Usuario no encontrado en Supabase Auth.')
    }
  }

  console.log('🎉 Usuario completamente eliminado. Base de datos limpia para prueba desde cero.')
}

deleteUser().catch(console.error).finally(() => process.exit(0))
