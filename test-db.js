const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const c = await prisma.transaction.count();
  console.log('Total transactions in DB:', c);
  const offset = await prisma.transaction.count();
  console.log('Current expected offset:', offset);
}
run().finally(() => prisma.$disconnect());
