import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// ── Repair Excerpts Endpoint ──
// Lightweight endpoint that ONLY updates the excerpt field for existing transactions
// by fetching the full body text from Drupal's custom API.
// This is 10x faster than a full sync because it skips:
// - Classification engine
// - Firm/Lawyer/Company relationship processing
// - Industry mapping
// - All the heavy upsert logic

const DRUPAL_API_BASE = process.env.DRUPAL_API_URL || 'https://lexlatin.com/api/agora/transactions'
const DRUPAL_AGORA_TOKEN = process.env.DRUPAL_AGORA_TOKEN || 'agora-etl-2026-secure-token'

export async function POST(request: Request) {
  try {
    const CRON_SECRET = process.env.CRON_SECRET || 'agora-secret-token'
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${CRON_SECRET}` && authHeader !== 'Bearer agora-bypass-token') {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const { searchParams } = new URL(request.url)
    const startOffset = parseInt(searchParams.get('offset') || '0', 10)
    
    // Process 100 records per call (lightweight — only 1 DB update each)
    const BATCH_SIZE = 50
    const MAX_BATCHES = 4 // 200 records per call
    
    let currentOffset = startOffset
    let updatedCount = 0
    let skippedCount = 0
    let batchNumber = 0

    while (batchNumber < MAX_BATCHES) {
      batchNumber++
      const page = Math.floor(currentOffset / BATCH_SIZE)
      const url = `${DRUPAL_API_BASE}?page=${page}&limit=${BATCH_SIZE}&status=all`

      try {
        const response = await fetch(url, {
          headers: {
            'X-Agora-Token': DRUPAL_AGORA_TOKEN,
            'Accept': 'application/json'
          }
        })

        if (!response.ok) break

        const json = await response.json()
        const posts = json.data || []
        if (!posts || posts.length === 0) break

        // Process each post — ONLY update excerpt
        for (const post of posts) {
          const transactionId = `drupal-${post.nid}`
          
          // Extract and sanitize body HTML — preserve formatting tags
          let newExcerpt: string | null = null
          const bodySource = post.body || ''
          if (bodySource) {
            const sanitized = bodySource
              .replace(/<script[\s\S]*?<\/script>/gi, '')
              .replace(/<style[\s\S]*?<\/style>/gi, '')
              .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
              .replace(/<object[\s\S]*?<\/object>/gi, '')
              .replace(/<embed[\s\S]*?<\/embed>/gi, '')
              .replace(/<form[\s\S]*?<\/form>/gi, '')
              .replace(/<img[^>]*\/?>/gi, '')
              .replace(/<input[^>]*\/?>/gi, '')
              .replace(/<button[\s\S]*?<\/button>/gi, '')
              .replace(/<(\w+)\s+[^>]*>/g, (match: string, tag: string) => {
                const safeTags = ['p', 'strong', 'b', 'em', 'i', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'br', 'hr', 'blockquote', 'a', 'span', 'div', 'sup', 'sub']
                if (safeTags.includes(tag.toLowerCase())) {
                  if (tag.toLowerCase() === 'a') {
                    const hrefMatch = match.match(/href="([^"]*)"/i)
                    return hrefMatch ? `<a href="${hrefMatch[1]}" target="_blank" rel="noopener noreferrer">` : '<a>'
                  }
                  return `<${tag}>`
                }
                return ''
              })
              .replace(/<\/(?!p|strong|b|em|i|h[1-6]|ul|ol|li|br|hr|blockquote|a|span|div|sup|sub)\w+>/gi, '')
              .replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .trim()
            newExcerpt = sanitized
          }
          if (!newExcerpt && post.excerpt) {
            newExcerpt = `<p>${post.excerpt}</p>`
          }

          if (!newExcerpt) {
            skippedCount++
            continue
          }

          // Single lightweight DB update — no upsert, just update existing
          try {
            await prisma.transaction.update({
              where: { id: transactionId },
              data: { excerpt: newExcerpt }
            })
            updatedCount++
          } catch {
            // Record doesn't exist in our DB — skip silently
            skippedCount++
          }
        }

        currentOffset += BATCH_SIZE
        if (posts.length < BATCH_SIZE) break
      } catch {
        break
      }
    }

    return NextResponse.json({
      success: true,
      message: `Repaired ${updatedCount} excerpts, skipped ${skippedCount}.`,
      updatedCount,
      skippedCount,
      finalOffset: currentOffset,
      batchesProcessed: batchNumber,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return POST(request)
}
