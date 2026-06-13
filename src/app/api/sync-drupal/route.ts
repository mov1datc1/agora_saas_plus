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
    const url = `${DRUPAL_API_BASE}/node/post?include=field_abogados_involucrados,field_firmas_involucradas,field_empresas_involucradas,field_industrias_asociadas&page[limit]=50`
    
    const response = await fetch(url)
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

      // Upsert Transaction Core
      await prisma.transaction.upsert({
        where: { id: transactionId },
        create: {
          id: transactionId,
          title,
          status,
          type,
          link,
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
          industryId: prismaIndustryId,
          dateAnnounced: dateAnnouncedStr ? new Date(dateAnnouncedStr) : null,
          dateClosed: dateClosedStr ? new Date(dateClosedStr) : null,
        }
      })

      // We would normally process Firms, Lawyers, and Companies here...
      // Since relationships are complex, we skip deeper mappings for the prototype sync 
      // but ensure the main transaction logic functions perfectly.

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
