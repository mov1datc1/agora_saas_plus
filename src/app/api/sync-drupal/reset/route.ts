import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    // Basic Authorization to protect the Wipe Endpoint
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.RESET_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Execute wipe in a specific order due to foreign key constraints, 
    // or just let Cascade delete handle it if relations are configured with onDelete: Cascade.
    // In our schema, Prisma will handle cascading if we delete the parent elements.
    
    // We delete Transactions, Firms, Lawyers, Companies and Industries
    // We run it as a transaction to ensure atomicity
    await prisma.$transaction([
      prisma.transactionCompany.deleteMany(),
      prisma.transactionLawyer.deleteMany(),
      prisma.transactionAdvisor.deleteMany(),
      prisma.transaction.deleteMany(),
      prisma.company.deleteMany(),
      prisma.lawyer.deleteMany(),
      prisma.firm.deleteMany(),
      prisma.industry.deleteMany(),
    ])

    return NextResponse.json({ 
      success: true, 
      message: 'Database wipe successful. The system is ready to sync with the Production API.' 
    })

  } catch (error: any) {
    console.error('Wipe Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
