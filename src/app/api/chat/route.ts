import { openai } from '@ai-sdk/openai'
import { streamText, tool } from 'ai'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Allow streaming responses up to 30 seconds
export const maxDuration = 30

export async function POST(req: Request) {
  try {
    // Auth & Rate Limiting Check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { subscription: true }
    })

    if (!dbUser || (dbUser.subscription?.status !== 'ACTIVE' && dbUser.role !== 'ADMIN')) {
      return new NextResponse('Solo los usuarios PRO pueden usar Ágora Copilot.', { status: 403 })
    }

    const now = new Date()
    const month = now.getMonth() + 1
    const year = now.getFullYear()

    // Rate Limit: 5 questions per month
    const usage = await prisma.copilotUsage.upsert({
      where: { userId_month_year: { userId: dbUser.id, month, year } },
      create: { userId: dbUser.id, month, year, queries: 1 },
      update: { queries: { increment: 1 } }
    })

    if (usage.queries > 5 && dbUser.role !== 'ADMIN') {
      return new NextResponse('Has alcanzado el límite de 5 consultas mensuales.', { status: 429 })
    }

    const { messages } = await req.json()

    const result = await streamText({
      model: openai('gpt-4o-mini'),
      system: 'Eres Ágora Copilot, un asistente financiero experto en el mercado legal y de fusiones y adquisiciones (M&A) en Latinoamérica. Tienes acceso a la base de datos de Ágora Plus. Tu tarea es responder a las preguntas del usuario ejecutando las herramientas disponibles para buscar datos exactos y luego presentar un reporte profesional. Si el usuario pide un reporte, dale formato Markdown con tablas claras. Siempre sé profesional y habla en español.',
      messages,
      tools: {
        getTopFirms: tool({
          description: 'Obtiene las firmas legales (despachos) con más operaciones registradas.',
          parameters: z.object({
            limit: z.number().optional().describe('Cantidad de firmas a retornar, por defecto 5'),
            year: z.number().optional().describe('Filtra por año específico'),
          }),
          execute: async ({ limit = 5, year }: { limit?: number, year?: number }) => {
            const dateFilter = year ? {
              transaction: {
                dateAnnounced: {
                  gte: new Date(`${year}-01-01`),
                  lt: new Date(`${year + 1}-01-01`)
                }
              }
            } : {}

            const firms = await prisma.firm.findMany({
              take: limit,
              orderBy: { transactions: { _count: 'desc' } },
              include: {
                _count: {
                  select: {
                    transactions: { where: dateFilter }
                  }
                }
              }
            })
            return firms.map(f => ({ name: f.name, deals: f._count.transactions })).sort((a, b) => b.deals - a.deals)
          },
        }),
        getTopIndustries: tool({
          description: 'Obtiene las industrias con más operaciones transaccionales.',
          parameters: z.object({
            limit: z.number().optional().describe('Cantidad de industrias a retornar, por defecto 5'),
            year: z.number().optional().describe('Filtra por año específico'),
          }),
          execute: async ({ limit = 5, year }: { limit?: number, year?: number }) => {
            const dateFilter = year ? {
              dateAnnounced: {
                gte: new Date(`${year}-01-01`),
                lt: new Date(`${year + 1}-01-01`)
              }
            } : {}

            const industries = await prisma.industry.findMany({
              take: limit,
              orderBy: { transactions: { _count: 'desc' } },
              include: {
                _count: {
                  select: { transactions: { where: dateFilter } }
                }
              }
            })
            return industries.map(i => ({ name: i.name, deals: i._count.transactions })).sort((a, b) => b.deals - a.deals)
          },
        }),
        getTopCountries: tool({
          description: 'Obtiene los países con más operaciones transaccionales.',
          parameters: z.object({
            limit: z.number().optional().describe('Cantidad de países a retornar, por defecto 5'),
            year: z.number().optional().describe('Filtra por año específico'),
          }),
          execute: async ({ limit = 5, year }: { limit?: number, year?: number }) => {
            const dateFilter = year ? {
              dateAnnounced: {
                gte: new Date(`${year}-01-01`),
                lt: new Date(`${year + 1}-01-01`)
              }
            } : {}

            const transactions = await prisma.transaction.findMany({
              where: {
                country: { not: null },
                ...dateFilter
              },
              select: { country: true }
            })

            const countMap: Record<string, number> = {}
            transactions.forEach(t => {
              if (t.country) {
                const countriesArray = t.country.split(',').map(c => c.trim())
                countriesArray.forEach(c => {
                  countMap[c] = (countMap[c] || 0) + 1
                })
              }
            })

            const sorted = Object.entries(countMap)
              .map(([name, deals]) => ({ name, deals }))
              .sort((a, b) => b.deals - a.deals)
              .slice(0, limit)
            
            return sorted
          },
        })
      },
    })

    return result.toTextStreamResponse()

  } catch (error) {
    console.error('Chat API Error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
