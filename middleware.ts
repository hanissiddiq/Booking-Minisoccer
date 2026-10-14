import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => req.cookies.getAll(), setAll: (l) => {
      l.forEach(({ name, value }) => req.cookies.set(name, value));
      res = NextResponse.next({ request: req });
      l.forEach(({ name, value, options }) => res.cookies.set(name, value, options)); } } });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login?next=' + req.nextUrl.pathname, req.url));
  return res;
}
export const config = { matcher: ['/my/:path*', '/admin/:path*'] };
