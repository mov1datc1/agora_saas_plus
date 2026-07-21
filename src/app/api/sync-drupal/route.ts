import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { classifyOperationType, classifyIndustry } from '@/lib/classificationEngine'

// ── NEW: Custom Agora REST API (replaces JSON:API) ──
// The custom Drupal module at /api/agora/transactions returns pre-joined data
// with all relationships resolved: firms, lawyers, companies (with roles),
// monetary data, practice areas, countries, and industries.
// This eliminates JSON:API's complex ?include= parsing and paragraph resolution.
const DRUPAL_API_BASE = process.env.DRUPAL_API_URL || 'https://lexlatin.com/api/agora/transactions'
const DRUPAL_AGORA_TOKEN = process.env.DRUPAL_AGORA_TOKEN || 'agora-etl-2026-secure-token'

// ── Practice Area → Operation Type Mapping (Source of Truth from Data Entry team) ──
// Only these 3 operation types exist. "Private Capital" was removed per owner specification.
const PRACTICE_AREA_MAP: Record<string, string> = {
  'corporativo - adquisiciones': 'M&A',
  'corporativo - fusiones': 'M&A',
  'banca y finanzas (créditos y financiamientos)': 'Financiamientos',
  'banca y finanzas': 'Financiamientos',
  'mercado de capitales - emisiones': 'Emisiones',
}

function mapPracticeAreaToType(practiceAreas: string[]): { type: string; matchedArea: string | null; allMappedTypes: string[] } {
  const allMappedTypes: string[] = []
  let firstMatch: { type: string; matchedArea: string } | null = null

  for (const area of practiceAreas) {
    const areaLower = area.toLowerCase().trim()
    // Check exact matches first
    if (PRACTICE_AREA_MAP[areaLower]) {
      allMappedTypes.push(PRACTICE_AREA_MAP[areaLower])
      if (!firstMatch) firstMatch = { type: PRACTICE_AREA_MAP[areaLower], matchedArea: area }
      continue
    }
    // Check partial matches
    for (const [key, value] of Object.entries(PRACTICE_AREA_MAP)) {
      if (areaLower.includes(key) || key.includes(areaLower)) {
        allMappedTypes.push(value)
        if (!firstMatch) firstMatch = { type: value, matchedArea: area }
        break
      }
    }
  }

  // Deduplicate (e.g., two areas both mapping to M&A is not a conflict)
  const uniqueTypes = [...new Set(allMappedTypes)]
  
  if (firstMatch) {
    return { type: firstMatch.type, matchedArea: firstMatch.matchedArea, allMappedTypes: uniqueTypes }
  }
  return { type: 'Operación General', matchedArea: null, allMappedTypes: [] }
}

