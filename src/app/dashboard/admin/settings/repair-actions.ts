'use server'

import { NextRequest } from 'next/server'
import { POST as repairHandler } from '@/app/api/sync-drupal/repair-excerpts/route'

export async function runRepairExcerptsChunk(offset: number) {
  try {
    const mockRequest = new NextRequest(`http://localhost/api/sync-drupal/repair-excerpts?offset=${offset}`, {
      method: 'POST',
      headers: {
        'authorization': `Bearer agora-bypass-token`
      }
    })

    const res = await repairHandler(mockRequest)
    
    if (!res.ok) {
      let errorMsg = res.statusText
      try {
        const errorData = await res.json()
        errorMsg = errorData.error || errorData.message || errorMsg
      } catch (e) {}
      throw new Error(`HTTP ${res.status}: ${errorMsg}`)
    }
    
    const data = await res.json()
    return { success: true, ...data }
  } catch (error: any) {
    console.error("runRepairExcerptsChunk error:", error)
    return { success: false, error: error.message }
  }
}
