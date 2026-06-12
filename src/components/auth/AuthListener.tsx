'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export function AuthListener() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
        // If the user signed in via a magic link (hash fragment), the client SDK
        // automatically detects it, establishes the session, and fires SIGNED_IN.
        // We just need to refresh the router so the server components pick up the cookie,
        // and redirect to the dashboard.
        router.refresh()
        router.push('/dashboard')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router, supabase])

  return null
}
