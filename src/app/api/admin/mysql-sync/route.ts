import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * MySQL Direct Sync — runs MySQL → Supabase in chunks.
 * Each invocation processes CHUNK_SIZE posts within Vercel's timeout.
 * The frontend loops calling this endpoint until all posts are processed.
 * 
 * POST /api/admin/mysql-sync
 * Body: { offset?: number, chunkSize?: number }
 * 
 * Response: { success, processed, skipped, offset, hasMore, stats }
 */

// ── Practice Area Map ──
const PA_MAP: Record<string, string> = {
  'corporativo - adquisiciones': 'M&A',
  'corporativo - fusiones': 'M&A',
  'banca y finanzas (créditos y financiamientos)': 'Financiamientos',
  'banca y finanzas': 'Financiamientos',
  'mercado de capitales - emisiones': 'Emisiones',
}
const PA_MAP_KEYS = Object.keys(PA_MAP)

// ── Noise Filter (matches classificationEngine.ts) ──
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
  'evento', 'congreso', 'conferencia', 'foro', 'seminario',
]

const TX_KEYWORDS = [
  'adquiere', 'adquirió', 'adquisición', 'compra de acciones', 'venta de activos',
  'takeover', 'opa', 'desinversión', 'privatización', 'fusión', 'compró', 'escisión',
  'emisión de bonos', 'emite bonos', 'ipo', 'colocación', 'colocó',
  'certificados bursátiles', 'titulización', 'bonos verdes', 'green bond',
  'préstamo sindicado', 'project finance', 'credit facility',
  'financiamiento', 'financiación', 'crédito', 'préstamo', 'línea de crédito',
]

function isNonTransactional(titleLower: string, bodyText: string): boolean {
  let noiseScore = 0
  let hasTx = false
  for (const s of NOISE_SIGNALS) {
    if (titleLower.includes(s)) noiseScore += 3
    else if (bodyText.includes(s)) noiseScore += 1
  }
  for (const kw of TX_KEYWORDS) {
    if (bodyText.includes(kw)) { hasTx = true; break }
  }
  return noiseScore >= 3 && !hasTx
}

function classifyAreas(areaNames: string[]) {
  const types = new Set<string>()
  for (const name of areaNames) {
    const lower = name.toLowerCase()
    for (const [pattern, type] of Object.entries(PA_MAP)) {
      if (lower.includes(pattern) || pattern.includes(lower)) {
        types.add(type)
        break
      }
    }
  }
  const u = [...types]
  return { type: u[0] || 'Operación General', areas: areaNames.join(', '), isMultiArea: u.length > 1 }
}

function sanitizeHtml(html: string | null): string | null {
  if (!html) return null
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/class="[^"]*"/gi, '')
    .replace(/style="[^"]*"/gi, '')
    .trim()
}

function stripHtml(html: string | null): string {
  if (!html) return ''
  return html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim()
}

function safeDateISO(val: string | null): string | null {
  if (!val) return null
  try {
    const d = new Date(val)
    if (isNaN(d.getTime())) return null
    const year = d.getFullYear()
    if (year < 1990 || year > 2030) return null
    return d.toISOString()
  } catch { return null }
}

