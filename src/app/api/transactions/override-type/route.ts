import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// PATCH: Apply manual type override to a transaction
// This correction persists through re-syncs — the ETL will use typeOverride instead of re-classifying
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { transactionId, newType, clearOverride } = body

    if (!transactionId) {
      return NextResponse.json({ error: 'transactionId is required' }, { status: 400 })
    }

    const validTypes = ['M&A', 'Emisiones', 'Financiamientos', 'Operación General']

    if (clearOverride) {
      // Remove the manual override — sync will re-classify automatically
      const updated = await prisma.transaction.update({
        where: { id: transactionId },
        data: { typeOverride: null, type: undefined }, // Type will be reset on next sync
        select: { id: true, title: true, type: true, typeOverride: true, practiceArea: true }
      })
      return NextResponse.json({ success: true, data: updated, message: 'Override cleared. Type will be re-evaluated on next sync.' })
    }

    if (!newType || !validTypes.includes(newType)) {
      return NextResponse.json({ error: `newType must be one of: ${validTypes.join(', ')}` }, { status: 400 })
    }

    // Apply the override — both typeOverride AND type are updated
    const updated = await prisma.transaction.update({
      where: { id: transactionId },
      data: { 
        typeOverride: newType,
        type: newType  // Immediately update the visible type too
      },
      select: { id: true, title: true, type: true, typeOverride: true, practiceArea: true }
    })

    return NextResponse.json({ 
      success: true, 
      data: updated,
      message: `Type overridden to "${newType}". This will persist through future re-syncs.`
    })

  } catch (error: any) {
    console.error('Override Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST: Batch override — apply type corrections from a list
// Expected body: { overrides: [{ transactionId: string, newType: string }] }
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { overrides } = body

    if (!Array.isArray(overrides) || overrides.length === 0) {
      return NextResponse.json({ error: 'overrides array is required' }, { status: 400 })
    }

    const validTypes = ['M&A', 'Emisiones', 'Financiamientos', 'Operación General']
    let applied = 0
    let errors: string[] = []

    for (const { transactionId, newType } of overrides) {
      if (!transactionId || !validTypes.includes(newType)) {
        errors.push(`Invalid: ${transactionId} → ${newType}`)
        continue
      }

      try {
        await prisma.transaction.update({
          where: { id: transactionId },
          data: { typeOverride: newType, type: newType }
        })
        applied++
      } catch (e: any) {
        errors.push(`Failed: ${transactionId} — ${e.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      applied,
      errors: errors.length > 0 ? errors : undefined,
      message: `${applied} overrides applied successfully.${errors.length > 0 ? ` ${errors.length} failed.` : ''}`
    })

  } catch (error: any) {
    console.error('Batch Override Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
