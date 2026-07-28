const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const TARGET_EMAIL = 'angela.castillo@lexlatin.com'

async function main() {
  // 1. Verificar que el usuario existe
  const user = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
    select: { id: true, email: true, name: true, role: true, accountType: true, isActive: true }
  })

  if (!user) {
    console.error(`❌ No se encontró usuario con email: ${TARGET_EMAIL}`)
    process.exit(1)
  }

  console.log('📋 Usuario encontrado:')
  console.log(`   Email: ${user.email}`)
  console.log(`   Nombre: ${user.name || '(sin nombre)'}`)
  console.log(`   Rol actual: ${user.role}`)
  console.log(`   Tipo cuenta: ${user.accountType}`)
  console.log(`   Activo: ${user.isActive}`)

  if (user.role === 'ADMIN') {
    console.log('\n✅ El usuario ya tiene rol ADMIN. No se requieren cambios.')
    return
  }

  // 2. Actualizar rol a ADMIN
  const updated = await prisma.user.update({
    where: { email: TARGET_EMAIL },
    data: { role: 'ADMIN' },
    select: { email: true, role: true }
  })

  console.log(`\n✅ Rol actualizado exitosamente:`)
  console.log(`   ${updated.email} → ${updated.role}`)
}

main()
  .catch((e) => {
    console.error('❌ Error:', e.message)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
