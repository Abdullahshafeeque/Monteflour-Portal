import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const ADMIN_EMAIL = "abdshafeeque@gmail.com";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value; },
        set(name: string, value: string, options: any) { response.cookies.set({ name, value, ...options }); },
        remove(name: string, options: any) { response.cookies.set({ name, value: '', ...options }); },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  const path = request.nextUrl.pathname;
  const isAdminRoute = path.startsWith('/admin');
  const isInfluencerRoute = path.startsWith('/influencer');

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = isInfluencerRoute ? '/influencer-login' : '/admin-login';
    return NextResponse.redirect(url);
  }

  const isAdmin = session.user.email === ADMIN_EMAIL;

  if (isAdminRoute && !isAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = '/influencer/dashboard';
    return NextResponse.redirect(url);
  }

  if (isInfluencerRoute && isAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = { matcher: ['/admin/:path*', '/influencer/:path*'] };