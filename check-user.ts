import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'jonathan@movidatci.com' },
    include: { subscription: true }
  })
  console.log(user)
}
main()
