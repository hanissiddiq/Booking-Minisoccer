import Link from 'next/link';
import { serverSupabase } from '@/lib/supabase/server';
import { rupiah, hhmm } from '@/lib/utils';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const sb = await serverSupabase();
  const { data: fields } = await sb.from('fields').select('*').eq('status', 'active').order('name');
  return (<div className="space-y-10">
    <section className="relative overflow-hidden rounded-xl bg-pitch p-8 sm:p-14">
      <div aria-hidden className="pointer-events-none absolute -right-24 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full border-4 border-white/25" />
      <div aria-hidden className="pointer-events-none absolute right-12 top-0 h-full w-1 bg-white/25" />
      <h1 className="relative max-w-xl font-display text-5xl font-extrabold leading-none sm:text-7xl">Pilih jam. Kunci lapangan. Main.</h1>
      <p className="relative mt-4 max-w-md text-white/80">Lihat slot kosong secara langsung, pesan dalam hitungan detik, dan slot Anda terkunci begitu booking dibuat.</p>
      <Link href="/book" className="btn relative mt-6">Booking Sekarang</Link>
    </section>
    <section><h2 className="mb-4 font-display text-3xl font-bold">Lapangan</h2>
      {!fields?.length ? <p className="text-white/60">Belum ada lapangan aktif.</p> :
      <div className="grid gap-4 sm:grid-cols-2">{fields.map((f: any) => (
        <div key={f.id} className="card space-y-2">
          <h3 className="font-display text-2xl font-bold">{f.name}</h3>
          <p className="text-sm text-white/70">{f.description}</p>
          <p className="text-sm text-white/60">{f.location} · Buka {hhmm(f.opening_time)}–{hhmm(f.closing_time)}</p>
          <p className="text-sm text-white/60">{(f.facilities || []).join(', ')}</p>
          <div className="flex items-center justify-between pt-2"><span className="text-lg font-semibold text-lime">{rupiah(f.price_per_hour)}/jam</span>
            <Link className="btn" href={`/book?field=${f.id}`}>Lihat jadwal</Link></div>
        </div>))}</div>}
    </section></div>);
}
