// NOTE: publisher_profile, repo_info, skill_audit, and site_event have RLS
// enabled with NO policies — this anon-key client reads them as silently
// EMPTY result sets (no error). Use serverDb() from lib/db.ts (service role,
// server-side only) for those tables.
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
