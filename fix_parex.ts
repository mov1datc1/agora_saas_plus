import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const tx = await prisma.transaction.findFirst({ where: { title: { contains: 'Parex Resources' } } })
  console.log('Found:', tx)
  if (tx) {
    await prisma.transaction.update({
      where: { id: tx.id },
      data: { type: 'Emisiones' }
    })
    console.log('Updated to Emisiones')
  }
}
main()
