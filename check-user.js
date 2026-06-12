const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'jonathan@movidatci.com' },
    include: { subscription: true }
  });
  console.log("DB USER:", user);
}
main().catch(console.error).finally(() => prisma.$disconnect());
