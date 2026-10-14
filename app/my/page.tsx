'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { rupiah, errMsg, hhmm, STATUS, PAY, effStatus } from '@/lib/utils';
export default function My() {
  const sb = useMemo(() => supabase(), []);
  const [accounts, setAccounts] = useState<any[]>([]); const [acc, setAcc] = useState('');
  const [rows, setRows] = useState<any[] | null>(null); const [info, setInfo] = useState<any>(null); const [msg, setMsg] = useState('');
  const load = async () => {
    const { data } = await sb.from('bookings').select('*, fields(name), payments(*)').order('booking_date', { ascending: false }).order('start_time', { ascending: false });
    setRows(data || []); const s = await sb.from('settings').select('*').single(); setInfo(s.data);
    const a = await sb.from('payment_accounts').select('*').eq('is_active', true).order('sort_order').order('created_at');
    setAccounts(a.data || []); setAcc(prev => (a.data?.some((x: any) => x.id === prev) ? prev : a.data?.[0]?.id || ''));
  };
  useEffect(() => { load(); }, []);
  const upload = async (b: any, file: File) => {
    const { data: { user } } = await sb.auth.getUser();
    const path = `${user!.id}/${b.id}-${Date.now()}.${file.name.split('.').pop()}`;
    const up = await sb.storage.from('payment-proofs').upload(path, file);
    if (up.error) return setMsg(up.error.message);
    const { error } = await sb.rpc('submit_payment', { p_booking_id: b.id, p_method: 'transfer', p_proof_path: path, p_account_id: acc });
    setMsg(error ? errMsg(error.message) : 'Bukti transfer terkirim. Admin akan memverifikasi pembayaran Anda.'); load();
  };
  const cash = async (b: any) => { const { error } = await sb.rpc('submit_payment', { p_booking_id: b.id, p_method: 'cash' }); setMsg(error ? errMsg(error.message) : 'Pilihan bayar tunai dicatat. Admin akan mengonfirmasi.'); load(); };
  const cancel = async (b: any) => { if (!confirm('Batalkan booking ini?')) return; const { error } = await sb.rpc('cancel_booking', { p_booking_id: b.id }); setMsg(error ? errMsg(error.message) : 'Booking dibatalkan.'); load(); };
  return (<div className="space-y-4"><h1 className="font-display text-4xl font-bold">Booking saya</h1>
    {msg && <p className="card text-sm text-lime">{msg}</p>}
    {rows === null ? <p className="text-white/60">Memuat…</p> : !rows.length ? <p className="text-white/60">Belum ada booking. Pilih jadwal di halaman Booking.</p> :
    rows.map(b => { const st = effStatus(b); const [label, cls] = STATUS[st];
      return (<div key={b.id} className="card space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-display text-xl font-bold">{b.booking_code}</span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{label}</span></div>
        <p className="text-sm text-white/70">Penyewa: {b.renter_name || '-'}</p>
        <p>{b.fields?.name} · {b.booking_date} · {hhmm(b.start_time)}–{hhmm(b.end_time)} WIB</p>
        <p className="text-sm text-white/70">{rupiah(b.total_price)} · Pembayaran: {PAY[b.payment_status]}</p>
        {st === 'pending_payment' && b.payment_status === 'unpaid' && (<div className="space-y-2 rounded-md bg-white/5 p-3 text-sm">
          <p>Transfer <b>{rupiah(b.total_price)}</b> sebelum {b.expires_at && new Date(b.expires_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}. Pilih tujuan transfer:</p>
          {!accounts.length ? <p className="text-amber-300">Belum ada tujuan transfer aktif. Hubungi admin.</p> : <div className="space-y-2">{accounts.map(a => (
            <label key={a.id} className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 ${acc === a.id ? 'border-lime' : 'border-white/15'}`}>
              <input type="radio" name="acc" checked={acc === a.id} onChange={() => setAcc(a.id)} />
              <span><b>{a.bank_name}</b> · {a.account_number}<br />a.n. {a.account_name}{a.notes && <><br /><span className="text-white/60">{a.notes}</span></>}</span></label>))}</div>}
          <label className={`btn-ghost cursor-pointer ${!acc ? 'pointer-events-none opacity-40' : ''}`}>Unggah bukti transfer<input type="file" disabled={!acc} accept="image/*,application/pdf" className="hidden" onChange={e => e.target.files?.[0] && upload(b, e.target.files[0])} /></label>
          {info?.cash_enabled && <button className="btn-ghost ml-2" onClick={() => cash(b)}>Bayar tunai di lokasi</button>}</div>)}
        {['pending_payment', 'confirmed'].includes(st) && <button className="btn-ghost" onClick={() => cancel(b)}>Batalkan booking</button>}
      </div>); })}</div>);
}
