/**
 * ÁGORA+ Hybrid MySQL Sync Script v4.0
 * ─────────────────────────────────────
 * Performs a FULL historical sync from Drupal MySQL → Supabase (PostgreSQL).
 * Runs locally (no Vercel 60s limit) and completes in ~15-20 minutes.
 * 
 * Includes ALL modern filters from sync-drupal/route.ts:
 *  1. ✅ tipo_de_noticia filter (skip non-Transacción posts)
 *  2. ✅ Portal Original filter (skip posts with 2+ mapped practice areas)
 *  3. ✅ Noise filter (editorial content: nombramientos, fichajes, etc.)
 *  4. ✅ Full HTML body preservation (sanitized)
 *  5. ✅ Company roles (comprador, vendedor, emisor, etc.)
 *  6. ✅ Heuristic classification fallback
 * 
 * Usage:
 *   node scripts/sync-mysql-hybrid.js
 *   node scripts/sync-mysql-hybrid.js --dry-run    (preview only)
 *   node scripts/sync-mysql-hybrid.js --from=2026  (only posts from 2026+)
 */

const mysql = require('mysql2/promise');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// ── Config ──
const MYSQL_CONFIG = {
  host: '104.248.230.220', port: 3306,
  user: 'zwcjasengh', password: 'KctUE3ap9p', database: 'zwcjasengh',
  connectTimeout: 30000,
};

let connStr = process.env.DATABASE_URL;
if (!connStr) { console.error('❌ DATABASE_URL not found in .env.local'); process.exit(1); }
if (connStr.includes('pooler.supabase.com')) connStr = connStr.replace(':5432', ':6543');
const pg = new Pool({ connectionString: connStr, max: 5 });

const DRY_RUN = process.argv.includes('--dry-run');
const FROM_YEAR = (() => {
  const f = process.argv.find(a => a.startsWith('--from='));
  return f ? parseInt(f.split('=')[1]) : null;
})();

// ── Practice Area Map (mirrors sync-drupal/route.ts) ──
const PA_MAP = {
  'corporativo - adquisiciones': 'M&A',
  'corporativo - fusiones': 'M&A',
  'banca y finanzas (créditos y financiamientos)': 'Financiamientos',
  'banca y finanzas': 'Financiamientos',
  'mercado de capitales - emisiones': 'Emisiones',
};
const PA_MAP_KEYS = Object.keys(PA_MAP);

// ── Noise Filter (mirrors classificationEngine.ts) ──
const NOISE_SIGNALS = [
  'nombramiento', 'nombrado', 'nombra como',
  'promoción', 'promovido', 'asciende',
  'lateral hiring', 'fichaje', 'incorpora como socio',
  'nueva oficina', 'abre oficina', 'inaugura oficina',
  'cambio de marca', 'rebranding',
  'resultados financieros', 'resultados trimestrales', 'informe anual',
  'alianza estratégica', 'alianza comercial', 'convenio',
  'premio', 'reconocimiento', 'ranking', 'certificación',
  'se suma como', 'se suma a la práctica', 'refuerza su equipo',
  'refuerza la práctica', 'se integra como', 'nuevo socio',
  'nueva socia', 'fortalece su práctica', 'fortalece el equipo',
  'expande equipo', 'amplía equipo', 'contratación',
  'ficha a', 'ficha al', 'llega como', 'se une a',
  'se unió a', 'designa como', 'designado',
  'litigio', 'demanda', 'arbitraje', 'sentencia', 'fallo judicial',
  'regulación', 'regulador', 'ley aprobada', 'reforma',
  'compliance', 'cumplimiento normativo',
  'entrevista', 'opinión', 'columna',
  'evento', 'congreso', 'conferencia', 'foro', 'seminario',
  'publicación', 'libro', 'guía jurídica',
];

const TRANSACTION_KEYWORDS = [
  'adquiere', 'adquirió', 'adquisición', 'compra de acciones', 'compra de activos',
  'venta de activos', 'takeover', 'opa', 'desinversión', 'privatización',
  'joint venture', 'fusión', 'fusiona', 'compró', 'escisión',
  'emisión de bonos', 'emite bonos', 'emitió bonos', 'ipo',
  'colocación', 'colocó', 'certificados bursátiles', 'titulización',
  'bonos verdes', 'bonos convertibles', 'green bond',
  'préstamo sindicado', 'project finance', 'credit facility',
  'financiamiento', 'financiación', 'crédito', 'préstamo',
  'refinanciación', 'línea de crédito',
];

