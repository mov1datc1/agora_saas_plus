import prisma from '../src/lib/prisma'

async function main() {
  try {
      const user = await prisma.user.findUnique({
          where: { email: 'agenciamovidatci@gmail.com' }
      })
      console.log("Found User:", user ? user.email : "NO_USER")
  } catch(e) {
      console.error(e.message)
  }
}
main()
