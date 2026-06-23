import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

import * as fs from 'fs';
import * as dotenv from 'dotenv';
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const connectionString = envConfig.DATABASE_URL;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  const ricardo = await prisma.user.findUnique({ where: { email: 'ricardo@movidatci.com' } });
  if (ricardo) {
    await prisma.subscription.deleteMany({ where: { userId: ricardo.id } });
    await prisma.user.delete({ where: { id: ricardo.id } });
    console.log('Deleted Ricardo.');
  }
}
run().catch(console.error).finally(() => process.exit(0));
