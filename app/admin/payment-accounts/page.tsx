'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
const empty = { id: '', bank_name: '', account_number: '', account_name: '', notes: '', is_active: true, sort_order: 0 };
export default function AdminPaymentAccounts() {
  const sb = useMemo(() => supabase(), []);
  const [ok, setOk] = useState<boolean | null>(null); const [list, setList] = useState<any[]>([]);
  const [f, setF] = useState<any>(empty); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const load = async () => {
    const { data: { user } } = await sb.auth.getUser();
    const { data: p } = await sb.from('profiles').select('role').eq('id', user!.id).single();
    if (p?.role !== 'admin') return setOk(false); setOk(true);
    const { data } = await sb.from('payment_accounts').select('*').order('sort_order').order('created_at'); setList(data || []);
  };
  useEffect(() => { load(); }, []);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const valid = f.bank_name.trim().length >= 2 && f.account_name.trim().length >= 2 && /^[0-9 -]{5,30}$/.test(f.account_number);
  const save = async () => {
    const row = { bank_name: f.bank_name.trim(), account_number: f.account_number.trim(), account_name: f.account_name.trim(),
      notes: f.notes?.trim() || null, is_active: f.is_active, sort_order: +f.sort_order || 0 };
    setBusy(true);
    const { error } = f.id ? await sb.from('payment_accounts').update(row).eq('id', f.id) : await sb.from('payment_accounts').insert(row);
    setBusy(false);
    if (error) return setMsg('Gagal menyimpan: ' + error.message);
    setMsg(f.id ? 'Perubahan disimpan.' : 'Tujuan transfer ditambahkan.'); setF(empty); load();
  };
  const toggle = async (x: any) => { await sb.from('payment_accounts').update({ is_active: !x.is_active }).eq('id', x.id); load(); };
  const del = async (x: any) => {
    if (!confirm(`Hapus ${x.bank_name} ${x.account_number}? Riwayat pembayaran lama tetap menyimpan catatan tujuannya.`)) return;
    const { error } = await sb.from('payment_accounts').delete().eq('id', x.id);
    setMsg(error ? 'Gagal menghapus: ' + error.message : 'Tujuan transfer dihapus.'); load();
  };
  if (ok === null) return <p className="text-white/60">Memuat…</p>;
  if (!ok) return <p className="text-red-300">Halaman ini hanya untuk admin.</p>;
  return (<div className="space-y-6">
    <div className="flex items-center justify-between"><h1 className="font-display text-4xl font-bold">Tujuan transfer</h1><Link href="/admin" className="btn-ghost">Kembali ke dashboard</Link></div>
    <div className="card space-y-3">
      <h2 className="font-display text-2xl font-bold">{f.id ? 'Edit tujuan transfer' : 'Tambah tujuan transfer'}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">Bank / e-wallet<input className="input" list="bank" value={f.bank_name} onChange={set('bank_name')} placeholder="BSI" />
          <datalist id="bank"><option value="BSI" /><option value="Bank Aceh Syariah" /><option value="BRI" /><option value="BCA" /><option value="BNI" /><option value="Mandiri" /><option value="DANA" /><option value="OVO" /><option value="GoPay" /></datalist></label>
        <label className="space-y-1 text-sm">Nomor rekening / HP<input className="input" inputMode="numeric" value={f.account_number} onChange={set('account_number')} placeholder="1234567890" /></label>
        <label className="space-y-1 text-sm">Atas nama<input className="input" value={f.account_name} onChange={set('account_name')} /></label>
        <label className="space-y-1 text-sm">Urutan tampil<input className="input" type="number" value={f.sort_order} onChange={set('sort_order')} /></label>
        <label className="space-y-1 text-sm sm:col-span-2">Catatan untuk pelanggan (opsional)<input className="input" value={f.notes || ''} onChange={set('notes')} placeholder="Cantumkan kode booking pada berita transfer" /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_active} onChange={e => setF({ ...f, is_active: e.target.checked })} />Aktif (tampil untuk pelanggan)</label>
      </div>
      {f.account_number && !/^[0-9 -]{5,30}$/.test(f.account_number) && <p className="text-sm text-red-300">Nomor hanya boleh angka, spasi, atau tanda hubung (5–30 karakter).</p>}
      {msg && <p className="text-sm text-lime">{msg}</p>}
      <div className="flex gap-2"><button className="btn" disabled={busy || !valid} onClick={save}>{busy ? 'Memproses…' : f.id ? 'Simpan perubahan' : 'Tambah tujuan transfer'}</button>
        {f.id && <button className="btn-ghost" onClick={() => setF(empty)}>Batal</button>}</div>
    </div>
    {!list.length ? <p className="text-white/60">Belum ada tujuan transfer. Pelanggan tidak bisa mengunggah bukti transfer sebelum ada yang aktif.</p> :
    <div className="grid gap-3 sm:grid-cols-2">{list.map(x => (
      <div key={x.id} className="card space-y-1">
        <div className="flex items-center justify-between"><h3 className="font-display text-2xl font-bold">{x.bank_name}</h3>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${x.is_active ? 'bg-lime/20 text-lime' : 'bg-white/10 text-white/50'}`}>{x.is_active ? 'Aktif' : 'Nonaktif'}</span></div>
        <p>{x.account_number}</p><p className="text-sm text-white/70">a.n. {x.account_name}</p>
        {x.notes && <p className="text-sm text-white/50">{x.notes}</p>}
        <div className="flex gap-2 pt-1"><button className="btn-ghost" onClick={() => { setF({ ...x, notes: x.notes || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
          <button className="btn-ghost" onClick={() => toggle(x)}>{x.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
          <button className="btn-ghost" onClick={() => del(x)}>Hapus</button></div>
      </div>))}</div>}
  </div>);
}
