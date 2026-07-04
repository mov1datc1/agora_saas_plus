const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
async function main() {
  const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } })
  console.log(config)
}
main().catch(console.error).finally(() => prisma.$disconnect())
