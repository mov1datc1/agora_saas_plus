import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: 'admin@lexlatin.com',
  })
  if (error) console.error(error)
  else console.log("\nMAGIC LINK PARA EL ADMIN:\n", data.properties?.action_link)
}
main()
