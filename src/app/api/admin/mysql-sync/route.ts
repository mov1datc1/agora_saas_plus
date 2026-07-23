import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * MySQL Sync via PHP Proxy — Vercel → HTTP → Cloudways PHP → MySQL (localhost)
 * 
 * Solves Vercel dynamic IP issue: no MySQL whitelist needed.
 * The PHP script runs on Cloudways and reads MySQL locally.
 * Vercel calls the PHP endpoint via HTTP(S) (port 443, always open).
 * 
 * POST /api/admin/mysql-sync
 * Body: { offset?: number, chunkSize?: number }
 */

// ── Config ──
const BULK_EXPORT_URL = process.env.BULK_EXPORT_URL || 'https://lexlatin.com/agora-bulk-export.php'
const BULK_EXPORT_KEY = process.env.BULK_EXPORT_KEY || 'agora-sync-2026-k8xP9mQ2vR'

// ── Practice Area Map ──
const PA_MAP: Record<string, string> = {
  'corporativo - adquisiciones': 'M&A',
  'corporativo - fusiones': 'M&A',
  'banca y finanzas (créditos y financiamientos)': 'Financiamientos',
  'banca y finanzas': 'Financiamientos',
  'mercado de capitales - emisiones': 'Emisiones',
}

// ── Noise Filter ──
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
    const CHUNK_SIZE = body.chunkSize || 50

    // ── Fetch data from PHP proxy (no MySQL direct connection!) ──
    const url = `${BULK_EXPORT_URL}?key=${encodeURIComponent(BULK_EXPORT_KEY)}&offset=${offset}&limit=${CHUNK_SIZE}`
    
    let phpData: any
    try {
      const res = await fetch(url, { 
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(55000), // 55s timeout (Vercel max is 60s)
      })
      
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        return NextResponse.json({
          success: false,
          error: `Error del servidor Drupal (HTTP ${res.status}): ${text.substring(0, 200)}`,
        }, { status: 502 })
      }

      phpData = await res.json()
    } catch (e: any) {
      return NextResponse.json({
        success: false,
        error: `Error conectando al endpoint PHP en Drupal: ${e.message}. ¿El archivo agora-bulk-export.php está instalado en el servidor?`,
      }, { status: 503 })
    }

    if (!phpData.success) {
      return NextResponse.json({
        success: false,
        error: phpData.error || 'Error desconocido del endpoint PHP',
      }, { status: 500 })
    }

    const { posts, relations, lookups, total } = phpData

    if (!posts || posts.length === 0) {
      return NextResponse.json({
        success: true, processed: 0, skipped: 0, deleted: 0,
        offset, hasMore: false, total: total || 0,
        message: 'Sincronización completada — no hay más posts.',
        durationMs: Date.now() - startTime,
      })
    }

    // ── Build lookup maps ──
    const countryMap: Record<number, string> = {}
    ;(lookups.countries || []).forEach((c: any) => countryMap[c.id] = c.nombre)
    const paMap: Record<number, string> = {}
    ;(lookups.practiceAreas || []).forEach((p: any) => paMap[p.id] = p.nombre)
    const firmNamesMap: Record<number, string> = {}
    ;(lookups.firmNames || []).forEach((f: any) => firmNamesMap[f.id] = f.nombre)
    const lawyerNamesMap: Record<number, { nombre: string; idFirma: number | null }> = {}
    ;(lookups.lawyerNames || []).forEach((l: any) => lawyerNamesMap[l.id] = { nombre: l.nombre, idFirma: l.idFirma })

    // ── Group relationships by post ──
    const groupBy = (arr: any[], key: string) => {
      const m: Record<number, any[]> = {}
      arr.forEach(i => { (m[i[key]] = m[i[key]] || []).push(i) })
      return m
    }
    const areasByPost = groupBy(relations.areas || [], 'idPost')
    const firmsByPost = groupBy(relations.firms || [], 'idPost')
    const lawyersByPost = groupBy(relations.lawyers || [], 'idPost')
    const indByPost = groupBy(relations.industries || [], 'idPost')
    const ctryByPost = groupBy(relations.countries || [], 'idPost')
    const compByPost = groupBy(relations.companies || [], 'idPost')
    const moneyByPost: Record<number, any> = {}
    ;(relations.money || []).forEach((m: any) => { if (!moneyByPost[m.idPost]) moneyByPost[m.idPost] = m })

    // ── Helper: Delete transaction + cascade ──
    const deleteIfExists = async (txId: string): Promise<boolean> => {
      try {
        await prisma.transaction.delete({ where: { id: txId } })
        return true
      } catch { return false }
    }

    // ── Process & Write to Supabase ──
    let processed = 0
    let skippedTipo = 0
    let skippedMultiArea = 0
    let skippedNoise = 0
    let skippedOpGeneral = 0
    let deletedTipo = 0
    let deletedMultiArea = 0
    let deletedNoise = 0
    let deletedOpGeneral = 0

    for (const p of posts) {
      const txId = `drupal-${p.id}`

      // FILTER 1: tipo_de_noticia
      if (p.tipo && p.tipo !== 'Transacción') {
        skippedTipo++
        if (await deleteIfExists(txId)) deletedTipo++
        continue
      }

      // FILTER 2: Portal Original (2+ mapped areas)
      const areas = (areasByPost[p.id] || []).map((a: any) => paMap[a.idArea]).filter(Boolean)
      const cls = classifyAreas(areas)
      if (cls.isMultiArea) {
        skippedMultiArea++
        if (await deleteIfExists(txId)) deletedMultiArea++
        continue
      }

      // FILTER 3: Noise filter
      const titleLower = (p.titulo || '').toLowerCase()
      const bodyClean = stripHtml(p.bodyRaw || '').toLowerCase()
      if (isNonTransactional(titleLower, `${titleLower} ${bodyClean}`)) {
        skippedNoise++
        if (await deleteIfExists(txId)) deletedNoise++
        continue
      }

      // FILTER 4: Operación General (not classifiable)
      if (cls.type === 'Operación General') {
        skippedOpGeneral++
        if (await deleteIfExists(txId)) deletedOpGeneral++
        continue
      }

      // ── Build data (only M&A, Emisiones, Financiamientos reach here) ──
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
        const indName = (lookups.industries || []).find((i: any) => i.id === indRels[0].idIndustria)?.nombre
        if (indName) {
          const ind = await prisma.industry.upsert({
            where: { name: indName }, create: { name: indName }, update: {}
          })
          prismaIndustryId = ind.id
        }
      }

      // ── Upsert Transaction ──
      const existing = await prisma.transaction.findUnique({
        where: { id: txId }, select: { typeOverride: true }
      })

      await prisma.transaction.upsert({
        where: { id: txId },
        create: {
          id: txId,
          title: (p.titulo || 'Sin título').substring(0, 500),
          type: cls.type,
          value: val, valueString: valStr,
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
          value: val, valueString: valStr,
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

    const hasMore = phpData.hasMore
    const nextOffset = offset + posts.length
    const skipped = skippedTipo + skippedMultiArea + skippedNoise + skippedOpGeneral
    const deleted = deletedTipo + deletedMultiArea + deletedNoise + deletedOpGeneral

    return NextResponse.json({
      success: true,
      processed, skipped, deleted,
      skippedTipo, skippedMultiArea, skippedNoise, skippedOpGeneral,
      deletedTipo, deletedMultiArea, deletedNoise, deletedOpGeneral,
      offset: nextOffset, hasMore, total,
      chunkSize: posts.length,
      phpDurationMs: phpData.durationMs,
      durationMs: Date.now() - startTime,
      message: `Chunk: ${processed} upserts, ${deleted} eliminados, ${skipped} filtrados. Offset: ${nextOffset}/${total}`,
    })

  } catch (error: any) {
    console.error('MySQL Sync Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
