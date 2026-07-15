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

async function fixRoles() {
  const admins = ['admin@lexlatin.com', 'palacios.jenrique@gmail.com', 'agenciamovidatci@gmail.com'];
  
  // Set all to USER first
  await prisma.user.updateMany({
    data: { role: 'USER' }
  });
  
  // Set specific users to ADMIN
  await prisma.user.updateMany({
    where: {
      email: {
        in: admins
      }
    },
    data: { role: 'ADMIN' }
  });
  
  const users = await prisma.user.findMany();
  console.log('Fixed users:', users.map(u => `${u.email} - ${u.role}`));
}
fixRoles().catch(console.error).finally(() => process.exit(0));