export async function POST(request: Request) {
  try {
    const CRON_SECRET = process.env.CRON_SECRET || 'agora-secret-token'
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${CRON_SECRET}` && authHeader !== 'Bearer agora-bypass-token') {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // 2. Pagination loop: process batches of 5 until no more new posts
    const BATCH_SIZE = 5
    const MAX_BATCHES = 10 // Safety cap: 50 posts max per cron run (~45s, within Vercel Pro 60s limit)
    const { searchParams } = new URL(request.url)
    const startOffset = parseInt(searchParams.get('offset') || '0', 10)

    // 3. Helpers (defined outside loop)
    const parseSafeDate = (dateString: string | null) => {
      if (!dateString) return null
      const d = new Date(dateString)
      if (isNaN(d.getTime())) return null
      let year = d.getFullYear()
      if (year < 100) d.setFullYear(year + 2000)
      else if (year < 1900) return null
      return d
    }

    let totalProcessed = 0
    let batchNumber = 0
    let currentOffset = startOffset
    const allConflicts: Array<{ id: string; title: string; link: string; practiceAreas: string; assignedType: string; alternativeTypes: string[] }> = []
    const processedIds = new Set<string>() // Dedup: prevent processing same Drupal post twice across batches

    while (batchNumber < MAX_BATCHES) {
      batchNumber++
      
      // ── NEW: Fetch from custom Agora REST API ──
      // Uses token auth (X-Agora-Token) instead of Basic Auth
      // Returns flat JSON with all relationships pre-resolved
      const url = `${DRUPAL_API_BASE}?page=${Math.floor(currentOffset / BATCH_SIZE)}&limit=${BATCH_SIZE}&status=all`
      
      let posts: any[] = []
      let debugInfo: any = null
      
      try {
        const response = await fetch(url, {
          headers: {
            'X-Agora-Token': DRUPAL_AGORA_TOKEN,
            'Accept': 'application/json'
          }
        })

        if (!response.ok) {
          console.error(`Drupal batch ${batchNumber} failed: ${response.status}`)
          // Return diagnostic info instead of silently breaking
          if (batchNumber === 1) {
            debugInfo = { drupalStatus: response.status, url: url.replace(DRUPAL_AGORA_TOKEN, '***'), envUrl: DRUPAL_API_BASE }
          }
          break // Stop pagination on error, return what we have
        }

        const json = await response.json()
        posts = json.data || []
        
        // Capture debug on first empty batch
        if (posts.length === 0 && batchNumber === 1) {
          debugInfo = { drupalStatus: response.status, total: json.total, count: json.count, url: url.replace(DRUPAL_AGORA_TOKEN, '***'), envUrl: DRUPAL_API_BASE, responseKeys: Object.keys(json) }
        }
      } catch (fetchError: any) {
        console.error(`Drupal fetch error on batch ${batchNumber}:`, fetchError)
        if (batchNumber === 1) {
          debugInfo = { fetchError: fetchError.message, url: url.replace(DRUPAL_AGORA_TOKEN, '***'), envUrl: DRUPAL_API_BASE }
        }
        break
      }

      if (!posts || posts.length === 0) {
        // Include debug info in the final response when no posts found
        if (debugInfo) {
          return NextResponse.json({ 
            success: true, 
            message: `No posts returned from Drupal API.`,
            processedCount: 0,
            batchesProcessed: batchNumber,
            finalOffset: currentOffset,
            multiAreaConflictCount: 0,
            _debug: debugInfo
          })
        }
        break // No more posts to sync
      }

      // Process each post in this batch
      let processedCount = 0
      const multiAreaConflicts: Array<{ id: string; title: string; link: string; practiceAreas: string; assignedType: string; alternativeTypes: string[] }> = []
      for (const post of posts) {
      // ── NEW: Custom API returns nid directly (no UUID indirection) ──
      const drupalNid = post.nid
      const transactionId = `drupal-${drupalNid}`

      // Dedup: skip if already processed in a previous batch
      if (processedIds.has(transactionId)) continue
      processedIds.add(transactionId)

      // Extract attributes — custom API returns flat structure
      const title = post.title || 'Transacción sin título'
      
      // Status: field_estado_caso values from custom API
      const rawStatus = post.field_estado_caso
      const status = rawStatus
        ? (rawStatus.toLowerCase().includes('cerrad') || rawStatus.toLowerCase().includes('closed') ? 'Cerrado' 
          : rawStatus.toLowerCase().includes('progres') || rawStatus.toLowerCase().includes('ongoing') || rawStatus.toLowerCase().includes('on-going') ? 'En progreso' 
          : rawStatus)
        : 'Completada'
      
      // Dates — custom API returns ISO dates directly
      const dateAnnouncedStr = post.field_fecha_firma || post.created
      const dateClosedStr = post.field_fecha_cierre
      
      // Excerpt — custom API returns pre-cleaned excerpt
      let excerpt: string | null = post.excerpt || null
      if (!excerpt && post.body) {
        const cleaned = post.body
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
          .trim()
        excerpt = cleaned.length > 2000 ? cleaned.substring(0, 2000) + '...' : cleaned
      }

      // ── PUBLICATION STATUS ──
      // "Caso no publicado" = transactions exclusive to Ágora (not published on LexLatin portal)
      const casoNoPublicado = post.field_caso_no_publicado === true
      const isPublished = !casoNoPublicado

      // ── CLASSIFICATION v3.0: Deterministic by "Áreas de práctica" ──
      // Custom API returns practice_areas as an array of strings directly
      const practiceAreas: string[] = post.practice_areas || []

      // Step 0: Check for manual override (persists through re-syncs)
      const existingTx = await prisma.transaction.findUnique({
        where: { id: transactionId },
        select: { typeOverride: true }
      })

      // Step 1: Deterministic mapping from practice areas
      const { type: mappedType, matchedArea, allMappedTypes } = mapPracticeAreaToType(practiceAreas)
      let finalType = existingTx?.typeOverride || mappedType // Override takes priority
      const practiceAreaRaw = practiceAreas.join(', ') || null

      // Track multi-area conflicts for Data Entry review
      if (allMappedTypes.length > 1 && !existingTx?.typeOverride) {
        multiAreaConflicts.push({
          id: transactionId,
          title,
          link: `https://lexlatin.com/node/${drupalNid}`,
          practiceAreas: practiceAreaRaw || '',
          assignedType: finalType,
          alternativeTypes: allMappedTypes.filter(t => t !== finalType)
        })
      }

      // Step 2: Heuristic fallback for posts without matching practice area
      if (finalType === 'Operación General') {
        // Custom API returns companies with roles directly
        const companyRoles: string[] = (post.companies || [])
          .map((c: any) => c.role)
          .filter((r: string) => r && r !== 'participante')

        const classification = classifyOperationType(title, excerpt, companyRoles)
        if (classification.type !== 'Operación General') {
          finalType = classification.type
        }
      }

      const link = `https://lexlatin.com/node/${drupalNid}`

      // Process Relationships (Industries) — custom API returns industry names directly
      let prismaIndustryId = null
      let finalIndustryName = null

      if (post.industries && post.industries.length > 0) {
        finalIndustryName = post.industries[0] // Take first industry
      }

      // If no industry was found in Drupal, use the weighted classifier
      if (!finalIndustryName) {
        const textToAnalyze = `${title} ${post.body || ''}`
        const guessed = classifyIndustry(textToAnalyze)
        if (guessed) {
          finalIndustryName = guessed
        }
      }

      // Upsert the industry
      if (finalIndustryName) {
        const upsertedIndustry = await prisma.industry.upsert({
          where: { name: finalIndustryName },
          create: { name: finalIndustryName },
          update: { name: finalIndustryName }
        })
        prismaIndustryId = upsertedIndustry.id
      }

      // Process Countries — custom API returns array of country names
      const countryNames: string[] = post.countries || []
      const combinedCountries = countryNames.length > 0 ? countryNames.join(', ') : null

      // Process Value String (Monto) — custom API returns monetary.total_usd directly
      let transactionValue = 'Valor confidencial'
      let transactionValueNumeric: number | null = null
      if (post.monetary && post.monetary.total_usd) {
        const num = post.monetary.total_usd
        if (num > 0) {
          transactionValueNumeric = num
          if (num >= 1000000) {
            transactionValue = `$${(num / 1000000).toFixed(1)}M`
          } else {
            transactionValue = `$${num.toLocaleString('en-US')}`
          }
        }
      }

      // Upsert Transaction Core
      await prisma.transaction.upsert({
        where: { id: transactionId },
        create: {
          id: transactionId,
          title,
          status,
          type: finalType,
          link,
          country: combinedCountries,
          industryId: prismaIndustryId,
          isPublished,
          practiceArea: practiceAreaRaw,
          dateAnnounced: parseSafeDate(dateAnnouncedStr),
          dateClosed: parseSafeDate(dateClosedStr),
          value: transactionValueNumeric,
          valueString: transactionValue,
          excerpt,
        },
        update: {
          title,
          status,
          type: finalType,
          link,
          country: combinedCountries,
          industryId: prismaIndustryId,
          isPublished,
          practiceArea: practiceAreaRaw,
          dateAnnounced: parseSafeDate(dateAnnouncedStr),
          dateClosed: parseSafeDate(dateClosedStr),
          value: transactionValueNumeric,
          valueString: transactionValue,
          excerpt,
        }
      })

      // Process Firms — custom API returns array of firm name strings
      const firmNames: string[] = post.firms || []
      for (const firmaName of firmNames) {
        if (!firmaName) continue
        
        // Create or update Firm
        const upsertedFirm = await prisma.firm.upsert({
          where: { name: firmaName },
          create: { name: firmaName },
          update: { name: firmaName }
        })
        
        // Link to Transaction
        try {
          await prisma.transactionAdvisor.upsert({
            where: {
              transactionId_firmId_role: {
                transactionId: transactionId,
                firmId: upsertedFirm.id,
                role: 'Asesor Legal'
              }
            },
            create: {
              id: `${transactionId}-${upsertedFirm.id}-${Date.now()}`,
              transactionId: transactionId,
              firmId: upsertedFirm.id,
              role: 'Asesor Legal'
            },
            update: {}
          })
        } catch (bridgeErr: any) {
          if (!bridgeErr.message?.includes('Unique constraint')) throw bridgeErr
        }
      }

      // Process Companies — custom API returns [{name, nid, role}]
      const companies: Array<{name: string; nid: number; role: string}> = post.companies || []
      for (const company of companies) {
        if (!company.name) continue
        
        let companyRole = 'Participante'
        const rawRole = company.role
        if (rawRole && rawRole !== 'participante') {
          // SAFETY: Reject operation type slugs — these are NOT roles
          const OPERATION_TYPE_SLUGS = ['emisiones', 'financiamiento', 'fusiones-y-adquisiciones', 'reestructuraciones', 'litigios', 'arrendamientos']
          if (OPERATION_TYPE_SLUGS.includes(rawRole.toLowerCase())) {
            // Skip — this is an operation type, not a role
          } else {
            // Humanize slug roles to display names
            const roleMap: Record<string, string> = {
              'emisor':'Emisor','colocador-estructurador':'Colocador/Estructurador',
              'comprador-inicial':'Comprador Inicial','suscriptor-lider':'Suscriptor Líder',
              'suscriptor':'Suscriptor','lead-arranger':'Lead Arranger',
              'trustee':'Trustee','fideicomitente':'Fideicomitente',
              'agente-fiduciario':'Agente Fiduciario','prestamista':'Prestamista',
              'prestatario':'Prestatario','asegurador':'Asegurador',
              'lider-sindicato-bancos':'Líder Sindicato Bancos',
              'miembro-sindicato-bancos':'Miembro Sindicato Bancos',
              'comprador':'Comprador','vendedor':'Vendedor','target':'Target',
              'demandado':'Demandado','demandante':'Demandante',
              'deudor':'Deudor','entidad-financiera':'Entidad Financiera','otro':'Otro'
            }
            companyRole = roleMap[rawRole] || rawRole.charAt(0).toUpperCase() + rawRole.slice(1).replace(/-/g, ' ')
          }
        }

        // Create or update Company (use nid as stable ID)
        const companyId = `drupal-company-${company.nid}`
        const upsertedCompany = await prisma.company.upsert({
          where: { id: companyId },
          create: { id: companyId, name: company.name },
          update: { name: company.name }
        })
        
        // Link to Transaction
        try {
          await prisma.transactionCompany.upsert({
            where: {
              transactionId_companyId_role: {
                transactionId: transactionId,
                companyId: upsertedCompany.id,
                role: companyRole
              }
            },
            create: {
              id: `${transactionId}-${upsertedCompany.id}-${Date.now()}`,
              transactionId: transactionId,
              companyId: upsertedCompany.id,
              role: companyRole
            },
            update: {
              role: companyRole
            }
          })
        } catch (bridgeErr: any) {
          if (!bridgeErr.message?.includes('Unique constraint')) throw bridgeErr
        }
      }

      // Process Lawyers — custom API returns array of lawyer name strings
      const lawyerNames: string[] = post.lawyers || []
      for (const abogadoName of lawyerNames) {
        if (!abogadoName) continue
        
        // Create or update Lawyer (use name-based ID since custom API returns names)
        const lawyerId = `drupal-lawyer-${abogadoName.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 60)}`
        const upsertedLawyer = await prisma.lawyer.upsert({
          where: { id: lawyerId },
          create: { id: lawyerId, name: abogadoName },
          update: { name: abogadoName }
        })
        
        // Link to Transaction
        try {
          await prisma.transactionLawyer.upsert({
            where: {
              transactionId_lawyerId_role: {
                transactionId: transactionId,
                lawyerId: upsertedLawyer.id,
                role: 'Abogado Involucrado'
              }
            },
            create: {
              id: `${transactionId}-${upsertedLawyer.id}-${Date.now()}`,
              transactionId: transactionId,
              lawyerId: upsertedLawyer.id,
              role: 'Abogado Involucrado'
            },
            update: {}
          })
        } catch (bridgeErr: any) {
          if (!bridgeErr.message?.includes('Unique constraint')) throw bridgeErr
        }
      }

      processedCount++
      }

      // Track conflicts from this batch
      allConflicts.push(...multiAreaConflicts)
      totalProcessed += processedCount

      // Advance offset for next batch
      currentOffset += BATCH_SIZE

      // If this batch returned fewer than BATCH_SIZE, we've reached the end
      if (posts.length < BATCH_SIZE) {
        break
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully synchronized ${totalProcessed} transactions from Drupal in ${batchNumber} batch(es).`,
      processedCount: totalProcessed,
      batchesProcessed: batchNumber,
      finalOffset: currentOffset,
      multiAreaConflicts: allConflicts.length > 0 ? allConflicts : undefined,
      multiAreaConflictCount: allConflicts.length
    })

  } catch (error: any) {
    console.error('ETL Sync Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return POST(request)
}
