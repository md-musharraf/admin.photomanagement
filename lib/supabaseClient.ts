import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// Server code (route handlers, server actions) prefers the service-role key so
// the table can have RLS on with no anon policies: the anon key is public (it is
// shipped to browsers and was committed to this public repo). No client
// component imports this file; SUPABASE_SERVICE_ROLE_KEY is never sent to a browser.
const supabaseAnonKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase URL or Anon Key is missing. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in environment variables.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
