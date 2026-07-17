import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { classifyOperationType, classifyIndustry } from '@/lib/classificationEngine'

const DRUPAL_API_BASE = process.env.DRUPAL_API_URL || 'https://lexlatin.com/jsonapi'

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
    
    const drupalUser = process.env.DRUPAL_API_USER || 'agora_api_user'
    const drupalPass = process.env.DRUPAL_API_PASS || 'Agor4Lex!'
    const authString = Buffer.from(`${drupalUser}:${drupalPass}`).toString('base64')

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
      
      // Fetch batch from Drupal
      // sort=-changed ensures we pick up both NEW and RECENTLY EDITED posts
      // (e.g. data entry team updates close date or status months after initial creation)
      const url = `${DRUPAL_API_BASE}/node/post?filter[field_tipo_de_noticia]=Transacci%C3%B3n&include=field_abogados_involucrados,field_firmas_involucradas,field_empresas_involucradas,field_empresas_involucradas.field_empresa,field_industrias_asociadas,field_paises_involucrados,field_operacion,field_operacion.field_datos_monetarios,field_ae&page[limit]=${BATCH_SIZE}&page[offset]=${currentOffset}&sort=-changed`
      
      let posts: any[] = []
      let included: any[] = []
      
      try {
        const response = await fetch(url, {
          headers: {
            'Authorization': `Basic ${authString}`,
            'Accept': 'application/vnd.api+json'
          }
        })

        if (!response.ok) {
          console.error(`Drupal batch ${batchNumber} failed: ${response.status}`)
          break // Stop pagination on error, return what we have
        }

        const json = await response.json()
        posts = json.data || []
        included = json.included || []
      } catch (fetchError) {
        console.error(`Drupal fetch error on batch ${batchNumber}:`, fetchError)
        break
      }

      if (!posts || posts.length === 0) {
        break // No more posts to sync
      }

      // Helper to parse 'included' data (scoped per batch since included changes)
      const getIncludedResource = (type: string, id: string) => {
        return included?.find((item: any) => item.type === type && item.id === id)
      }

      // Process each post in this batch
      let processedCount = 0
      const multiAreaConflicts: Array<{ id: string; title: string; link: string; practiceAreas: string; assignedType: string; alternativeTypes: string[] }> = []
      for (const post of posts) {
        const attributes = post.attributes
        const relationships = post.relationships
      // CRITICAL: Use drupal-{nid} format to match MySQL migration IDs
      // Before this fix, JSON:API used Drupal's UUID (e.g., "883cf94c-...") while MySQL migration 
      // used "drupal-134006", causing duplicate records for the same post
      const drupalNid = attributes.drupal_internal__nid
      const transactionId = drupalNid ? `drupal-${drupalNid}` : post.id

      // Dedup: skip if already processed in a previous batch
      if (processedIds.has(transactionId)) continue
      processedIds.add(transactionId)

      // Extract attributes
      const title = attributes.title || 'Transacción sin título'
      // Status: "Cerrado (Closed)" / "closed" → "Cerrado", "En progreso (Ongoing)" / "ongoing" → "En progreso", null → "Completada"
      const rawStatus = attributes.field_estado_caso
      const status = rawStatus
        ? (rawStatus.toLowerCase().includes('cerrad') || rawStatus.toLowerCase().includes('closed') ? 'Cerrado' 
          : rawStatus.toLowerCase().includes('progres') || rawStatus.toLowerCase().includes('ongoing') || rawStatus.toLowerCase().includes('on-going') ? 'En progreso' 
          : rawStatus)
        : 'Completada'
      const dateAnnouncedStr = attributes.field_fecha_de_la_firma || attributes.created
      const dateClosedStr = attributes.field_fecha_de_cierre_de_la_emis || attributes.field_fecha_de_concrecion_del_ac
      // Excerpt: try multiple Drupal body fields (processed HTML preferred over raw value)
      const rawExcerpt = attributes.body?.processed || attributes.body?.value || attributes.field_lead?.processed || attributes.field_lead?.value || attributes.field_resumen?.value || null
      // Clean HTML tags for plain-text storage (max 2000 chars)
      let excerpt: string | null = null
      if (rawExcerpt) {
        const cleaned = rawExcerpt
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
      // These are valid transactions that count in analytics but are not public-facing
      const casoNoPublicado = attributes.field_caso_no_publicado === true
      const isPublished = !casoNoPublicado

      // ── CLASSIFICATION v3.0: Deterministic by "Áreas de práctica" (field_ae) ──
      // Source of truth: Data Entry team marks practice areas in the Drupal form
      // Priority: field_ae (deterministic) → classifyOperationType (heuristic) → "Operación General"
      
      let practiceAreas: string[] = []
      
      if (relationships?.field_ae?.data) {
        const aeData = Array.isArray(relationships.field_ae.data)
          ? relationships.field_ae.data
          : [relationships.field_ae.data]
        
        for (const ae of aeData) {
          if (!ae) continue
          const aeNode = getIncludedResource(ae.type, ae.id)
          if (aeNode) {
            // Practice area nodes use 'title' (they are node--areas_de_practica, not taxonomy terms)
            const aeName = aeNode.attributes?.title || aeNode.attributes?.name
            if (aeName) practiceAreas.push(aeName)
          }
        }
      }

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
          link: `https://lexlatin.com/node/${attributes.drupal_internal__nid}`,
          practiceAreas: practiceAreaRaw || '',
          assignedType: finalType,
          alternativeTypes: allMappedTypes.filter(t => t !== finalType)
        })
      }

      // Step 2: Heuristic fallback for posts without matching practice area
      // This covers legacy posts or incomplete data entry
      if (finalType === 'Operación General') {
        // Extract company roles for Phase 3 of heuristic engine
        const companyRoles: string[] = []
        if (relationships?.field_empresas_involucradas?.data) {
          const empresasData = Array.isArray(relationships.field_empresas_involucradas.data)
            ? relationships.field_empresas_involucradas.data
            : [relationships.field_empresas_involucradas.data];
          for (const c of empresasData) {
            if (!c) continue;
            const paragraphNode = getIncludedResource(c.type, c.id)
            if (paragraphNode && paragraphNode.attributes) {
              const attrs = paragraphNode.attributes;
              const role = attrs.field_rol_fusiones_y_adquisicion || 
                           attrs.field_rol_emisiones || 
                           attrs.field_rol_financiamiento || 
                           attrs.field_rol_litigios || 
                           attrs.field_rol_reestructuraciones || 
                           attrs.field_rol_arrendamientos
              if (role) companyRoles.push(role)
            }
          }
        }

        const classification = classifyOperationType(title, excerpt, companyRoles)
        if (classification.type !== 'Operación General') {
          finalType = classification.type
        }
      }

      const link = `https://lexlatin.com/node/${attributes.drupal_internal__nid}` // Constructing official link

      // Process Relationships (Industries)
      let prismaIndustryId = null
      let finalIndustryName = null
      let originalIndId = null

      if (relationships?.field_industrias_asociadas?.data) {
        const indData = Array.isArray(relationships.field_industrias_asociadas.data) 
          ? relationships.field_industrias_asociadas.data[0] 
          : relationships.field_industrias_asociadas.data;
          
        if (indData) {
          const industryNode = getIncludedResource(indData.type, indData.id)
          if (industryNode) {
            finalIndustryName = industryNode.attributes.name || industryNode.attributes.title
            originalIndId = indData.id
          }
        }
      }

      // If no industry was found in Drupal, use the weighted classifier
      if (!finalIndustryName) {
        const textToAnalyze = `${title} ${attributes.body?.value || ''}`
        const guessed = classifyIndustry(textToAnalyze)
        if (guessed) {
          finalIndustryName = guessed
        }
      }

      // Upsert the industry (either official or guessed)
      if (finalIndustryName) {
        const upsertData: any = { name: finalIndustryName }
        if (originalIndId) {
          upsertData.id = originalIndId
        }
        
        const upsertedIndustry = await prisma.industry.upsert({
          where: { name: finalIndustryName },
          create: upsertData,
          update: { name: finalIndustryName }
        })
        prismaIndustryId = upsertedIndustry.id
      }

      // Process Countries
      let countryNames: string[] = []
      if (relationships?.field_paises_involucrados?.data) {
        const paisesData = Array.isArray(relationships.field_paises_involucrados.data)
          ? relationships.field_paises_involucrados.data
          : [relationships.field_paises_involucrados.data];
          
        for (const p of paisesData) {
          if (!p) continue;
          const paisNode = getIncludedResource(p.type, p.id)
          if (paisNode && (paisNode.attributes.name || paisNode.attributes.title)) {
            countryNames.push(paisNode.attributes.name || paisNode.attributes.title)
          }
        }
      }
      const combinedCountries = countryNames.length > 0 ? countryNames.join(', ') : null

      // Process Value String (Monto)
      let transactionValue = 'Valor confidencial'
      let transactionValueNumeric: number | null = null
      if (relationships?.field_operacion?.data) {
        const opDataArray = Array.isArray(relationships.field_operacion.data) ? relationships.field_operacion.data : [relationships.field_operacion.data]
        for (const opData of opDataArray) {
          if (!opData) continue
          const opNode = getIncludedResource(opData.type, opData.id)
          if (opNode && opNode.relationships?.field_datos_monetarios?.data) {
            const moneyData = opNode.relationships.field_datos_monetarios.data
            const moneyNode = getIncludedResource(moneyData.type, moneyData.id)
            if (moneyNode && moneyNode.attributes?.field_monto_transaccion_en_dolar) {
              const rawMonto = moneyNode.attributes.field_monto_transaccion_en_dolar
              const num = parseFloat(rawMonto.toString().replace(/,/g, ''))
              if (!isNaN(num) && num > 0) {
                transactionValueNumeric = num
                if (num >= 1000000) {
                  transactionValue = `$${(num / 1000000).toFixed(1)}M`
                } else {
                  transactionValue = `$${num.toLocaleString('en-US')}`
                }
              } else {
                transactionValue = `$${rawMonto}`
              }
              break
            }
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

      // Process Firms
      if (relationships?.field_firmas_involucradas?.data) {
        const firmasData = Array.isArray(relationships.field_firmas_involucradas.data)
          ? relationships.field_firmas_involucradas.data
          : [relationships.field_firmas_involucradas.data];
          
        for (const f of firmasData) {
          if (!f) continue;
          const firmaNode = getIncludedResource(f.type, f.id)
          if (firmaNode && (firmaNode.attributes.name || firmaNode.attributes.title)) {
            const firmaName = firmaNode.attributes.name || firmaNode.attributes.title
            
            // Create or update Firm
            const upsertedFirm = await prisma.firm.upsert({
              where: { name: firmaName },
              create: { id: f.id, name: firmaName },
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
        }
      }

      // Process Companies
      if (relationships?.field_empresas_involucradas?.data) {
        const empresasData = Array.isArray(relationships.field_empresas_involucradas.data)
          ? relationships.field_empresas_involucradas.data
          : [relationships.field_empresas_involucradas.data];
          
        for (const c of empresasData) {
          if (!c) continue;
          const paragraphNode = getIncludedResource(c.type, c.id)

          if (paragraphNode && paragraphNode.relationships?.field_empresa?.data) {
            const empresaData = paragraphNode.relationships.field_empresa.data
            const empresaNode = getIncludedResource(empresaData.type, empresaData.id)
            if (empresaNode && (empresaNode.attributes.name || empresaNode.attributes.title)) {
              const companyName = empresaNode.attributes.name || empresaNode.attributes.title
              
              let companyRole = 'Parte Involucrada';
              if (paragraphNode.attributes) {
                const attrs = paragraphNode.attributes;
                companyRole = attrs.field_rol_fusiones_y_adquisicion || 
                              attrs.field_rol_emisiones || 
                              attrs.field_rol_financiamiento || 
                              attrs.field_rol_litigios || 
                              attrs.field_rol_reestructuraciones || 
                              attrs.field_rol_arrendamientos || 
                              'Parte Involucrada';
                // Capitalize first letter of role if it exists
                if (typeof companyRole === 'string' && companyRole !== 'Parte Involucrada') {
                  companyRole = companyRole.charAt(0).toUpperCase() + companyRole.slice(1).replace(/-/g, ' ');
                }
              }

              // Create or update Company
              const upsertedCompany = await prisma.company.upsert({
                where: { id: empresaData.id },
                create: { id: empresaData.id, name: companyName },
                update: { name: companyName }
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
          }
        }
      }

      // Process Lawyers (Abogados)
      if (relationships?.field_abogados_involucrados?.data) {
        const abogadosData = Array.isArray(relationships.field_abogados_involucrados.data)
          ? relationships.field_abogados_involucrados.data
          : [relationships.field_abogados_involucrados.data];
          
        for (const a of abogadosData) {
          if (!a) continue;
          const abogadoNode = getIncludedResource(a.type, a.id)
          if (abogadoNode && (abogadoNode.attributes.name || abogadoNode.attributes.title)) {
            const abogadoName = abogadoNode.attributes.name || abogadoNode.attributes.title
            
            // Create or update Lawyer
            const upsertedLawyer = await prisma.lawyer.upsert({
              where: { id: a.id },
              create: { id: a.id, name: abogadoName },
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
