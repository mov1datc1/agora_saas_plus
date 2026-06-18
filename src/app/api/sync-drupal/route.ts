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
    // We request the included relationships to get Firm, Lawyer, Company, and Industry details in one go.
    const url = `${DRUPAL_API_BASE}/node/post?include=field_abogados_involucrados,field_firmas_involucradas,field_empresas_involucradas,field_industrias_asociadas,field_paises_involucrados&page[limit]=50&sort=-created`
    
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
          valueString: 'Por definir', // API does not expose exact amount at the top level usually
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
