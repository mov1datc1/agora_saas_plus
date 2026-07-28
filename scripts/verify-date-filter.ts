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

async function verifyNewFilter() {
  const dateGte = new Date('2026-01-01T00:00:00.000Z');
  const dateLt = new Date('2026-07-01T00:00:00.000Z');

  console.log('=== NEW COALESCE FILTER (should match UI display) ===\n');
  console.log(`Range: ${dateGte.toISOString()} to ${dateLt.toISOString()}\n`);

  // NEW logic: COALESCE(dateClosed, dateAnnounced) IN range
  const results = await prisma.transaction.findMany({
    where: {
      type: 'Emisiones',
      advisors: {
        some: { firm: { name: { equals: 'Garrigues - Chile', mode: 'insensitive' as const } } }
      },
      AND: [
        {
          AND: [
            {
              OR: [
                // Case 1: dateClosed exists → filter by dateClosed
                { dateClosed: { gte: dateGte, lt: dateLt } },
                // Case 2: dateClosed is null → filter by dateAnnounced
                { dateClosed: null, dateAnnounced: { gte: dateGte, lt: dateLt } },
              ]
            }
          ]
        }
      ]
    },
    select: {
      id: true,
      title: true,
      dateAnnounced: true,
      dateClosed: true,
    },
    orderBy: { dateAnnounced: 'desc' },
  });

  console.log(`Results: ${results.length}\n`);
  for (const tx of results) {
    const effectiveDate = tx.dateClosed || tx.dateAnnounced;
    const effStr = effectiveDate?.toISOString().split('T')[0] || 'NULL';
    const annStr = tx.dateAnnounced?.toISOString().split('T')[0] || 'NULL';
    const closedStr = tx.dateClosed?.toISOString().split('T')[0] || 'NULL';
    console.log(`  ✅ UI shows: ${effStr} | announced=${annStr} | closed=${closedStr}`);
    console.log(`     ${tx.title.substring(0, 80)}`);
    console.log();
  }

  // Verify the previously-leaking ones are OUT
  console.log('=== VERIFY: problematic posts should NOT appear ===\n');
  const enjoyBonos = await prisma.transaction.findUnique({
    where: { id: 'drupal-132203' },
    select: { title: true, dateAnnounced: true, dateClosed: true }
  });
  if (enjoyBonos) {
    const eff = enjoyBonos.dateClosed || enjoyBonos.dateAnnounced;
    const inRange = eff && eff >= dateGte && eff < dateLt;
    console.log(`  drupal-132203 "Enjoy emite bonos locales"`);
    console.log(`    Effective date: ${eff?.toISOString().split('T')[0]}`);
    console.log(`    In 2026 H1 range: ${inRange ? '❌ STILL LEAKS' : '✅ CORRECTLY EXCLUDED'}`);
  }

  const enjoyCanje = await prisma.transaction.findUnique({
    where: { id: 'drupal-130070' },
    select: { title: true, dateAnnounced: true, dateClosed: true }
  });
  if (enjoyCanje) {
    const eff = enjoyCanje.dateClosed || enjoyCanje.dateAnnounced;
    const inRange = eff && eff >= dateGte && eff < dateLt;
    console.log(`  drupal-130070 "Enjoy culmina oferta"`);
    console.log(`    Effective date: ${eff?.toISOString().split('T')[0]}`);
    console.log(`    In 2026 H1 range: ${inRange ? '❌ STILL LEAKS' : '✅ CORRECTLY EXCLUDED'}`);
  }

  await pool.end();
}

verifyNewFilter().catch(console.error);
