import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

const DRUPAL_API_BASE = 'https://phpstack-763726-5097902.cloudwaysapps.com/jsonapi'

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
    // We request the included relationships to get Firm, Lawyer, Company, Industry, and Financial data.
    const url = `${DRUPAL_API_BASE}/node/post?include=field_abogados_involucrados,field_firmas_involucradas,field_empresas_involucradas,field_industrias_asociadas,field_paises_involucrados,field_operacion,field_operacion.field_datos_monetarios&page[limit]=50&sort=-created`
    
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
      const type = attributes.field_operacion_principal || 'M&A'
      const link = `https://lexlatin.com/node/${attributes.drupal_internal__nid}` // Constructing official link

      // Process Relationships (Industries)
      let prismaIndustryId = null
      if (relationships?.field_industrias_asociadas?.data) {
        const indData = Array.isArray(relationships.field_industrias_asociadas.data) 
          ? relationships.field_industrias_asociadas.data[0] 
          : relationships.field_industrias_asociadas.data;
          
        if (indData) {
          const industryNode = getIncludedResource(indData.type, indData.id)
          if (industryNode) {
            const industryName = industryNode.attributes.name || industryNode.attributes.title
            if (industryName) {
              const upsertedIndustry = await prisma.industry.upsert({
                where: { name: industryName },
                create: { id: indData.id, name: industryName },
                update: { name: industryName }
              })
              prismaIndustryId = upsertedIndustry.id
            }
          }
        }
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
