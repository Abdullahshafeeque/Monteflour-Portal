import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isAdmin } from '@/lib/roles';

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
  const isAdminRoute = path.startsWith('/admin') || path.startsWith('/api/admin');
  const isInfluencerRoute = path.startsWith('/influencer');

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = isInfluencerRoute ? '/influencer-login' : '/admin-login';
    return NextResponse.redirect(url);
  }

  const userIsAdmin = isAdmin(session.user);

  if (isAdminRoute && !userIsAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = '/influencer/dashboard';
    return NextResponse.redirect(url);
  }

  if (isInfluencerRoute && userIsAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = { matcher: ['/admin/:path*', '/influencer/:path*', '/api/admin/:path*'] };