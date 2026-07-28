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
 * Purge Zero-Evidence "Transactions" from the database.
 * 
 * These are posts that Drupal Data Entry incorrectly marked as "Transacción"
 * but are actually editorial content (partner hirings, practice expansions).
 * 
 * Criteria: Transaction exists in DB but has NO advisors, NO companies, 
 * NO lawyers, NO monetary value, and NO practice area.
 * These are almost certainly misclassified editorial posts.
 */
async function purgeZeroEvidenceTransactions() {
  console.log('🔍 Scanning for zero-evidence transactions...\n');

  // Find all transactions with zero relationships and no value
  const suspects = await prisma.transaction.findMany({
    where: {
      AND: [
        { advisors: { none: {} } },
        { companies: { none: {} } },
        { lawyers: { none: {} } },
        { OR: [{ value: null }, { value: 0 }] },
        { OR: [{ practiceArea: null }, { practiceArea: '' }] },
      ]
    },
    select: {
      id: true,
      title: true,
      type: true,
      dateAnnounced: true,
    },
    orderBy: { dateAnnounced: 'desc' }
  });

  console.log(`Found ${suspects.length} zero-evidence transactions:\n`);
  
  for (const tx of suspects) {
    const date = tx.dateAnnounced ? tx.dateAnnounced.toISOString().split('T')[0] : 'N/A';
    console.log(`  ❌ [${date}] ${tx.id} — ${tx.title.substring(0, 90)}`);
    console.log(`     Type: ${tx.type}`);
  }

  if (suspects.length === 0) {
    console.log('\n✅ No zero-evidence transactions found. Database is clean.');
    await pool.end();
    return;
  }

  console.log(`\n🗑️  Deleting ${suspects.length} zero-evidence transactions...`);

  // Delete in FK order
  const ids = suspects.map(s => s.id);
  
  // Junction tables first (should be empty, but just in case)
  await prisma.transactionCompany.deleteMany({ where: { transactionId: { in: ids } } });
  await prisma.transactionLawyer.deleteMany({ where: { transactionId: { in: ids } } });
  await prisma.transactionAdvisor.deleteMany({ where: { transactionId: { in: ids } } });
  
  // Then the transactions themselves
  const result = await prisma.transaction.deleteMany({
    where: { id: { in: ids } }
  });

  console.log(`\n✅ Purged ${result.count} zero-evidence transactions from Supabase.`);
  await pool.end();
}

purgeZeroEvidenceTransactions().catch(console.error);
