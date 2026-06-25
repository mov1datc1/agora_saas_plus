import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    
    // Si se pasa un status, traemos los jobs con ese status (ej: RUNNING, PAUSED)
    // Si no, traemos el historial de los últimos 10 jobs
    const jobs = await prisma.syncJob.findMany({
      where: status ? { status } : undefined,
      orderBy: { startedAt: 'desc' },
      take: 10,
    })

    return NextResponse.json({ success: true, data: jobs })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { targetUrl } = body

    if (!targetUrl) {
      return NextResponse.json({ success: false, error: 'targetUrl is required' }, { status: 400 })
    }

    // Antes de crear uno nuevo, podríamos marcar los anteriores "RUNNING" como "FAILED" o "CANCELLED"
    // para evitar conflictos, pero por ahora solo creamos el nuevo.
    const job = await prisma.syncJob.create({
      data: {
        targetUrl,
        status: 'RUNNING',
        currentOffset: 0,
        totalProcessed: 0,
        skippedBlocks: 0,
        logs: JSON.stringify([{ time: new Date().toISOString(), message: 'Job iniciado.' }]),
      }
    })

    return NextResponse.json({ success: true, data: job })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, status, currentOffset, totalProcessed, skippedBlocks, log } = body

    if (!id) {
      return NextResponse.json({ success: false, error: 'Job ID is required' }, { status: 400 })
    }

    // Recuperamos el job actual para añadir logs sin borrar los anteriores
    const currentJob = await prisma.syncJob.findUnique({ where: { id } })
    if (!currentJob) {
      return NextResponse.json({ success: false, error: 'Job no encontrado' }, { status: 404 })
    }

    let updatedLogsStr = currentJob.logs
    if (log) {
      const logsArray = currentJob.logs ? JSON.parse(currentJob.logs) : []
      logsArray.push({ time: new Date().toISOString(), message: log })
      
      // Mantenemos solo los últimos 50 logs para no saturar la base de datos
      if (logsArray.length > 50) logsArray.shift()
      updatedLogsStr = JSON.stringify(logsArray)
    }

    const updateData: any = {
      logs: updatedLogsStr,
      updatedAt: new Date()
    }

    if (status) updateData.status = status
    if (currentOffset !== undefined) updateData.currentOffset = currentOffset
    if (totalProcessed !== undefined) updateData.totalProcessed = totalProcessed
    if (skippedBlocks !== undefined) updateData.skippedBlocks = skippedBlocks

    if (status === 'COMPLETED' || status === 'CANCELLED' || status === 'FAILED') {
      updateData.completedAt = new Date()
    }

    const updatedJob = await prisma.syncJob.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json({ success: true, data: updatedJob })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
