// Maintenance Script: Purge deleted nodes (404s) and non-transaction/None posts from Agora DB
// Run with: npx tsx scripts/purge-deleted-and-none.ts

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

import { Pool } from 'pg'

const KNOWN_DELETED_NIDS = [
  132999, // Mercado Pago emite sus ONs clases 4, 5 y 6 (Eliminado en Drupal)
  133004, // La Provincia del Chubut emite sus Letras del Tesoro Serie CXVIII Clase 2 (Eliminado en Drupal)
  133243, // El Banco de la Provincia de Buenos Aires emite sus ONs Clase V y VI (Eliminado en Drupal)
  133487, // El Banco Comafi emite sus ONs Clases XXIV y XXV (Eliminado en Drupal)
  132489, // JHSF se hace con hotel de Enjoy en Punta del Este (Eliminado en Drupal)
]

const DRUPAL_API_BASE = process.env.DRUPAL_API_URL || 'https://lexlatin.com/api/agora/transactions'
const DRUPAL_AGORA_TOKEN = process.env.DRUPAL_AGORA_TOKEN || 'agora-etl-2026-secure-token'

async function main() {
  let connStr = process.env.DATABASE_URL
  if (!connStr) {
    console.error('❌ DATABASE_URL not set')
    process.exit(1)
  }
  if (connStr.includes('pooler.supabase.com')) {
    connStr = connStr.replace(':5432', ':6543')
  }

  const pool = new Pool({ connectionString: connStr, max: 2 })
  const client = await pool.connect()

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('🧹 PURGE: Eliminadas en Drupal (404s) y Notas en None')
  console.log('═══════════════════════════════════════════════════════════════\n')

  const toDeleteIds = new Set<string>()
  const reasons = new Map<string, string>()

  // ── 1. Agregar NIDs confirmados eliminados en Drupal (404s) ──
  console.log('🔍 Paso 1: Verificando NIDs eliminados conocidos...')
  for (const nid of KNOWN_DELETED_NIDS) {
    const txId = `drupal-${nid}`
    toDeleteIds.add(txId)
    reasons.set(txId, `Eliminada en Drupal (HTTP 404) [nid: ${nid}]`)
  }

  // ── 2. Escanear Drupal API para detectar posts con tipo_de_noticia !== 'Transacción' ──
  console.log('📡 Paso 2: Escaneando Drupal API para detectar posts en None / No-Transacción...')
  let page = 0
  const LIMIT = 50
  const MAX_PAGES = 40 // Escanear hasta 2,000 posts recientes de Drupal
  let scannedCount = 0

  while (page < MAX_PAGES) {
    const url = `${DRUPAL_API_BASE}?page=${page}&limit=${LIMIT}&status=all`
    try {
      const res = await fetch(url, {
        headers: {
          'X-Agora-Token': DRUPAL_AGORA_TOKEN,
          'Accept': 'application/json'
        }
      })

      if (!res.ok) {
        console.error(`  ⚠️ Error en página ${page}: ${res.status}`)
        break
      }

      const json = await res.json()
      const posts = json.data || []
      if (posts.length === 0) break

      for (const p of posts) {
        scannedCount++
        const tipo = (p.field_tipo_de_noticia || '').toLowerCase().trim()
        if (tipo !== 'transacción' && tipo !== 'transaccion') {
          const txId = `drupal-${p.nid}`
          toDeleteIds.add(txId)
          reasons.set(txId, `Tipo de noticia en None/no-transacción ("${p.field_tipo_de_noticia || 'None'}") [nid: ${p.nid}]`)
        }
      }

      if (posts.length < LIMIT) break
      page++
    } catch (e: any) {
      console.error(`  ⚠️ Error de red en página ${page}:`, e.message)
      break
    }
  }
  console.log(`  ✅ ${scannedCount} posts escaneados en Drupal.`)
  console.log(`  🎯 Total de IDs candidatos a purga: ${toDeleteIds.size}\n`)

  // ── 3. Comprobar cuáles de estos IDs realmente existen en Ágora ──
  console.log('🔎 Paso 3: Cruzando candidatos contra la base de datos de Ágora...')
  const allCandidateIds = Array.from(toDeleteIds)
  const existingInDb: Array<{ id: string; title: string }> = []

  // Consultar en bloques de 100 para evitar límites de parámetros
  const BATCH_SIZE = 100
  for (let i = 0; i < allCandidateIds.length; i += BATCH_SIZE) {
    const chunk = allCandidateIds.slice(i, i + BATCH_SIZE)
    const placeholders = chunk.map((_, idx) => `$${idx + 1}`).join(', ')
    const { rows } = await client.query(
      `SELECT id, title FROM "Transaction" WHERE id IN (${placeholders})`,
      chunk
    )
    for (const r of rows) {
      existingInDb.push({ id: r.id, title: r.title })
    }
  }

  console.log(`  🚨 Se encontraron ${existingInDb.length} transacciones en Ágora que deben eliminarse:`)
  existingInDb.forEach((item, idx) => {
    const reason = reasons.get(item.id) || 'Criterio de exclusión'
    console.log(`    ${(idx + 1).toString().padStart(2)}. [${item.id}] "${item.title.substring(0, 65)}"`)
    console.log(`        Motivo: ${reason}`)
  })

  if (existingInDb.length === 0) {
    console.log('\n✅ La base de datos ya está limpia. No hay registros para eliminar.')
    client.release()
    await pool.end()
    return
  }

  // ── 4. Ejecutar la eliminación en cascada ──
  console.log('\n🗑️  Paso 4: Eliminando registros y relaciones en cascada...')
  const idsToDelete = existingInDb.map(item => item.id)

  let delCompanies = 0
  let delLawyers = 0
  let delAdvisors = 0
  let delTx = 0

  for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
    const chunk = idsToDelete.slice(i, i + BATCH_SIZE)
    const placeholders = chunk.map((_, idx) => `$${idx + 1}`).join(', ')

    const rComp = await client.query(
      `DELETE FROM "TransactionCompany" WHERE "transactionId" IN (${placeholders})`,
      chunk
    )
    delCompanies += rComp.rowCount || 0

    const rLaw = await client.query(
      `DELETE FROM "TransactionLawyer" WHERE "transactionId" IN (${placeholders})`,
      chunk
    )
    delLawyers += rLaw.rowCount || 0

    const rAdv = await client.query(
      `DELETE FROM "TransactionAdvisor" WHERE "transactionId" IN (${placeholders})`,
      chunk
    )
    delAdvisors += rAdv.rowCount || 0

    const rTx = await client.query(
      `DELETE FROM "Transaction" WHERE id IN (${placeholders})`,
      chunk
    )
    delTx += rTx.rowCount || 0
  }

  console.log('  ✅ Purga completada:')
  console.log(`     - Transacciones eliminadas:       ${delTx}`)
  console.log(`     - TransactionAdvisor eliminadas:  ${delAdvisors}`)
  console.log(`     - TransactionLawyer eliminadas:   ${delLawyers}`)
  console.log(`     - TransactionCompany eliminadas:  ${delCompanies}\n`)

  // ── 5. Verificación de integridad ──
  console.log('📊 Paso 5: Verificando estado final de la base de datos...')
  const { rows: countRows } = await client.query(`SELECT count(*) FROM "Transaction"`)
  console.log(`  Total de transacciones limpias restantes en Ágora: ${countRows[0].count}`)

  client.release()
  await pool.end()
  console.log('\n🚀 Listo. La base de datos está depurada.')
}

main().catch(err => {
  console.error('❌ Error ejecutando purga:', err)
  process.exit(1)
})
