const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
async function run() {
  const txs = await prisma.transaction.findMany({
    orderBy: { dateAnnounced: 'desc' },
    take: 5
  })
  console.log(txs.map(tx => ({ title: tx.title, valueString: tx.valueString })))
}
run()
