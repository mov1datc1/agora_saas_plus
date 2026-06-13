import prisma from '../src/lib/prisma'

async function main() {
  try {
      const user = await prisma.user.update({
          where: { email: 'admin@lexlatin.com' },
          data: { role: 'ADMIN' }
      })
      console.log("Admin User Ready in Prisma:", user.email, "Role:", user.role)
  } catch(e) {
      console.error(e.message)
  }
}
main()
