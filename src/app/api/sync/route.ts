import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const cronSecret = process.env.CRON_SECRET

  // 1. Proteger el endpoint
  if (token !== cronSecret && request.headers.get('Authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const baseUrl = process.env.DRUPAL_API_URL || 'https://phpstack-763726-5097902.cloudwaysapps.com/jsonapi'
  const postUrl = `${baseUrl}/node/post?page[limit]=50`

  try {
    // 2. Extraer datos de Drupal (LexLatin)
    const response = await fetch(postUrl, {
      headers: {
        'Accept': 'application/vnd.api+json'
      }
    })

    if (!response.ok) {
      throw new Error(`Drupal API Error: ${response.statusText}`)
    }

    const json = await response.json()
    const posts = json.data || []

    let insertedCount = 0

    // 3. Transformar y Cargar (Upsert) en Prisma
    for (const post of posts) {
      const { id, attributes } = post
      
      const title = attributes.title || 'Transacción sin título'
      const dateAnnounced = attributes.published_at ? new Date(attributes.published_at) : new Date()
      
      // Upsert: Actualiza si existe, crea si no existe
      await prisma.transaction.upsert({
        where: { id: id }, // Usamos el UUID de Drupal como nuestro ID
        update: {
          title: title,
          dateAnnounced: dateAnnounced,
        },
        create: {
          id: id,
          title: title,
          type: 'Operación General', // Valor por defecto hasta mapear taxonomías
          status: 'Completada',
          dateAnnounced: dateAnnounced,
        }
      })
      insertedCount++
    }

    return NextResponse.json({ 
      success: true, 
      message: `Sincronización completada. ${insertedCount} transacciones procesadas.`,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Error en sincronización:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
