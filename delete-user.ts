import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  try {
      const res = await prisma.user.delete({
          where: { email: 'agenciamovidatci@gmail.com' }
      })
      console.log("Deleted user:", res.email)
  } catch(e) {
      console.log("User not found or error")
  }
}
main()
