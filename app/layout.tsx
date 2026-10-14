import './globals.css';
import Link from 'next/link';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import { serverSupabase } from '@/lib/supabase/server';
import SignOut from './SignOut';
const body = Barlow({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-body' });
const display = Barlow_Condensed({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-display' });
export const metadata = { title: 'KickZone Booking', description: 'Sewa lapangan mini soccer online' };
export default async function Layout({ children }: { children: React.ReactNode }) {
  const sb = await serverSupabase();
  const { data: { user } } = await sb.auth.getUser();
  const { data: p } = user ? await sb.from('profiles').select('role').eq('id', user.id).single() : { data: null };
  return (
    <html lang="id" className={`${body.variable} ${display.variable}`}><body>
      <header className="border-b border-white/10"><nav className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="font-display text-2xl font-extrabold tracking-wide">Kick<span className="text-lime">Zone</span></Link>
        <div className="flex items-center gap-2 text-sm">
          <Link href="/book" className="hover:text-lime">Booking</Link>
          {user ? (<>
            <Link href="/my" className="hover:text-lime">Booking saya</Link>
            {p?.role === 'admin' && <Link href="/admin" className="hover:text-lime">Admin</Link>}
            <SignOut /></>) : (<><Link href="/login" className="btn-ghost">Masuk</Link><Link href="/register" className="btn">Daftar</Link></>)}
        </div></nav></header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </body></html>);
}
