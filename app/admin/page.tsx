'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { rupiah, errMsg, hhmm, todayWIB, STATUS, PAY, effStatus } from '@/lib/utils';
export default function Admin() {
  const sb = useMemo(() => supabase(), []);
  const [ok, setOk] = useState<boolean | null>(null); const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState(''); const [fs, setFs] = useState(''); const [msg, setMsg] = useState('');
  const load = async () => {
    const { data: { user } } = await sb.auth.getUser();
    const { data: p } = await sb.from('profiles').select('role').eq('id', user!.id).single();
    if (p?.role !== 'admin') return setOk(false); setOk(true);
    const { data } = await sb.from('bookings').select('*, fields(name), profiles(full_name, phone), payments(*)').order('created_at', { ascending: false }).limit(500);
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);
  const act = async (fn: string, args: any) => { const { error } = await sb.rpc(fn, args); setMsg(error ? errMsg(error.message) : 'Berhasil.'); load(); };
  const proof = async (path: string) => { const { data } = await sb.storage.from('payment-proofs').createSignedUrl(path, 60); data && window.open(data.signedUrl, '_blank'); };
  const stats = useMemo(() => {
    const t = todayWIB(); const d = (n: number) => new Date(Date.now() - n * 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    const paid = rows.filter(b => b.payment_status === 'paid' && ['confirmed', 'completed'].includes(b.booking_status));
    const sum = (f: (b: any) => boolean) => paid.filter(f).reduce((a, b) => a + +b.total_price, 0);
    return { today: rows.filter(b => b.booking_date === t && ['confirmed', 'pending_payment'].includes(b.booking_status)).length,
      revDay: sum(b => b.booking_date === t), revWeek: sum(b => b.booking_date >= d(6)), revMonth: sum(b => b.booking_date.slice(0, 7) === t.slice(0, 7)),
      pending: rows.filter(b => effStatus(b) === 'pending_payment').length, confirmed: rows.filter(b => b.booking_status === 'confirmed').length };
  }, [rows]);
  const shown = rows.filter(b => (!fs || effStatus(b) === fs) && (!q || [b.booking_code, b.profiles?.full_name, b.booking_date].join(' ').toLowerCase().includes(q.toLowerCase())));
  if (ok === null) return <p className="text-white/60">Memuat…</p>;
  if (!ok) return <p className="text-red-300">Halaman ini hanya untuk admin.</p>;
  const S = ({ l, v }: any) => <div className="card"><p className="text-sm text-white/60">{l}</p><p className="font-display text-3xl font-bold text-lime">{v}</p></div>;
  return (<div className="space-y-6"><h1 className="font-display text-4xl font-bold">Dashboard admin</h1>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      <S l="Booking hari ini" v={stats.today} /><S l="Pendapatan hari ini" v={rupiah(stats.revDay)} /><S l="Pendapatan 7 hari" v={rupiah(stats.revWeek)} />
      <S l="Pendapatan bulan ini" v={rupiah(stats.revMonth)} /><S l="Menunggu pembayaran" v={stats.pending} /><S l="Terkonfirmasi" v={stats.confirmed} /></div>
    {msg && <p className="card text-sm text-lime">{msg}</p>}
    <div className="flex flex-wrap gap-2"><input className="input max-w-xs" placeholder="Cari kode, nama, tanggal" value={q} onChange={e => setQ(e.target.value)} />
      <select className="input max-w-[200px]" value={fs} onChange={e => setFs(e.target.value)}><option value="" className="text-black">Semua status</option>
        {Object.entries(STATUS).map(([k, [l]]) => <option key={k} value={k} className="text-black">{l}</option>)}</select></div>
    {!shown.length ? <p className="text-white/60">Tidak ada booking yang cocok.</p> : shown.map(b => { const st = effStatus(b); const pay = b.payments; const [label, cls] = STATUS[st];
      return (<div key={b.id} className="card space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2"><b>{b.booking_code}</b><span className={`rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{label}</span></div>
        <p className="text-sm">{b.profiles?.full_name} ({b.profiles?.phone}) · {b.fields?.name} · {b.booking_date} {hhmm(b.start_time)}–{hhmm(b.end_time)} · {rupiah(b.total_price)} · {PAY[b.payment_status]}</p>
        <div className="flex flex-wrap gap-2">
          {pay?.proof_url && <button className="btn-ghost" onClick={() => proof(pay.proof_url)}>Lihat bukti</button>}
          {b.payment_status === 'pending_verification' && st === 'pending_payment' && <>
            <button className="btn" onClick={() => act('admin_verify_payment', { p_booking_id: b.id, p_approve: true })}>Verifikasi lunas</button>
            <button className="btn-ghost" onClick={() => act('admin_verify_payment', { p_booking_id: b.id, p_approve: false })}>Tolak pembayaran</button></>}
          {['pending_payment', 'confirmed'].includes(st) && <button className="btn-ghost" onClick={() => confirm('Batalkan booking ini?') && act('cancel_booking', { p_booking_id: b.id })}>Batalkan</button>}
        </div></div>); })}</div>);
}
