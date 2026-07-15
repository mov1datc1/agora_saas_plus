import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const txs = await prisma.transaction.findMany({ select: { title: true, valueString: true }, take: 10 })
  console.log(txs)
}
main()
