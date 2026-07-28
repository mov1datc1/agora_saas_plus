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

/**
 * Diagnostic: reproduce the exact query the user ran and show raw dates
 * Filter: dateRange 2026-01-01 to 2026-06-30, type=Emisiones, firm=Garrigues - Chile
 */
async function diagnose() {
  const dateGte = new Date('2026-01-01T00:00:00.000Z');
  const dateLt = new Date('2026-07-01T00:00:00.000Z');

  console.log('=== QUERY PARAMETERS ===');
  console.log(`  dateGte: ${dateGte.toISOString()}`);
  console.log(`  dateLt:  ${dateLt.toISOString()}`);
  console.log();

  // Reproduce exact where clause from operations/route.ts
  const where: any = {
    type: 'Emisiones',
    advisors: {
      some: { firm: { name: { equals: 'Garrigues - Chile', mode: 'insensitive' as const } } }
    },
    AND: [
      {
        OR: [
          { dateAnnounced: { gte: dateGte, lt: dateLt } },
          { dateClosed: { gte: dateGte, lt: dateLt } },
        ]
      }
    ]
  };

  const results = await prisma.transaction.findMany({
    where,
    select: {
      id: true,
      title: true,
      type: true,
      dateAnnounced: true,
      dateClosed: true,
      advisors: { select: { firm: { select: { name: true } } } },
    },
    orderBy: { dateAnnounced: 'desc' },
  });

  console.log(`=== RESULTS WITH OR FILTER: ${results.length} ===\n`);
  for (const tx of results) {
    const firms = tx.advisors.map((a: any) => a.firm?.name).filter(Boolean).join(', ');
    console.log(`  ${tx.id}`);
    console.log(`    Title: ${tx.title.substring(0, 80)}`);
    console.log(`    dateAnnounced: ${tx.dateAnnounced?.toISOString() || 'NULL'}`);
    console.log(`    dateClosed:    ${tx.dateClosed?.toISOString() || 'NULL'}`);
    console.log(`    UI shows:      ${(tx.dateClosed || tx.dateAnnounced)?.toISOString() || 'NULL'}`);
    console.log(`    Firms: ${firms}`);
    console.log();
  }

  // Now also check: are there Garrigues Emisiones that have dates OUT of range
  // but SOMEHOW appear?
  console.log('=== ALL GARRIGUES + EMISIONES (no date filter) ===\n');
  const all = await prisma.transaction.findMany({
    where: {
      type: 'Emisiones',
      advisors: {
        some: { firm: { name: { equals: 'Garrigues - Chile', mode: 'insensitive' as const } } }
      },
    },
    select: {
      id: true,
      title: true,
      dateAnnounced: true,
      dateClosed: true,
    },
    orderBy: { dateAnnounced: 'desc' },
  });

  for (const tx of all) {
    const announced = tx.dateAnnounced?.toISOString().split('T')[0] || 'NULL';
    const closed = tx.dateClosed?.toISOString().split('T')[0] || 'NULL';
    const inRange = (
      (tx.dateAnnounced && tx.dateAnnounced >= dateGte && tx.dateAnnounced < dateLt) ||
      (tx.dateClosed && tx.dateClosed >= dateGte && tx.dateClosed < dateLt)
    );
    console.log(`  ${inRange ? '✅' : '❌'} announced=${announced} closed=${closed} — ${tx.title.substring(0, 70)}`);
  }

  await pool.end();
}

diagnose().catch(console.error);
