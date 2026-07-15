import { createClient } from '@supabase/supabase-js'
const supabase = createClient('http://localhost', 'key')
supabase.auth.admin.generateLink({ type: 'invite', email: 'test@test.com' }).then(res => console.log(res.data.properties?.action_link))
