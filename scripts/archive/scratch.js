const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const types = await prisma.transaction.findMany({
    select: { type: true },
    distinct: ['type']
  })
  console.log(types)
}
main().catch(console.error).finally(() => prisma.$disconnect())
