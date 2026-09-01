import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  // 1. If not logged in at all, redirect to login page
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin-login';
    return NextResponse.redirect(url);
  }

  // 2. Define your master admin email here!
  const myAdminEmail = "abdullahshafeeque@gmail.com"; // <-- Change if your admin login email is different

  // 3. If a logged-in user is NOT you, block them from the admin panel and send them to their dashboard
  if (session.user.email !== myAdminEmail) {
    const url = request.nextUrl.clone();
    url.pathname = '/influencer/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = { matcher: ['/admin/:path*'] };