const mysql = require('mysql2/promise');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const MYSQL_CONFIG = {
  host: '104.248.230.220', port: 3306,
  user: 'zwcjasengh', password: 'KctUE3ap9p', database: 'zwcjasengh',
  connectTimeout: 30000,
};

const PA_MAP = {
  'banca y finanzas': 'Financiamientos', 'bancario': 'Financiamientos',
  'financiero': 'Financiamientos', 'project finance': 'Financiamientos',
  'mercado de capitales': 'Emisiones',
  'corporativo': 'M&A', 'fusiones y adquisiciones': 'M&A', 'm&a': 'M&A',
};

let connStr = process.env.DATABASE_URL;
if (connStr.includes('pooler.supabase.com')) connStr = connStr.replace(':5432', ':6543');
const pg = new Pool({ connectionString: connStr, max: 3 });

const stats = { firms: 0, lawyers: 0, companies: 0, industries: 0, transactions: 0, relations: 0, conflicts: 0, skipped: 0, errors: [] };
const conflicts = [];
const log = (msg) => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

function groupBy(arr, key) {
  const m = {};
  arr.forEach(i => { (m[i[key]] = m[i[key]] || []).push(i); });
  return m;
}

function classify(areaNames) {
  const types = new Set();
  for (const name of areaNames) {
    const l = name.toLowerCase();
    for (const [p, t] of Object.entries(PA_MAP)) { if (l.includes(p)) { types.add(t); break; } }
  }
  const u = [...types];
  return { type: u[0] || 'Operación General', areas: areaNames.join(', '), isConflict: u.length > 1, alts: u.slice(1) };
}

function esc(s) { return s ? s.replace(/'/g, "''") : ''; }
function uuid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random()*16|0; return (c === 'x' ? r : (r&0x3|0x8)).toString(16); }); }

