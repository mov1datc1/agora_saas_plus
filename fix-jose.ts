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

async function fix() {
  await prisma.user.updateMany({
    where: { email: 'agenciamovidatci@gmail.com' },
    data: { role: 'USER' }
  });
  console.log('Fixed Jose Movida back to USER (SaaS).');
}
fix().catch(console.error).finally(() => process.exit(0));