export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    const body = await request.json().catch(() => ({}))
    const offset = body.offset || 0
    const CHUNK_SIZE = body.chunkSize || 200

    // ── Dynamic import mysql2 ──
    let mysqlLib: any
    try {
      mysqlLib = await import('mysql2/promise')
    } catch {
      return NextResponse.json({
        success: false,
        error: 'mysql2 no está instalado. Ejecuta: npm install mysql2'
      }, { status: 500 })
    }

    // ── Connect to MySQL ──
    let conn: any
    try {
      const createConn = mysqlLib.createConnection || mysqlLib.default?.createConnection
      conn = await createConn({
        host: '104.248.230.220', port: 3306,
        user: 'zwcjasengh', password: 'KctUE3ap9p', database: 'zwcjasengh',
        connectTimeout: 10000,
      })
    } catch (e: any) {
      return NextResponse.json({
        success: false,
        error: `Error conectando a MySQL: ${e.message}. ¿La IP del servidor está en el whitelist de Cloudways?`,
        needsWhitelist: true,
      }, { status: 503 })
    }

    const q = async (sql: string) => { const [r] = await conn.query(sql); return r as any[] }

    // ── Read lookup data (fast, <1s) ──
    const countries = await q(`SELECT n.nid id, d.title nombre FROM node n JOIN node_field_data d ON n.vid=d.vid WHERE n.type='pais'`)
    const paRaw = await q(`SELECT n.nid id, d.title nombre FROM node n JOIN node_field_data d ON n.vid=d.vid WHERE n.type='areas_de_practica'`)
    const indRaw = await q(`SELECT n.nid id, d.title nombre FROM node n JOIN node_field_data d ON n.vid=d.vid WHERE n.type='industria'`)
    
    const countryMap: Record<number, string> = {}
    countries.forEach((c: any) => countryMap[c.id] = c.nombre)
    const paMap: Record<number, string> = {}
    paRaw.forEach((p: any) => paMap[p.id] = p.nombre)

    // ── Get total count ──
    const [{ total }] = await q(`
      SELECT COUNT(DISTINCT n.nid) as total FROM node n
      JOIN node_field_data d ON n.vid=d.vid
      JOIN node__field_category c ON n.vid=c.revision_id
      WHERE c.field_category_target_id = 1
    `)

    // ── Read chunk of posts ──
    const posts = await q(`
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
      WHERE c.field_category_target_id = 1
      ORDER BY n.nid DESC
      LIMIT ${CHUNK_SIZE} OFFSET ${offset}
    `)

    if (posts.length === 0) {
      await conn.end()
      return NextResponse.json({
        success: true, processed: 0, skipped: 0,
        offset, hasMore: false, total,
        message: 'Sincronización MySQL completada — no hay más posts.',
        durationMs: Date.now() - startTime,
      })
    }

    const nids = posts.map((p: any) => p.id)

    // ── Read relationships for this chunk ──
    const postAreas = await q(`SELECT entity_id idPost, field_ae_target_id idArea FROM node__field_ae WHERE entity_id IN (${nids.join(',')})`)
    const postFirms = await q(`SELECT entity_id idPost, field_firmas_involucradas_target_id idFirma FROM node__field_firmas_involucradas WHERE entity_id IN (${nids.join(',')})`)
    const postLawyers = await q(`SELECT entity_id idPost, field_abogados_involucrados_target_id idAbogado FROM node__field_abogados_involucrados WHERE entity_id IN (${nids.join(',')})`)
    const postIndustries = await q(`SELECT entity_id idPost, field_industrias_asociadas_target_id idIndustria FROM node__field_industrias_asociadas WHERE entity_id IN (${nids.join(',')})`)
    const postCountries = await q(`SELECT entity_id idPost, field_paises_involucrados_target_id idPais FROM node__field_paises_involucrados WHERE entity_id IN (${nids.join(',')})`)
    
    const postCompanies = await q(`
      SELECT ei.entity_id idPost, e.field_empresa_target_id idEmpresa, cd.title nombre,
        COALESCE(rma.field_rol_fusiones_y_adquisicion_value, rem.field_rol_em_value,
        rfi.field_rol_financiamiento_value, t.field_tipo_de_operacion_value) AS rol
      FROM node__field_empresas_involucradas ei
      INNER JOIN paragraph__field_empresa e ON ei.field_empresas_involucradas_target_revision_id=e.revision_id
      INNER JOIN node_field_data cd ON e.field_empresa_target_id=cd.nid
      LEFT JOIN paragraph__field_tipo_de_operacion t ON ei.field_empresas_involucradas_target_revision_id=t.revision_id
      LEFT JOIN paragraph__field_rol_fusiones_y_adquisicion rma ON ei.field_empresas_involucradas_target_id=rma.entity_id
      LEFT JOIN paragraph__field_rol_em rem ON ei.field_empresas_involucradas_target_id=rem.entity_id
      LEFT JOIN paragraph__field_rol_financiamiento rfi ON ei.field_empresas_involucradas_target_id=rfi.entity_id
      WHERE ei.entity_id IN (${nids.join(',')})
    `)

    const postMoney = await q(`
      SELECT o.entity_id idPost, IF(tipo.field_tipo_value='confidencial',0,usd.field_monto_transaccion_en_dolar_value) montoUSD
      FROM node__field_operacion o
      INNER JOIN paragraph__field_datos_monetarios dm ON o.field_operacion_target_revision_id=dm.revision_id
      LEFT JOIN paragraph__field_tipo tipo ON dm.field_datos_monetarios_target_revision_id=tipo.revision_id
      LEFT JOIN paragraph__field_monto_transaccion_en_dolar usd ON dm.field_datos_monetarios_target_revision_id=usd.revision_id
      WHERE o.entity_id IN (${nids.join(',')})
    `)

    // Read firm names for this chunk
    const firmNids = [...new Set(postFirms.map((f: any) => f.idFirma).filter(Boolean))]
    let firmNamesMap: Record<number, string> = {}
    if (firmNids.length > 0) {
      const firmNames = await q(`SELECT n.nid id, d.title nombre FROM node n JOIN node_field_data d ON n.vid=d.vid WHERE n.nid IN (${firmNids.join(',')})`)
      firmNames.forEach((f: any) => firmNamesMap[f.id] = f.nombre)
    }

    // Read lawyer names for this chunk
    const lawyerNids = [...new Set(postLawyers.map((l: any) => l.idAbogado).filter(Boolean))]
    let lawyerNamesMap: Record<number, { nombre: string; idFirma: number | null }> = {}
    if (lawyerNids.length > 0) {
      const lawyerNames = await q(`SELECT n.nid id, d.title nombre, f.field_firma_target_id idFirma FROM node n JOIN node_field_data d ON n.vid=d.vid LEFT JOIN node__field_firma f ON n.vid=f.revision_id WHERE n.nid IN (${lawyerNids.join(',')})`)
      lawyerNames.forEach((l: any) => lawyerNamesMap[l.id] = { nombre: l.nombre, idFirma: l.idFirma })
    }

    await conn.end() // Close MySQL — all data read

    // ── Group relationships by post ──
    const groupBy = (arr: any[], key: string) => {
      const m: Record<number, any[]> = {}
      arr.forEach(i => { (m[i[key]] = m[i[key]] || []).push(i) })
      return m
    }
    const areasByPost = groupBy(postAreas, 'idPost')
    const firmsByPost = groupBy(postFirms, 'idPost')
    const lawyersByPost = groupBy(postLawyers, 'idPost')
    const indByPost = groupBy(postIndustries, 'idPost')
    const ctryByPost = groupBy(postCountries, 'idPost')
    const compByPost = groupBy(postCompanies, 'idPost')
    const moneyByPost: Record<number, any> = {}
    postMoney.forEach((m: any) => { if (!moneyByPost[m.idPost]) moneyByPost[m.idPost] = m })

    // ── Process & Write to Supabase ──
    let processed = 0
    let skippedTipo = 0
    let skippedMultiArea = 0
    let skippedNoise = 0

    for (const p of posts) {
      // FILTER 1: tipo_de_noticia
      if (p.tipo && p.tipo !== 'Transacción') { skippedTipo++; continue }

      // FILTER 2: Portal Original (2+ mapped areas)
      const areas = (areasByPost[p.id] || []).map((a: any) => paMap[a.idArea]).filter(Boolean)
      const cls = classifyAreas(areas)
      if (cls.isMultiArea) { skippedMultiArea++; continue }

      // FILTER 3: Noise filter
      const titleLower = (p.titulo || '').toLowerCase()
      const bodyClean = stripHtml(p.bodyRaw || '').toLowerCase()
      if (isNonTransactional(titleLower, `${titleLower} ${bodyClean}`)) { skippedNoise++; continue }

      // ── Build data ──
      const txId = `drupal-${p.id}`
      const ctrs = (ctryByPost[p.id] || []).map((c: any) => countryMap[c.idPais]).filter(Boolean)
      const dateVal = safeDateISO(p.fechaConcrecion || p.fechaFirma || p.fechaCierre)
      const dateClose = safeDateISO(p.fechaCierre)
      const isPub = p.visible === 1 && !p.noPublicado
      const money = moneyByPost[p.id]
      let val: number | null = null, valStr = 'Valor confidencial'
      if (money?.montoUSD && parseFloat(money.montoUSD) > 0) {
        val = parseFloat(money.montoUSD)
        valStr = val >= 1000000 ? `$${(val / 1000000).toFixed(1)}M` : `$${val.toLocaleString('en-US')}`
      }
      const bodyHtml = sanitizeHtml(p.bodyRaw) || null
      const excerpt = bodyHtml || (p.bodySummary ? stripHtml(p.bodySummary) : null)

      // Industry
      const indRels = indByPost[p.id] || []
      let prismaIndustryId: string | null = null
      if (indRels[0]) {
        const indName = indRaw.find((i: any) => i.id === indRels[0].idIndustria)?.nombre
        if (indName) {
          const ind = await prisma.industry.upsert({
            where: { name: indName },
            create: { name: indName },
            update: {}
          })
          prismaIndustryId = ind.id
        }
      }

      // ── Upsert Transaction ──
      const existing = await prisma.transaction.findUnique({
        where: { id: txId },
        select: { typeOverride: true }
      })

      await prisma.transaction.upsert({
        where: { id: txId },
        create: {
          id: txId,
          title: (p.titulo || 'Sin título').substring(0, 500),
          type: cls.type,
          value: val,
          valueString: valStr,
          status: 'Cerrada',
          country: ctrs.join(', ') || null,
          isPublished: isPub,
          practiceArea: cls.areas || null,
          dateAnnounced: dateVal ? new Date(dateVal) : null,
          dateClosed: dateClose ? new Date(dateClose) : null,
          industryId: prismaIndustryId,
          link: `https://lexlatin.com/node/${p.id}`,
          excerpt,
        },
        update: {
          title: (p.titulo || 'Sin título').substring(0, 500),
          type: existing?.typeOverride || cls.type,
          value: val,
          valueString: valStr,
          country: ctrs.join(', ') || null,
          isPublished: isPub,
          practiceArea: cls.areas || null,
          dateAnnounced: dateVal ? new Date(dateVal) : null,
          dateClosed: dateClose ? new Date(dateClose) : null,
          industryId: prismaIndustryId,
          link: `https://lexlatin.com/node/${p.id}`,
          excerpt,
        }
      })

      // ── Firms (advisors) ──
      for (const rel of (firmsByPost[p.id] || [])) {
        const firmName = firmNamesMap[rel.idFirma]
        if (!firmName) continue
        try {
          const firm = await prisma.firm.upsert({
            where: { name: firmName }, create: { name: firmName }, update: {}
          })
          await prisma.transactionAdvisor.upsert({
            where: { transactionId_firmId_role: { transactionId: txId, firmId: firm.id, role: 'Asesor Legal' } },
            create: { transactionId: txId, firmId: firm.id, role: 'Asesor Legal' },
            update: {}
          })
        } catch {}
      }

      // ── Lawyers ──
      for (const rel of (lawyersByPost[p.id] || [])) {
        const lawyerInfo = lawyerNamesMap[rel.idAbogado]
        if (!lawyerInfo?.nombre) continue
        try {
          let firmId: string | undefined
          if (lawyerInfo.idFirma && firmNamesMap[lawyerInfo.idFirma]) {
            const firm = await prisma.firm.upsert({
              where: { name: firmNamesMap[lawyerInfo.idFirma] },
              create: { name: firmNamesMap[lawyerInfo.idFirma] }, update: {}
            })
            firmId = firm.id
          }
          const lawyerId = `drupal-lawyer-${lawyerInfo.nombre.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 60)}`
          const lawyer = await prisma.lawyer.upsert({
            where: { id: lawyerId },
            create: { id: lawyerId, name: lawyerInfo.nombre, firmId: firmId || null },
            update: { name: lawyerInfo.nombre, firmId: firmId || undefined }
          })
          await prisma.transactionLawyer.upsert({
            where: { transactionId_lawyerId_role: { transactionId: txId, lawyerId: lawyer.id, role: 'Abogado Involucrado' } },
            create: { transactionId: txId, lawyerId: lawyer.id, role: 'Abogado Involucrado' },
            update: {}
          })
        } catch {}
      }

      // ── Companies with roles ──
      for (const rel of (compByPost[p.id] || [])) {
        if (!rel.nombre) continue
        try {
          const companyId = `drupal-company-${rel.idEmpresa || rel.nombre.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 60)}`
          const company = await prisma.company.upsert({
            where: { id: companyId },
            create: { id: companyId, name: rel.nombre },
            update: { name: rel.nombre }
          })
          const role = rel.rol || 'Participante'
          await prisma.transactionCompany.upsert({
            where: { transactionId_companyId_role: { transactionId: txId, companyId: company.id, role } },
            create: { transactionId: txId, companyId: company.id, role },
            update: {}
          })
        } catch {}
      }

      processed++
    }

    const hasMore = posts.length === CHUNK_SIZE
    const nextOffset = offset + posts.length
    const skipped = skippedTipo + skippedMultiArea + skippedNoise

    return NextResponse.json({
      success: true,
      processed,
      skipped,
      skippedTipo,
      skippedMultiArea,
      skippedNoise,
      offset: nextOffset,
      hasMore,
      total,
      chunkSize: posts.length,
      durationMs: Date.now() - startTime,
      message: `Chunk procesado: ${processed} transacciones, ${skipped} filtradas. Offset: ${nextOffset}/${total}`,
    })

  } catch (error: any) {
    console.error('MySQL Sync Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