async function main() {
  log('🚀 AGORA+ Migration v3: MySQL → Supabase (Raw SQL Batch)');
  log('='.repeat(55));

  // ─── READ MySQL ───
  const conn = await mysql.createConnection(MYSQL_CONFIG);
  log('✅ MySQL connected');
  const q = async (sql) => { const [r] = await conn.query(sql); return r; };

  const countries = await q(`SELECT n.nid id, d.title nombre FROM node n JOIN node_field_data d ON n.vid=d.vid WHERE n.type='pais'`);
  const paRaw = await q(`SELECT n.nid id, d.title nombre FROM node n JOIN node_field_data d ON n.vid=d.vid WHERE n.type='areas_de_practica'`);
  const indRaw = await q(`SELECT n.nid id, d.title nombre FROM node n JOIN node_field_data d ON n.vid=d.vid WHERE n.type='industria'`);
  const firmsRaw = await q(`SELECT n.nid id, d.title nombre, p.field_pais_target_id idPais FROM node n JOIN node_field_data d ON n.vid=d.vid LEFT JOIN node__field_pais p ON n.nid=p.entity_id WHERE n.type='firma'`);
  const lawyersRaw = await q(`SELECT n.nid id, d.title nombre, f.field_firma_target_id idFirma FROM node n JOIN node_field_data d ON n.vid=d.vid LEFT JOIN node__field_firma f ON n.vid=f.revision_id WHERE n.type='abogado'`);
  const companiesRaw = await q(`SELECT n.nid id, d.title nombre, p.field_pais_target_id idPais FROM node n JOIN node_field_data d ON n.vid=d.vid LEFT JOIN node__field_pais p ON n.vid=p.entity_id WHERE n.type='empresa'`);

  const posts = await q(`
    SELECT DISTINCT n.nid id, d.title titulo, d.status visible,
      t.field_tipo_de_noticia_value tipo, np.field_caso_no_publicado_value noPublicado,
      fc.field_fecha_de_concrecion_del_ac_value fechaConcrecion,
      ff.field_fecha_de_la_firma_value fechaFirma, fci.field_fecha_de_cierre_de_la_emis_value fechaCierre
    FROM node n JOIN node_field_data d ON n.vid=d.vid
    JOIN node__field_category c ON n.vid=c.revision_id
    LEFT JOIN node__field_tipo_de_noticia t ON n.vid=t.revision_id
    LEFT JOIN node__field_caso_no_publicado np ON n.vid=np.revision_id
    LEFT JOIN node__field_fecha_de_concrecion_del_ac fc ON n.vid=fc.revision_id
    LEFT JOIN node__field_fecha_de_la_firma ff ON n.vid=ff.revision_id
    LEFT JOIN node__field_fecha_de_cierre_de_la_emis fci ON n.vid=fci.revision_id
    WHERE c.field_category_target_id = 1 ORDER BY n.nid DESC`);

  const postAreas = await q(`SELECT entity_id idPost, field_ae_target_id idArea FROM node__field_ae`);
  const postFirms = await q(`SELECT entity_id idPost, field_firmas_involucradas_target_id idFirma FROM node__field_firmas_involucradas`);
  const postLawyers = await q(`SELECT entity_id idPost, field_abogados_involucrados_target_id idAbogado FROM node__field_abogados_involucrados`);
  const postIndustries = await q(`SELECT entity_id idPost, field_industrias_asociadas_target_id idIndustria FROM node__field_industrias_asociadas`);
  const postCountries = await q(`SELECT entity_id idPost, field_paises_involucrados_target_id idPais FROM node__field_paises_involucrados`);
  const postCompanies = await q(`
    SELECT ei.entity_id idPost, e.field_empresa_target_id idEmpresa, t.field_tipo_de_operacion_value tipoOp
    FROM node__field_empresas_involucradas ei
    INNER JOIN paragraph__field_empresa e ON ei.field_empresas_involucradas_target_revision_id=e.revision_id
    LEFT JOIN paragraph__field_tipo_de_operacion t ON ei.field_empresas_involucradas_target_revision_id=t.revision_id`);
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

  // ─── WRITE to Supabase via raw SQL batch ───
  log('\n📤 Writing to Supabase...');

  // Industries (batch)
  const indMap = {};
  const indDedup = [...new Map(indRaw.filter(i=>i.nombre).map(i => [i.nombre, i])).values()];
  for (const r of indDedup) {
    const id = uuid();
    try {
      await pg.query(`INSERT INTO "Industry" (id, name) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`, [id, r.nombre]);
      indMap[r.id] = id;
      stats.industries++;
    } catch(e) {}
  }
  // Get actual IDs back
  const { rows: indRows } = await pg.query('SELECT id, name FROM "Industry"');
  indRows.forEach(r => { const orig = indRaw.find(i => i.nombre === r.name); if (orig) indMap[orig.id] = r.id; });
  log(`  ✅ ${stats.industries} industries`);

  // Firms (batch insert with ON CONFLICT)
  const firmMap = {};
  const firmDedup = [...new Map(firmsRaw.filter(f=>f.nombre).map(f => [f.nombre, f])).values()];
  log(`  Inserting ${firmDedup.length} unique firms...`);
  const BATCH = 100;
  for (let i = 0; i < firmDedup.length; i += BATCH) {
    const batch = firmDedup.slice(i, i + BATCH);
    const values = batch.map(r => `('${uuid()}', '${esc(r.nombre)}', ${r.idPais && countryMap[r.idPais] ? `'${esc(countryMap[r.idPais])}'` : 'NULL'}, NOW(), NOW())`).join(',');
    try {
      await pg.query(`INSERT INTO "Firm" (id, name, country, "createdAt", "updatedAt") VALUES ${values} ON CONFLICT (name) DO NOTHING`);
    } catch(e) { stats.errors.push(`Firm batch ${i}: ${e.message?.slice(0,60)}`); }
  }
  const { rows: firmRows } = await pg.query('SELECT id, name FROM "Firm"');
  firmRows.forEach(r => { const orig = firmsRaw.find(f => f.nombre === r.name); if (orig) firmMap[orig.id] = r.id; });
  // Map all firms with same name
  firmsRaw.forEach(f => { if (f.nombre) { const found = firmRows.find(r => r.name === f.nombre); if (found) firmMap[f.id] = found.id; }});
  stats.firms = firmRows.length;
  log(`  ✅ ${stats.firms} firms`);

  // Lawyers (batch - no unique constraint, just insert)
  log(`  Inserting ${lawyersRaw.length} lawyers...`);
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
      await pg.query(`INSERT INTO "Lawyer" (id, name, "firmId", position, "createdAt", "updatedAt") VALUES ${values}`);
      stats.lawyers += batch.length;
    } catch(e) { stats.errors.push(`Lawyer batch ${i}: ${e.message?.slice(0,60)}`); }
    if ((i/BATCH) % 50 === 0 && i > 0) log(`    ... ${i}/${lawyersRaw.length}`);
  }
  log(`  ✅ ${stats.lawyers} lawyers`);

  // Companies (batch)
  log(`  Inserting ${companiesRaw.length} companies...`);
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
      await pg.query(`INSERT INTO "Company" (id, name, country) VALUES ${values}`);
      stats.companies += batch.length;
    } catch(e) { stats.errors.push(`Company batch ${i}: ${e.message?.slice(0,60)}`); }
    if ((i/BATCH) % 50 === 0 && i > 0) log(`    ... ${i}/${companiesRaw.length}`);
  }
  log(`  ✅ ${stats.companies} companies`);

  // Transactions
  log(`\n📊 Inserting transactions...`);
  const txIds = {}; // drupal nid → supabase id
  for (let i = 0; i < posts.length; i += BATCH) {
    const batch = posts.slice(i, i + BATCH);
    const validTx = [];
    for (const p of batch) {
      if (p.tipo && p.tipo !== 'Transacción') { stats.skipped++; continue; }
      const areas = (areasByPost[p.id] || []).map(a => paMap[a.idArea]).filter(Boolean);
      const cls = classify(areas);
      const money = moneyByPost[p.id];
      const ctrs = (countriesByPost[p.id] || []).map(c => countryMap[c.idPais]).filter(Boolean);
      const indRels = industriesByPost[p.id] || [];
      const firstInd = indRels[0] ? indMap[indRels[0].idIndustria] : null;
      const dateVal = p.fechaConcrecion || p.fechaFirma || p.fechaCierre || null;
      const isPub = p.visible === 1 && !p.noPublicado;
      let val = null, valStr = 'Valor confidencial';
      if (money?.montoUSD && parseFloat(money.montoUSD) > 0) { val = parseFloat(money.montoUSD); valStr = null; }
      const txId = `drupal-${p.id}`;
      txIds[p.id] = txId;

      if (cls.isConflict) {
        stats.conflicts++;
        conflicts.push({ title: p.titulo, link: `https://lexlatin.com/node/${p.id}`, areas: cls.areas, type: cls.type, alts: cls.alts });
      }

      validTx.push(`('${txId}', '${esc(p.titulo || 'Sin título')}', '${esc(cls.type)}', ${val !== null ? val : 'NULL'}, ${valStr ? `'${esc(valStr)}'` : 'NULL'}, 'Cerrada', ${ctrs[0] ? `'${esc(ctrs[0])}'` : 'NULL'}, ${isPub}, ${cls.areas ? `'${esc(cls.areas)}'` : 'NULL'}, NULL, ${dateVal ? `'${new Date(dateVal).toISOString()}'` : 'NULL'}, NULL, NOW(), NOW(), ${firstInd ? `'${firstInd}'` : 'NULL'}, 'https://lexlatin.com/node/${p.id}', NULL)`);
    }
    if (validTx.length) {
      try {
        await pg.query(`INSERT INTO "Transaction" (id, title, type, value, "valueString", status, country, "isPublished", "practiceArea", "typeOverride", "dateAnnounced", "dateClosed", "createdAt", "updatedAt", "industryId", link, excerpt) VALUES ${validTx.join(',')} ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, type=EXCLUDED.type, "isPublished"=EXCLUDED."isPublished"`);
        stats.transactions += validTx.length;
      } catch(e) {
        // Fallback: insert one by one
        for (const v of validTx) {
          try { await pg.query(`INSERT INTO "Transaction" (id, title, type, value, "valueString", status, country, "isPublished", "practiceArea", "typeOverride", "dateAnnounced", "dateClosed", "createdAt", "updatedAt", "industryId", link, excerpt) VALUES ${v} ON CONFLICT (id) DO NOTHING`); stats.transactions++; } catch(e2) { stats.errors.push(`Tx: ${e2.message?.slice(0,60)}`); }
        }
      }
    }
    if ((i/BATCH) % 20 === 0 && i > 0) log(`    ... ${i}/${posts.length} posts`);
  }
  log(`  ✅ ${stats.transactions} transactions`);

  // Relations: TransactionAdvisor (firm)
  log('🔗 Inserting relations...');
  let relCount = 0;
  for (let i = 0; i < postFirms.length; i += BATCH) {
    const batch = postFirms.slice(i, i + BATCH);
    const vals = batch.map(r => { const tid = txIds[r.idPost]; const fid = firmMap[r.idFirma]; if (!tid || !fid) return null; return `('${uuid()}', '${tid}', '${fid}', 'Asesor Legal')`; }).filter(Boolean);
    if (vals.length) { try { await pg.query(`INSERT INTO "TransactionAdvisor" (id, "transactionId", "firmId", role) VALUES ${vals.join(',')} ON CONFLICT ("transactionId", "firmId", role) DO NOTHING`); relCount += vals.length; } catch(e) {} }
  }
  for (let i = 0; i < postLawyers.length; i += BATCH) {
    const batch = postLawyers.slice(i, i + BATCH);
    const vals = batch.map(r => { const tid = txIds[r.idPost]; const lid = lawyerMap[r.idAbogado]; if (!tid || !lid) return null; return `('${uuid()}', '${tid}', '${lid}', 'Participante')`; }).filter(Boolean);
    if (vals.length) { try { await pg.query(`INSERT INTO "TransactionLawyer" (id, "transactionId", "lawyerId", role) VALUES ${vals.join(',')} ON CONFLICT ("transactionId", "lawyerId", role) DO NOTHING`); relCount += vals.length; } catch(e) {} }
  }
  for (let i = 0; i < postCompanies.length; i += BATCH) {
    const batch = postCompanies.slice(i, i + BATCH);
    const vals = batch.map(r => { const tid = txIds[r.idPost]; const cid = companyMap[r.idEmpresa]; if (!tid || !cid) return null; const role = r.tipoOp || 'Participante'; return `('${uuid()}', '${tid}', '${cid}', '${esc(role)}')`; }).filter(Boolean);
    if (vals.length) { try { await pg.query(`INSERT INTO "TransactionCompany" (id, "transactionId", "companyId", role) VALUES ${vals.join(',')} ON CONFLICT ("transactionId", "companyId", role) DO NOTHING`); relCount += vals.length; } catch(e) {} }
  }
  stats.relations = relCount;
  log(`  ✅ ${relCount} relations`);

  // Report
  log('\n' + '='.repeat(50));
  log('📈 MIGRATION REPORT');
  log('='.repeat(50));
  Object.entries(stats).forEach(([k, v]) => { if (k !== 'errors') log(`  ${k}: ${v}`); });
  log(`  errors: ${stats.errors.length}`);
  if (conflicts.length > 0) {
    const fs = require('fs');
    const csv = 'Título,URL,Tipo,Alternativas,Áreas\n' + conflicts.map(c => `"${(c.title||'').replace(/"/g,'""')}",${c.link},${c.type},"${c.alts.join('; ')}","${c.areas}"`).join('\n');
    fs.writeFileSync('migration_conflicts.csv', csv);
    log(`  📥 Conflicts CSV: migration_conflicts.csv`);
  }
  if (stats.errors.length > 0) { log('\n  Errors:'); stats.errors.slice(0,10).forEach(e => log(`  ❌ ${e}`)); }

  await pg.end();
  log('\n✅ Migration complete!');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