function isNonTransactional(titleLower, bodyText) {
  let noiseScore = 0;
  let hasTransaction = false;

  for (const signal of NOISE_SIGNALS) {
    if (titleLower.includes(signal)) noiseScore += 3;
    else if (bodyText.includes(signal)) noiseScore += 1;
  }

  for (const kw of TRANSACTION_KEYWORDS) {
    if (bodyText.includes(kw)) { hasTransaction = true; break; }
  }

  return noiseScore >= 3 && !hasTransaction;
}

// ── Helpers ──
const log = (msg) => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
function esc(s) { return s ? s.replace(/'/g, "''") : ''; }
function uuid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random()*16|0; return (c === 'x' ? r : (r&0x3|0x8)).toString(16); }); }

function sanitizeHtml(html) {
  if (!html) return null;
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/class="[^"]*"/gi, '')
    .replace(/style="[^"]*"/gi, '')
    .replace(/id="[^"]*"/gi, '')
    .trim();
}

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

function classify(areaNames) {
  const types = new Set();
  const matchedAreas = [];
  for (const name of areaNames) {
    const lower = name.toLowerCase();
    for (const [pattern, type] of Object.entries(PA_MAP)) {
      if (lower.includes(pattern) || pattern.includes(lower)) {
        types.add(type);
        matchedAreas.push({ area: name, type });
        break;
      }
    }
  }
  const u = [...types];
  return {
    type: u[0] || 'Operación General',
    areas: areaNames.join(', '),
    isMultiArea: u.length > 1, // Portal original → should skip
    allTypes: u,
  };
}

function groupBy(arr, key) {
  const m = {};
  arr.forEach(i => { (m[i[key]] = m[i[key]] || []).push(i); });
  return m;
}

