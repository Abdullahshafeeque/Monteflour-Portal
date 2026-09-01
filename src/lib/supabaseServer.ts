
 import { createClient } from '@supabase/supabase-js';
  import { createServerClient } from '@supabase/ssr';
   import { cookies } from 'next/headers';
   
   export function supabaseAdmin() {
     return createClient( 
      process.env.NEXT_PUBLIC_SUPABASE_URL!, 
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
       { auth: { persistSession: false } }
       );
       }
        export function supabaseServerClient() { 
          const cookieStore = cookies();
           return createServerClient(
             process.env.NEXT_PUBLIC_SUPABASE_URL!, 
             process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, 
             { 
              cookies: { 
                get(name: string) { 
                  return cookieStore.get(name)?.value; 
                },
               }, 
              }
             );
             }
