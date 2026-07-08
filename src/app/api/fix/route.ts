import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  const tx = await prisma.transaction.findFirst({ where: { title: { contains: 'Parex Resources' } } })
  if (tx) {
    await prisma.transaction.update({
      where: { id: tx.id },
      data: { type: 'Emisiones' }
    })
    return NextResponse.json({ success: true, oldType: tx.type })
  }
  return NextResponse.json({ success: false })
}