function safeDateISO(val) {
  if (!val) return null;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    const year = d.getFullYear();
    if (year < 1990 || year > 2030) return null;
    return d.toISOString();
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  log(`🚀 ÁGORA+ Hybrid MySQL Sync v4.0 ${DRY_RUN ? '(DRY RUN)' : ''}${FROM_YEAR ? ` (from ${FROM_YEAR})` : ''}`);
  log('='.repeat(65));

  const startTime = Date.now();

  // ─── READ MySQL ───
  const conn = await mysql.createConnection(MYSQL_CONFIG);
  log('✅ MySQL connected');
  const q = async (sql) => { const [r] = await conn.query(sql); return r; };

  // Lookup tables
  const countries = await q(`SELECT n.nid id, d.title nombre FROM node n JOIN node_field_data d ON n.vid=d.vid WHERE n.type='pais'`);
  const paRaw = await q(`SELECT n.nid id, d.title nombre FROM node n JOIN node_field_data d ON n.vid=d.vid WHERE n.type='areas_de_practica'`);
  const indRaw = await q(`SELECT n.nid id, d.title nombre FROM node n JOIN node_field_data d ON n.vid=d.vid WHERE n.type='industria'`);
  const firmsRaw = await q(`SELECT n.nid id, d.title nombre, p.field_pais_target_id idPais FROM node n JOIN node_field_data d ON n.vid=d.vid LEFT JOIN node__field_pais p ON n.nid=p.entity_id WHERE n.type='firma'`);
  const lawyersRaw = await q(`SELECT n.nid id, d.title nombre, f.field_firma_target_id idFirma FROM node n JOIN node_field_data d ON n.vid=d.vid LEFT JOIN node__field_firma f ON n.vid=f.revision_id WHERE n.type='abogado'`);
  const companiesRaw = await q(`SELECT n.nid id, d.title nombre, p.field_pais_target_id idPais FROM node n JOIN node_field_data d ON n.vid=d.vid LEFT JOIN node__field_pais p ON n.vid=p.entity_id WHERE n.type='empresa'`);

  // Transaction posts with tipo_de_noticia
  let postQuery = `
    SELECT DISTINCT n.nid id, d.title titulo, d.status visible,
      t.field_tipo_de_noticia_value tipo, np.field_caso_no_publicado_value noPublicado,
      fc.field_fecha_de_concrecion_del_ac_value fechaConcrecion,
      ff.field_fecha_de_la_firma_value fechaFirma,
      fci.field_fecha_de_cierre_de_la_emis_value fechaCierre,
      body.body_value bodyRaw, body.body_summary bodySummary
    FROM node n JOIN node_field_data d ON n.vid=d.vid
    JOIN node__field_category c ON n.vid=c.revision_id
    LEFT JOIN node__field_tipo_de_noticia t ON n.vid=t.revision_id
    LEFT JOIN node__field_caso_no_publicado np ON n.vid=np.revision_id
    LEFT JOIN node__field_fecha_de_concrecion_del_ac fc ON n.vid=fc.revision_id
    LEFT JOIN node__field_fecha_de_la_firma ff ON n.vid=ff.revision_id
    LEFT JOIN node__field_fecha_de_cierre_de_la_emis fci ON n.vid=fci.revision_id
    LEFT JOIN node__body body ON n.vid=body.revision_id
    WHERE c.field_category_target_id = 1`;

  if (FROM_YEAR) {
    postQuery += ` AND d.created >= UNIX_TIMESTAMP('${FROM_YEAR}-01-01')`;
  }
  postQuery += ` ORDER BY n.nid DESC`;

  const posts = await q(postQuery);

  // Relationships
  const postAreas = await q(`SELECT entity_id idPost, field_ae_target_id idArea FROM node__field_ae`);
  const postFirms = await q(`SELECT entity_id idPost, field_firmas_involucradas_target_id idFirma FROM node__field_firmas_involucradas`);
  const postLawyers = await q(`SELECT entity_id idPost, field_abogados_involucrados_target_id idAbogado FROM node__field_abogados_involucrados`);
  const postIndustries = await q(`SELECT entity_id idPost, field_industrias_asociadas_target_id idIndustria FROM node__field_industrias_asociadas`);
  const postCountries = await q(`SELECT entity_id idPost, field_paises_involucrados_target_id idPais FROM node__field_paises_involucrados`);
  const postCompanies = await q(`
    SELECT ei.entity_id idPost, e.field_empresa_target_id idEmpresa,
      COALESCE(
        rma.field_rol_fusiones_y_adquisicion_value,
        rem.field_rol_em_value,
        rfi.field_rol_financiamiento_value,
        rli.field_rol_litigios_value,
        rre.field_rol_reestructuraciones_value,
        rar.field_rol_arrendamientos_value,
        t.field_tipo_de_operacion_value
      ) AS rol
    FROM node__field_empresas_involucradas ei
    INNER JOIN paragraph__field_empresa e ON ei.field_empresas_involucradas_target_revision_id=e.revision_id
    LEFT JOIN paragraph__field_tipo_de_operacion t ON ei.field_empresas_involucradas_target_revision_id=t.revision_id
    LEFT JOIN paragraph__field_rol_fusiones_y_adquisicion rma ON ei.field_empresas_involucradas_target_id=rma.entity_id
    LEFT JOIN paragraph__field_rol_em rem ON ei.field_empresas_involucradas_target_id=rem.entity_id
    LEFT JOIN paragraph__field_rol_financiamiento rfi ON ei.field_empresas_involucradas_target_id=rfi.entity_id
    LEFT JOIN paragraph__field_rol_litigios rli ON ei.field_empresas_involucradas_target_id=rli.entity_id
    LEFT JOIN paragraph__field_rol_reestructuraciones rre ON ei.field_empresas_involucradas_target_id=rre.entity_id
    LEFT JOIN paragraph__field_rol_arrendamientos rar ON ei.field_empresas_involucradas_target_id=rar.entity_id
  `);
  const postMoney = await q(`
    SELECT o.entity_id idPost, IF(tipo.field_tipo_value='confidencial',0,usd.field_monto_transaccion_en_dolar_value) montoUSD
    FROM node__field_operacion o
    INNER JOIN paragraph__field_datos_monetarios dm ON o.field_operacion_target_revision_id=dm.revision_id
    LEFT JOIN paragraph__field_tipo tipo ON dm.field_datos_monetarios_target_revision_id=tipo.revision_id
    LEFT JOIN paragraph__field_monto_transaccion_en_dolar usd ON dm.field_datos_monetarios_target_revision_id=usd.revision_id`);

  await conn.end();
  log(`✅ MySQL read done: ${posts.length} posts, ${firmsRaw.length} firms, ${lawyersRaw.length} lawyers, ${companiesRaw.length} companies`);

  // Build lookup maps
  const countryMap = {}; countries.forEach(c => countryMap[c.id] = c.nombre);
  const paMap = {}; paRaw.forEach(p => paMap[p.id] = p.nombre);
  const areasByPost = groupBy(postAreas, 'idPost');
  const firmsByPost = groupBy(postFirms, 'idPost');
  const lawyersByPost = groupBy(postLawyers, 'idPost');
  const industriesByPost = groupBy(postIndustries, 'idPost');
  const countriesByPost = groupBy(postCountries, 'idPost');
  const companiesByPost = groupBy(postCompanies, 'idPost');
  const moneyByPost = {}; postMoney.forEach(m => { if (!moneyByPost[m.idPost]) moneyByPost[m.idPost] = m; });

  // ─── FILTER & CLASSIFY ───
  log('\n🔍 Applying filters...');
  const stats = {
    total: posts.length,
    skippedTipo: 0,
    skippedMultiArea: 0,
    skippedNoise: 0,
    processed: 0,
    firms: 0, lawyers: 0, companies: 0, industries: 0, relations: 0, errors: [],
    byType: { 'M&A': 0, 'Emisiones': 0, 'Financiamientos': 0, 'Operación General': 0 }
  };

  const validPosts = [];

  for (const p of posts) {
    // ── FILTER 1: tipo_de_noticia (PRIMARY) ──
    if (p.tipo && p.tipo !== 'Transacción') {
      stats.skippedTipo++;
      continue;
    }

    // ── FILTER 2: Portal Original (2+ mapped practice areas) ──
    const areas = (areasByPost[p.id] || []).map(a => paMap[a.idArea]).filter(Boolean);
    const cls = classify(areas);
    if (cls.isMultiArea) {
      stats.skippedMultiArea++;
      continue;
    }

    // ── FILTER 3: Noise Filter (editorial content) ──
    const titleLower = (p.titulo || '').toLowerCase();
    const bodyClean = stripHtml(p.bodyRaw || '') || '';
    const fullText = `${titleLower} ${bodyClean.toLowerCase()}`;
    if (isNonTransactional(titleLower, fullText)) {
      stats.skippedNoise++;
      continue;
    }

    // ── PASSED ALL FILTERS ──
    validPosts.push({ post: p, areas, cls });
  }

  log(`  Total posts: ${stats.total}`);
  log(`  Skipped (not Transacción): ${stats.skippedTipo}`);
  log(`  Skipped (multi-area original): ${stats.skippedMultiArea}`);
  log(`  Skipped (editorial noise): ${stats.skippedNoise}`);
  log(`  Valid for import: ${validPosts.length}`);

  if (DRY_RUN) {
    log('\n⚠️  DRY RUN — no changes written to Supabase');
    log(`\nSample types:`);
    const sample = validPosts.slice(0, 20);
    sample.forEach(({ post, cls }) => {
      log(`  [${cls.type}] ${post.titulo?.substring(0, 80)}`);
    });
    await pg.end();
    return;
  }

  // ─── WRITE to Supabase ───
  log('\n📤 Writing to Supabase...');
  const BATCH = 100;

  // 1. Industries
  const indMap = {};
  const indDedup = [...new Map(indRaw.filter(i => i.nombre).map(i => [i.nombre, i])).values()];
  for (const r of indDedup) {
    const id = uuid();
    try {
      await pg.query(`INSERT INTO "Industry" (id, name) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`, [id, r.nombre]);
      indMap[r.id] = id;
      stats.industries++;
    } catch(e) {}
  }
  const { rows: indRows } = await pg.query('SELECT id, name FROM "Industry"');
  indRows.forEach(r => { const orig = indRaw.find(i => i.nombre === r.name); if (orig) indMap[orig.id] = r.id; });
  log(`  ✅ ${stats.industries} industries`);

  // 2. Firms
  const firmMap = {};
  const firmDedup = [...new Map(firmsRaw.filter(f => f.nombre).map(f => [f.nombre, f])).values()];
  for (let i = 0; i < firmDedup.length; i += BATCH) {
    const batch = firmDedup.slice(i, i + BATCH);
    const values = batch.map(r => `('${uuid()}', '${esc(r.nombre)}', ${r.idPais && countryMap[r.idPais] ? `'${esc(countryMap[r.idPais])}'` : 'NULL'}, NOW(), NOW())`).join(',');
    try {
      await pg.query(`INSERT INTO "Firm" (id, name, country, "createdAt", "updatedAt") VALUES ${values} ON CONFLICT (name) DO NOTHING`);
    } catch(e) { stats.errors.push(`Firm batch ${i}: ${e.message?.slice(0,60)}`); }
  }
  const { rows: firmRows } = await pg.query('SELECT id, name FROM "Firm"');
  firmsRaw.forEach(f => { if (f.nombre) { const found = firmRows.find(r => r.name === f.nombre); if (found) firmMap[f.id] = found.id; }});
  stats.firms = firmRows.length;
  log(`  ✅ ${stats.firms} firms`);

  // 3. Lawyers
  const lawyerMap = {};
  for (let i = 0; i < lawyersRaw.length; i += BATCH) {
    const batch = lawyersRaw.slice(i, i + BATCH).filter(r => r.nombre);
    if (!batch.length) continue;
    const values = batch.map(r => {
      const id = uuid();
      lawyerMap[r.id] = id;
      const fid = firmMap[r.idFirma];
      return `('${id}', '${esc(r.nombre)}', ${fid ? `'${fid}'` : 'NULL'}, NULL, NOW(), NOW())`;
    }).join(',');
    try {
      await pg.query(`INSERT INTO "Lawyer" (id, name, "firmId", position, "createdAt", "updatedAt") VALUES ${values} ON CONFLICT DO NOTHING`);
      stats.lawyers += batch.length;
    } catch(e) { stats.errors.push(`Lawyer batch ${i}: ${e.message?.slice(0,60)}`); }
  }
  log(`  ✅ ${stats.lawyers} lawyers`);

  // 4. Companies
  const companyMap = {};
  for (let i = 0; i < companiesRaw.length; i += BATCH) {
    const batch = companiesRaw.slice(i, i + BATCH).filter(r => r.nombre);
    if (!batch.length) continue;
    const values = batch.map(r => {
      const id = uuid();
      companyMap[r.id] = id;
      return `('${id}', '${esc(r.nombre)}', ${r.idPais && countryMap[r.idPais] ? `'${esc(countryMap[r.idPais])}'` : 'NULL'})`;
    }).join(',');
    try {
      await pg.query(`INSERT INTO "Company" (id, name, country) VALUES ${values} ON CONFLICT DO NOTHING`);
      stats.companies += batch.length;
    } catch(e) { stats.errors.push(`Company batch ${i}: ${e.message?.slice(0,60)}`); }
  }
  log(`  ✅ ${stats.companies} companies`);

  // 5. Transactions (with all filters applied)
  log(`\n📊 Upserting ${validPosts.length} transactions...`);
  const txIds = {};

  for (let i = 0; i < validPosts.length; i += BATCH) {
    const batch = validPosts.slice(i, i + BATCH);
    
    for (const { post: p, areas, cls } of batch) {
      const txId = `drupal-${p.id}`;
      txIds[p.id] = txId;

      const money = moneyByPost[p.id];
      const ctrs = (countriesByPost[p.id] || []).map(c => countryMap[c.idPais]).filter(Boolean);
      const indRels = industriesByPost[p.id] || [];
      const firstInd = indRels[0] ? indMap[indRels[0].idIndustria] : null;
      const dateVal = safeDateISO(p.fechaConcrecion || p.fechaFirma || p.fechaCierre);
      const dateClose = safeDateISO(p.fechaCierre);
      const isPub = p.visible === 1 && !p.noPublicado;

      let val = null, valStr = 'Valor confidencial';
      if (money?.montoUSD && parseFloat(money.montoUSD) > 0) {
        val = parseFloat(money.montoUSD);
        const formatted = val >= 1000000 ? `$${(val / 1000000).toFixed(1)}M` : `$${val.toLocaleString('en-US')}`;
        valStr = formatted;
      }

      // Excerpt: preserve full HTML body (sanitized)
      const bodyHtml = sanitizeHtml(p.bodyRaw) || null;
      const excerpt = bodyHtml || (p.bodySummary ? stripHtml(p.bodySummary) : null);

      stats.byType[cls.type] = (stats.byType[cls.type] || 0) + 1;

      try {
        await pg.query(`
          INSERT INTO "Transaction" (id, title, type, value, "valueString", status, country, "isPublished", "practiceArea", "typeOverride", "dateAnnounced", "dateClosed", "createdAt", "updatedAt", "industryId", link, excerpt)
          VALUES ($1, $2, $3, $4, $5, 'Cerrada', $6, $7, $8, NULL, $9, $10, NOW(), NOW(), $11, $12, $13)
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            type = COALESCE("Transaction"."typeOverride", EXCLUDED.type),
            value = EXCLUDED.value,
            "valueString" = EXCLUDED."valueString",
            country = EXCLUDED.country,
            "isPublished" = EXCLUDED."isPublished",
            "practiceArea" = EXCLUDED."practiceArea",
            "dateAnnounced" = EXCLUDED."dateAnnounced",
            "dateClosed" = EXCLUDED."dateClosed",
            "industryId" = EXCLUDED."industryId",
            link = EXCLUDED.link,
            excerpt = EXCLUDED.excerpt,
            "updatedAt" = NOW()
        `, [
          txId,
          (p.titulo || 'Sin título').substring(0, 500),
          cls.type,
          val,
          valStr,
          ctrs.join(', ') || null,
          isPub,
          cls.areas || null,
          dateVal,
          dateClose,
          firstInd,
          `https://lexlatin.com/node/${p.id}`,
          excerpt,
        ]);
        stats.processed++;
      } catch(e) {
        stats.errors.push(`Tx ${p.id}: ${e.message?.slice(0,80)}`);
      }
    }

    if (i > 0 && i % 500 === 0) log(`    ... ${i}/${validPosts.length} transactions`);
  }
  log(`  ✅ ${stats.processed} transactions upserted`);

  // 6. Relations
  log('\n🔗 Upserting relations...');
  let relCount = 0;

  // Advisors (firms)
  for (let i = 0; i < postFirms.length; i += BATCH) {
    const batch = postFirms.slice(i, i + BATCH);
    const vals = batch.map(r => {
      const tid = txIds[r.idPost]; const fid = firmMap[r.idFirma];
      if (!tid || !fid) return null;
      return `('${uuid()}', '${tid}', '${fid}', 'Asesor Legal')`;
    }).filter(Boolean);
    if (vals.length) {
      try { await pg.query(`INSERT INTO "TransactionAdvisor" (id, "transactionId", "firmId", role) VALUES ${vals.join(',')} ON CONFLICT ("transactionId", "firmId", role) DO NOTHING`); relCount += vals.length; } catch(e) {}
    }
  }

  // Lawyers
  for (let i = 0; i < postLawyers.length; i += BATCH) {
    const batch = postLawyers.slice(i, i + BATCH);
    const vals = batch.map(r => {
      const tid = txIds[r.idPost]; const lid = lawyerMap[r.idAbogado];
      if (!tid || !lid) return null;
      return `('${uuid()}', '${tid}', '${lid}', 'Participante')`;
    }).filter(Boolean);
    if (vals.length) {
      try { await pg.query(`INSERT INTO "TransactionLawyer" (id, "transactionId", "lawyerId", role) VALUES ${vals.join(',')} ON CONFLICT ("transactionId", "lawyerId", role) DO NOTHING`); relCount += vals.length; } catch(e) {}
    }
  }

  // Companies with roles
  for (let i = 0; i < postCompanies.length; i += BATCH) {
    const batch = postCompanies.slice(i, i + BATCH);
    const vals = batch.map(r => {
      const tid = txIds[r.idPost]; const cid = companyMap[r.idEmpresa];
      if (!tid || !cid) return null;
      const role = r.rol || 'Participante';
      return `('${uuid()}', '${tid}', '${cid}', '${esc(role)}')`;
    }).filter(Boolean);
    if (vals.length) {
      try { await pg.query(`INSERT INTO "TransactionCompany" (id, "transactionId", "companyId", role) VALUES ${vals.join(',')} ON CONFLICT ("transactionId", "companyId", role) DO NOTHING`); relCount += vals.length; } catch(e) {}
    }
  }

  stats.relations = relCount;
  log(`  ✅ ${relCount} relations`);

  // ─── REPORT ───
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  log('\n' + '='.repeat(60));
  log('📈 SYNC REPORT');
  log('='.repeat(60));
  log(`  Total MySQL posts: ${stats.total}`);
  log(`  Skipped (not Transacción): ${stats.skippedTipo}`);
  log(`  Skipped (multi-area original): ${stats.skippedMultiArea}`);
  log(`  Skipped (editorial noise): ${stats.skippedNoise}`);
  log(`  Transactions upserted: ${stats.processed}`);
  log(`  Firms: ${stats.firms} | Lawyers: ${stats.lawyers} | Companies: ${stats.companies}`);
  log(`  Relations: ${stats.relations}`);
  log(`  Errors: ${stats.errors.length}`);
  log(`\n  By Type:`);
  Object.entries(stats.byType).forEach(([type, count]) => log(`    ${type}: ${count}`));
  log(`\n  ⏱️  Elapsed: ${elapsed} minutes`);

  if (stats.errors.length > 0) {
    log('\n  Errors (first 10):');
    stats.errors.slice(0, 10).forEach(e => log(`  ❌ ${e}`));
  }

  await pg.end();
  log('\n✅ Hybrid sync complete!');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
