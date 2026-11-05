// @ts-nocheck
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export function AuthListener() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Manually parse hash if Supabase misses it
    if (typeof window !== 'undefined' && window.location.hash.includes('access_token=')) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const access_token = hashParams.get('access_token');
      const refresh_token = hashParams.get('refresh_token');
      const type = hashParams.get('type');
      
      if (access_token && refresh_token) {
        supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
          if (!error) {
            router.refresh();
            if (type === 'recovery' || window.location.pathname === '/reset-password') {
              router.push('/reset-password');
            } else {
              router.push('/dashboard');
            }
          }
        });
      }
    }

    // Standard session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && window.location.hash.includes('access_token')) {
        router.refresh()
        if (window.location.pathname !== '/reset-password') {
          router.push('/dashboard')
        }
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        router.refresh()
        router.push('/reset-password')
      } else if (event === 'SIGNED_IN') {
        router.refresh()
        // Only redirect if they are on login or root to avoid pulling them out of deep pages
        if (window.location.pathname === '/login' || window.location.pathname === '/') {
          router.push('/dashboard')
        }
      } else if (event === 'INITIAL_SESSION' && session && window.location.hash.includes('access_token')) {
        router.refresh()
        if (window.location.pathname !== '/reset-password') {
          router.push('/dashboard')
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router, supabase])

  return null
}
