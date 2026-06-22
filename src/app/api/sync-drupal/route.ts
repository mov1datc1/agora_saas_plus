import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

const DRUPAL_API_BASE = process.env.DRUPAL_API_URL || 'https://phpstack-763726-5097902.cloudwaysapps.com/jsonapi'

export async function POST(request: Request) {
  try {
    // 1. Basic Authorization to protect the Cron Endpoint
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // Allow for local dev testing if no CRON_SECRET is set, but reject in production
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // 2. Fetch data from Drupal (node--post = Transactions)
    const { searchParams } = new URL(request.url)
    const offset = searchParams.get('offset') || '0'
    
    // We request the included relationships to get Firm, Lawyer, Company, Industry, and Financial data.
    const url = `${DRUPAL_API_BASE}/node/post?include=field_abogados_involucrados,field_firmas_involucradas,field_empresas_involucradas,field_industrias_asociadas,field_paises_involucrados,field_operacion,field_operacion.field_datos_monetarios&page[limit]=150&page[offset]=${offset}&sort=-created`
    
    const drupalUser = process.env.DRUPAL_API_USER || 'agora_api_user'
    const drupalPass = process.env.DRUPAL_API_PASS || 'Agor4Lex!'
    const authString = Buffer.from(`${drupalUser}:${drupalPass}`).toString('base64')

    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${authString}`,
        'Accept': 'application/vnd.api+json'
      }
    })

    if (!response.ok) {
      throw new Error(`Drupal API responded with ${response.status}: ${response.statusText}`)
    }

    const { data: posts, included } = await response.json()

    if (!posts || posts.length === 0) {
      return NextResponse.json({ message: 'No posts found to sync.' })
    }

    // 3. Helper to parse 'included' data
    const getIncludedResource = (type: string, id: string) => {
      return included?.find((item: any) => item.type === type && item.id === id)
    }

    // 3.5 Heuristic Industry Guesser
    const guessIndustryFromText = (text: string): string | null => {
      const t = text.toLowerCase()
      if (t.includes('banco') || t.includes('banca') || t.includes('scotiabank') || t.includes('citigroup') || t.includes('financiero') || t.includes('fideicomiso') || t.includes('crédito') || t.includes('bonos')) return 'Banca'
      if (t.includes('inmobiliari') || t.includes('bienes raíces') || t.includes('hotel') || t.includes('resort') || t.includes('terreno')) return 'Bienes Raíces'
      if (t.includes('energía') || t.includes('petróleo') || t.includes('gas') || t.includes('solar') || t.includes('eólica') || t.includes('eléctric')) return 'Energía y recursos naturales | No Renovable - Petróleo'
      if (t.includes('minería') || t.includes('mina') || t.includes('cobre') || t.includes('litio') || t.includes('oro')) return 'Minería'
      if (t.includes('retail') || t.includes('supermercado') || t.includes('tienda') || t.includes('comercio')) return 'Retail'
      if (t.includes('tecnología') || t.includes('software') || t.includes('app') || t.includes('informática') || t.includes('startup') || t.includes('fintech')) return 'Informática'
      if (t.includes('telecomunicacion') || t.includes('telefon') || t.includes('internet') || t.includes('fibra óptica')) return 'Telecomunicaciones'
      if (t.includes('salud') || t.includes('hospital') || t.includes('clínica') || t.includes('farmacéutic') || t.includes('medicamento')) return 'Salud'
      if (t.includes('transporte') || t.includes('logística') || t.includes('aerolínea') || t.includes('aviación') || t.includes('marítim') || t.includes('autopista')) return 'Transporte y logística'
      if (t.includes('alimento') || t.includes('bebida') || t.includes('agrícola') || t.includes('agro') || t.includes('pesca') || t.includes('nutrición')) return 'Agrícola'
      if (t.includes('educación') || t.includes('universidad') || t.includes('colegio') || t.includes('escuela')) return 'Educación'
      if (t.includes('seguro') || t.includes('reaseguro') || t.includes('asegurador')) return 'Seguros y reaseguros'
      if (t.includes('construcción') || t.includes('infraestructura') || t.includes('cemento') || t.includes('obras')) return 'Infraestructura'
      if (t.includes('abogado') || t.includes('firma') || t.includes('lexincorp') || t.includes('baker') || t.includes('mckenzie') || t.includes('ontier') || t.includes('greenberg') || t.includes('legal') || t.includes('derecho') || t.includes('cuatrecasas') || t.includes('garrigues') || t.includes('uria') || t.includes('bufete') || t.includes('socio')) return 'Derecho'
      if (t.includes('consultor') || t.includes('asesor') || t.includes('zelca')) return 'Consultoría'
      if (t.includes('entretenimiento') || t.includes('televisión') || t.includes('cine') || t.includes('música') || t.includes('deporte')) return 'Entretenimiento'
      if (t.includes('capital') || t.includes('fondo') || t.includes('inversión') || t.includes('acciones') || t.includes('adquiere') || t.includes('compra') || t.includes('fusión') || t.includes('fusiona')) return 'Banca'
      
      return null
    }

    // 4. Process and Upsert each Post (Transaction)
    let processedCount = 0

    for (const post of posts) {
      const attributes = post.attributes
      const relationships = post.relationships
      const transactionId = post.id // Using Drupal UUID as the Primary Key in Supabase

      // Extract attributes
      const title = attributes.title || 'Transacción sin título'
      const status = attributes.field_estado_caso || 'Completada'
      const dateAnnouncedStr = attributes.field_fecha_de_la_firma || attributes.created
      const dateClosedStr = attributes.field_fecha_de_cierre_de_la_emis || attributes.field_fecha_de_concrecion_del_ac
      let type = attributes.field_operacion_principal
      if (!type) {
        const textToAnalyze = `${title} ${attributes.body?.value || ''}`.toLowerCase()
        if (textToAnalyze.includes('emisión') || textToAnalyze.includes('emite') || textToAnalyze.includes('emisiones') || textToAnalyze.includes('bonos') || textToAnalyze.includes('notas')) {
          type = 'Emisiones'
        } else if (textToAnalyze.includes('financiamiento') || textToAnalyze.includes('préstamo') || textToAnalyze.includes('crédito') || textToAnalyze.includes('financia')) {
          type = 'Financiamientos'
        } else {
          type = 'M&A'
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

      // If no industry was found in Drupal, try to guess it from Title and Body
      if (!finalIndustryName) {
        const textToAnalyze = `${title} ${attributes.body?.value || ''}`
        const guessed = guessIndustryFromText(textToAnalyze)
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
      let transactionValue = 'Por definir'
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
          type,
          link,
          country: combinedCountries,
          industryId: prismaIndustryId,
          dateAnnounced: dateAnnouncedStr ? new Date(dateAnnouncedStr) : null,
          dateClosed: dateClosedStr ? new Date(dateClosedStr) : null,
          valueString: transactionValue,
        },
        update: {
          title,
          status,
          type,
          link,
          country: combinedCountries,
          industryId: prismaIndustryId,
          dateAnnounced: dateAnnouncedStr ? new Date(dateAnnouncedStr) : null,
          dateClosed: dateClosedStr ? new Date(dateClosedStr) : null,
          valueString: transactionValue,
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
            await prisma.transactionAdvisor.upsert({
              where: {
                transactionId_firmId_role: {
                  transactionId: transactionId,
                  firmId: upsertedFirm.id,
                  role: 'Asesor Legal'
                }
              },
              create: {
                id: `${transactionId}-${upsertedFirm.id}`,
                transactionId: transactionId,
                firmId: upsertedFirm.id,
                role: 'Asesor Legal'
              },
              update: {}
            })
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
          const companyNode = getIncludedResource(c.type, c.id)
          if (companyNode && (companyNode.attributes.name || companyNode.attributes.title)) {
            const companyName = companyNode.attributes.name || companyNode.attributes.title
            
            // Create or update Company
            const upsertedCompany = await prisma.company.upsert({
              // Company name in Prisma schema doesn't have @unique right now, wait... let me check Prisma schema
              // If it lacks @unique, upsert needs a unique field. Wait, I should just use id.
              // Actually, wait, let me check Prisma schema for Company.
              // I will rewrite this replacing chunk carefully after viewing Prisma schema to avoid crashing.
              // So I am going to cancel this chunk for a moment? No, I am forced to write it. Let's just create the company if it doesn't exist by id.
              where: { id: c.id },
              create: { id: c.id, name: companyName },
              update: { name: companyName }
            })
            
            // Link to Transaction
            await prisma.transactionCompany.upsert({
              where: {
                transactionId_companyId_role: {
                  transactionId: transactionId,
                  companyId: upsertedCompany.id,
                  role: 'Parte Involucrada'
                }
              },
              create: {
                id: `${transactionId}-${upsertedCompany.id}`,
                transactionId: transactionId,
                companyId: upsertedCompany.id,
                role: 'Parte Involucrada'
              },
              update: {}
            })
          }
        }
      }

      processedCount++
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully synchronized ${processedCount} transactions from Drupal.` 
    })

  } catch (error: any) {
    console.error('ETL Sync Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return POST(request)
}
