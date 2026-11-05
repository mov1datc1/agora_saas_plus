import { createClient } from '@/utils/supabase/server'
import ResetPasswordClient from './ResetPasswordClient'

export const dynamic = 'force-dynamic'

export default async function ResetPasswordPage() {
  let initialEmail = ''
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) {
      initialEmail = user.email
    }
  } catch (err) {
    // Si no hay cookies en SSR, el cliente resolverá la sesión via URL hash o Supabase client
  }

  return <ResetPasswordClient initialUserEmail={initialEmail} />
}
