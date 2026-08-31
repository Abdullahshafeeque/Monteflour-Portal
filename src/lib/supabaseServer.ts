import { createClient } from '@supabase/supabase-js';

// Server-only client. Uses the SERVICE ROLE key, which bypasses Row Level
// Security. Only ever import this inside API routes, Server Components, or
// Server Actions — never inside a 'use client' component or anything that
// ships to the browser.
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
