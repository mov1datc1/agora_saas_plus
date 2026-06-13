import prisma from '../src/lib/prisma'

async function main() {
  try {
      const res = await prisma.user.delete({
          where: { email: 'agenciamovidatci@gmail.com' }
      })
      console.log("SUCCESSFULLY DELETED USER:", res.email)
  } catch(e) {
      console.log("USER NOT FOUND OR ERROR:", e.message)
  }
}
main()
