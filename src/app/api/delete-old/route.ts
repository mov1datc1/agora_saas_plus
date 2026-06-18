import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const deleted = await prisma.transaction.deleteMany({
      where: {
        dateAnnounced: {
          lt: new Date('2020-01-01')
        }
      }
    })
    
    // Also check dateClosed just in case dateAnnounced was null
    const deleted2 = await prisma.transaction.deleteMany({
      where: {
        dateClosed: {
          lt: new Date('2020-01-01')
        }
      }
    })

    return NextResponse.json({ 
      message: 'Old data deleted successfully', 
      deletedCount: deleted.count + deleted2.count 
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
