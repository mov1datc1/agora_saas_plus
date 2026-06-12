'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export function AuthListener() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Check if session was established before the listener attached (INITIAL_SESSION)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && window.location.hash.includes('access_token')) {
        router.refresh()
        router.push('/dashboard')
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
        router.refresh()
        router.push('/dashboard')
      } else if (event === 'INITIAL_SESSION' && session && window.location.hash.includes('access_token')) {
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
