const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const result = await prisma.user.updateMany({
    where: {
      role: 'ADMIN',
    },
    data: {
      role: 'SUPERADMIN',
    },
  })
  console.log(`Updated ${result.count} ADMIN users to SUPERADMIN`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
