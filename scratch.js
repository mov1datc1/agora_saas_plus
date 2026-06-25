const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const txs = await prisma.transaction.findMany({
    orderBy: { dateAnnounced: 'asc' },
    take: 5,
    select: { id: true, title: true, dateAnnounced: true, dateClosed: true }
  })
  console.log("Oldest transactions:", txs)
}
main().catch(console.error).finally(() => prisma.$disconnect())
