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

async function diagnose() {
  // 1. Find the China Three Gorges transaction in DB
  console.log('=== SEARCHING DB FOR "China Three Gorges" ===\n');
  const txs = await prisma.transaction.findMany({
    where: { title: { contains: 'China Three Gorges', mode: 'insensitive' } },
    select: {
      id: true,
      title: true,
      companies: {
        select: {
          company: { select: { id: true, name: true } },
          role: true,
        }
      },
      advisors: {
        select: {
          firm: { select: { id: true, name: true } },
          role: true,
        }
      },
      lawyers: {
        select: {
          lawyer: { select: { id: true, name: true } },
        }
      },
    }
  });

  for (const tx of txs) {
    console.log(`ID: ${tx.id}`);
    console.log(`Title: ${tx.title}`);
    console.log(`Companies (${tx.companies.length}):`);
    for (const c of tx.companies) {
      console.log(`  - ${c.company.name} (${c.role}) [${c.company.id}]`);
    }
    console.log(`Firms (${tx.advisors.length}):`);
    for (const a of tx.advisors) {
      console.log(`  - ${a.firm.name} (${a.role}) [${a.firm.id}]`);
    }
    console.log(`Lawyers (${tx.lawyers.length}):`);
    for (const l of tx.lawyers) {
      console.log(`  - ${l.lawyer.name} [${l.lawyer.id}]`);
    }
    console.log();
  }

  // 2. Now check what the Drupal API returns for this node
  // The NID from the screenshot URL is 134319 (node/134319/edit)
  const DRUPAL_API_BASE = envConfig.DRUPAL_API_URL || 'https://lexlatin.com/api/agora/transactions';
  const DRUPAL_TOKEN = envConfig.DRUPAL_AGORA_TOKEN || '';

  // Fetch the specific post by searching recent pages
  console.log('=== FETCHING FROM DRUPAL API ===\n');
  try {
    const url = `${DRUPAL_API_BASE}?page=0&limit=200&status=all`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${DRUPAL_TOKEN}`,
        'Accept': 'application/json',
      }
    });
    if (!res.ok) {
      console.log(`API Error: ${res.status}`);
    } else {
      const json = await res.json();
      const posts = json.data || json.items || json;
      const target = (Array.isArray(posts) ? posts : []).find(
        (p: any) => p.title?.includes('China Three Gorges') || p.nid === 134319
      );
      if (target) {
        console.log(`Found in API — NID: ${target.nid}`);
        console.log(`Title: ${target.title}`);
        console.log(`Companies field:`, JSON.stringify(target.companies, null, 2));
        console.log(`Firms field:`, JSON.stringify(target.firms?.slice(0, 3), null, 2));
        console.log(`field_empresa:`, JSON.stringify(target.field_empresa, null, 2));
        console.log(`\nAll keys:`, Object.keys(target).join(', '));
      } else {
        console.log('Not found in first 200 posts. Trying NID search...');
        // Try fetching all keys from the first post to understand the structure
        if (Array.isArray(posts) && posts.length > 0) {
          const sample = posts[0];
          console.log(`Sample post keys: ${Object.keys(sample).join(', ')}`);
          console.log(`Sample companies: ${JSON.stringify(sample.companies)}`);
        }
      }
    }
  } catch (err: any) {
    console.log(`Fetch error: ${err.message}`);
  }

  // 3. Also check another post that DOES have companies working
  console.log('\n=== COMPARISON: A post WITH companies showing correctly ===\n');
  const workingTx = await prisma.transaction.findFirst({
    where: {
      companies: { some: {} },
      dateAnnounced: { gte: new Date('2026-06-01') },
    },
    select: {
      id: true,
      title: true,
      companies: {
        select: { company: { select: { name: true } }, role: true }
      },
    },
    orderBy: { dateAnnounced: 'desc' },
  });

  if (workingTx) {
    console.log(`Working example: ${workingTx.title}`);
    console.log(`Companies (${workingTx.companies.length}):`);
    for (const c of workingTx.companies) {
      console.log(`  - ${c.company.name} (${c.role})`);
    }
  }

  await pool.end();
}

diagnose().catch(console.error);
