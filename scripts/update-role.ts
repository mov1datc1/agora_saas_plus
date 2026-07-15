import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// We must manually supply the DATABASE_URL and parse it from .env.local
import * as fs from 'fs';
import * as dotenv from 'dotenv';
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const connectionString = envConfig.DATABASE_URL;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function update() {
  const users = await prisma.user.findMany();
  console.log('Current users:', users.map(u => `${u.email} - ${u.role}`));
  
  // Make everyone an admin
  await prisma.user.updateMany({
    data: { role: 'ADMIN' }
  });
  console.log('Roles updated to ADMIN for all users.');
}
update().catch(console.error).finally(() => process.exit(0));
