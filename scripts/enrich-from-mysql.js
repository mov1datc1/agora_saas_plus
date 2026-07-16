const mysql = require('mysql2/promise');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const MYSQL_CONFIG = {
  host: '104.248.230.220', port: 3306,
  user: 'zwcjasengh', password: 'KctUE3ap9p', database: 'zwcjasengh',
  connectTimeout: 30000,
};

let connStr = process.env.DATABASE_URL;
if (connStr.includes('pooler.supabase.com')) connStr = connStr.replace(':5432', ':6543');
const pg = new Pool({ connectionString: connStr, max: 5 });

const log = (msg) => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
function esc(s) { return s ? s.replace(/'/g, "''").replace(/\\/g, '\\\\') : ''; }

// Strip HTML tags for clean text, but preserve line breaks
function stripHtml(html) {
  if (!html) return null;
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function main() {
  log('🚀 AGORA+ Enrichment Script: MySQL → Supabase (excerpt + status + dateClosed)');
  log('='.repeat(65));

  // ─── PHASE 1: Read from MySQL ───
  log('\n📥 Reading excerpt, body, status, and dates from MySQL...');
  const conn = await mysql.createConnection(MYSQL_CONFIG);
  log('✅ MySQL connected');
  const q = async (sql) => { const [r] = await conn.query(sql); return r; };

  // Get body/excerpt for all posts with category=1
  const bodies = await q(`
    SELECT n.nid AS id,
      body.body_value AS bodyRaw,
      body.body_summary AS bodySummary
    FROM node n
    JOIN node_field_data d ON n.vid = d.vid
    JOIN node__field_category c ON n.vid = c.revision_id
    LEFT JOIN node__body body ON n.vid = body.revision_id
    WHERE c.field_category_target_id = 1
  `);
  log(`  Bodies/excerpts: ${bodies.length} posts`);

  // Get status (field_estado_caso)
  const statuses = await q(`
    SELECT n.nid AS id,
      ec.field_estado_caso_value AS estadoCaso
    FROM node n
    JOIN node_field_data d ON n.vid = d.vid
    JOIN node__field_category c ON n.vid = c.revision_id
    LEFT JOIN node__field_estado_caso ec ON n.vid = ec.revision_id
    WHERE c.field_category_target_id = 1
  `);
  log(`  Statuses: ${statuses.length} posts`);

  // Get dateClosed (field_fecha_de_cierre_de_la_emis) 
  const closeDates = await q(`
    SELECT n.nid AS id,
      fci.field_fecha_de_cierre_de_la_emis_value AS fechaCierre
    FROM node n
    JOIN node_field_data d ON n.vid = d.vid
    JOIN node__field_category c ON n.vid = c.revision_id
    LEFT JOIN node__field_fecha_de_cierre_de_la_emis fci ON n.vid = fci.revision_id
    WHERE c.field_category_target_id = 1
  `);
  log(`  Close dates: ${closeDates.length} posts`);

  // Get publication status
  const pubStatus = await q(`
    SELECT n.nid AS id,
      d.status AS visible,
      np.field_caso_no_publicado_value AS noPublicado
    FROM node n
    JOIN node_field_data d ON n.vid = d.vid
    JOIN node__field_category c ON n.vid = c.revision_id
    LEFT JOIN node__field_caso_no_publicado np ON n.vid = np.revision_id
    WHERE c.field_category_target_id = 1
  `);
  log(`  Publication flags: ${pubStatus.length} posts`);

  await conn.end();
  log('✅ MySQL read complete, connection closed');

  // ─── Build Lookup Maps ───
  const bodyMap = {};
  bodies.forEach(b => {
    // PRIORITY: bodyRaw (full article, up to 2000 chars) → bodySummary (subtitle fallback)
    // body_summary is the "Edit summary" in Drupal — just a subtitle, not the full article
    // body_value contains the complete article body text
    let excerpt = null;
    if (b.bodyRaw && b.bodyRaw.trim()) {
      const clean = stripHtml(b.bodyRaw);
      excerpt = clean.length > 2000 ? clean.substring(0, 2000) + '...' : clean;
    } else if (b.bodySummary && b.bodySummary.trim()) {
      excerpt = stripHtml(b.bodySummary);
    }
    if (excerpt) bodyMap[b.id] = excerpt;
  });

  const statusMap = {};
  statuses.forEach(s => {
    if (s.estadoCaso) {
      const raw = s.estadoCaso.toLowerCase();
      if (raw.includes('cerrad') || raw.includes('closed')) {
        statusMap[s.id] = 'Cerrado';
      } else if (raw.includes('progres') || raw.includes('ongoing') || raw.includes('on-going') || raw.includes('abierta')) {
        statusMap[s.id] = 'En progreso';
      } else {
        statusMap[s.id] = s.estadoCaso; // Keep original
      }
    }
  });

  const closeDateMap = {};
  closeDates.forEach(d => {
    if (d.fechaCierre) {
      try {
        const date = new Date(d.fechaCierre);
        if (!isNaN(date.getTime()) && date.getFullYear() >= 1990 && date.getFullYear() <= 2030) {
          closeDateMap[d.id] = date.toISOString();
        }
      } catch(e) {}
    }
  });

  const pubMap = {};
  pubStatus.forEach(p => {
    pubMap[p.id] = p.visible === 1 && !p.noPublicado;
  });

  log(`\n📊 Data Summary:`);
  log(`  Excerpts available: ${Object.keys(bodyMap).length}`);
  log(`  Status available: ${Object.keys(statusMap).length}`);
  log(`  Close dates available: ${Object.keys(closeDateMap).length}`);
  log(`  Publication flags: ${Object.keys(pubMap).length}`);

  // ─── PHASE 2: UPDATE Supabase ───
  log('\n📤 Updating Supabase records...');

  // First, get all existing transaction IDs from Supabase that match drupal-* pattern
  const { rows: existingTx } = await pg.query(`SELECT id FROM "Transaction" WHERE id LIKE 'drupal-%'`);
  log(`  Existing drupal transactions in Supabase: ${existingTx.length}`);

  let updated = 0, skipped = 0, errors = 0;
  const BATCH = 50;

  for (let i = 0; i < existingTx.length; i += BATCH) {
    const batch = existingTx.slice(i, i + BATCH);
    
    for (const tx of batch) {
      const drupalId = parseInt(tx.id.replace('drupal-', ''));
      if (isNaN(drupalId)) { skipped++; continue; }
      
      const excerpt = bodyMap[drupalId] || null;
      const status = statusMap[drupalId] || null;
      const closeDate = closeDateMap[drupalId] || null;
      const isPublished = pubMap[drupalId] !== undefined ? pubMap[drupalId] : null;
      
      // Only update if we have something to update
      if (!excerpt && !status && !closeDate && isPublished === null) {
        skipped++;
        continue;
      }
      
      // Build dynamic UPDATE
      const sets = [];
      const params = [];
      let paramIdx = 1;
      
      if (excerpt) {
        sets.push(`excerpt = $${paramIdx}`);
        params.push(excerpt);
        paramIdx++;
      }
      if (status) {
        sets.push(`status = $${paramIdx}`);
        params.push(status);
        paramIdx++;
      }
      if (closeDate) {
        sets.push(`"dateClosed" = $${paramIdx}`);
        params.push(closeDate);
        paramIdx++;
      }
      if (isPublished !== null) {
        sets.push(`"isPublished" = $${paramIdx}`);
        params.push(isPublished);
        paramIdx++;
      }
      
      // Always update updatedAt
      sets.push(`"updatedAt" = NOW()`);
      
      params.push(tx.id);
      
      try {
        await pg.query(
          `UPDATE "Transaction" SET ${sets.join(', ')} WHERE id = $${paramIdx}`,
          params
        );
        updated++;
      } catch(e) {
        errors++;
        if (errors <= 5) log(`  ❌ Error on ${tx.id}: ${e.message?.slice(0, 80)}`);
      }
    }
    
    if ((i / BATCH) % 20 === 0 && i > 0) log(`    ... ${i}/${existingTx.length} processed`);
  }

  // ─── REPORT ───
  log('\n' + '='.repeat(50));
  log('📈 ENRICHMENT REPORT');
  log('='.repeat(50));
  log(`  Total transactions in Supabase: ${existingTx.length}`);
  log(`  Updated with new data: ${updated}`);
  log(`  Skipped (no data to add): ${skipped}`);
  log(`  Errors: ${errors}`);
  log(`  Excerpts added: ~${Object.keys(bodyMap).length}`);
  log(`  Statuses set: ~${Object.keys(statusMap).length}`);
  log(`  Close dates set: ~${Object.keys(closeDateMap).length}`);

  // Verify
  const { rows: [excCount] } = await pg.query(`SELECT COUNT(*) FROM "Transaction" WHERE excerpt IS NOT NULL`);
  const { rows: [statusCount] } = await pg.query(`SELECT COUNT(*) FROM "Transaction" WHERE status = 'Cerrado' OR status = 'En progreso'`);
  const { rows: [closeCount] } = await pg.query(`SELECT COUNT(*) FROM "Transaction" WHERE "dateClosed" IS NOT NULL`);
  const { rows: [unpubCount] } = await pg.query(`SELECT COUNT(*) FROM "Transaction" WHERE "isPublished" = false`);
  
  log('\n📊 VERIFICATION:');
  log(`  Transactions with excerpt: ${excCount.count}`);
  log(`  Transactions with status (Cerrado/En progreso): ${statusCount.count}`);
  log(`  Transactions with close date: ${closeCount.count}`);
  log(`  Transactions unpublished: ${unpubCount.count}`);

  await pg.end();
  log('\n✅ Enrichment complete!');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
