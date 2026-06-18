import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const transactions = await prisma.transaction.findMany({
      include: { industry: true }
    })

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
      if (t.includes('abogado') || t.includes('firma') || t.includes('lexincorp') || t.includes('baker') || t.includes('mckenzie') || t.includes('ontier') || t.includes('greenberg') || t.includes('legal') || t.includes('derecho') || t.includes('cuatrecasas') || t.includes('garrigues') || t.includes('uria') || t.includes('bufete') || t.includes('socio') || t.includes('ley')) return 'Derecho'
      if (t.includes('consultor') || t.includes('asesor') || t.includes('zelca')) return 'Consultoría'
      if (t.includes('entretenimiento') || t.includes('televisión') || t.includes('cine') || t.includes('música') || t.includes('deporte')) return 'Entretenimiento'
      if (t.includes('capital') || t.includes('fondo') || t.includes('inversión') || t.includes('acciones') || t.includes('adquiere') || t.includes('compra') || t.includes('fusión') || t.includes('fusiona')) return 'Banca'
      return null
    }

    let updatedCount = 0

    for (const tx of transactions) {
      if (!tx.industryId || tx.industry?.name === 'Otras') {
        const guessed = guessIndustryFromText(tx.title)
        if (guessed) {
          const upsertedIndustry = await prisma.industry.upsert({
            where: { name: guessed },
            create: { name: guessed },
            update: { name: guessed }
          })
          
          await prisma.transaction.update({
            where: { id: tx.id },
            data: { industryId: upsertedIndustry.id }
          })
          updatedCount++
        }
      }
    }

    return NextResponse.json({ message: `Updated ${updatedCount} transactions` })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
