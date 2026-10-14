'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { rupiah, hhmm } from '@/lib/utils';
import FieldPhoto from '../../FieldPhoto';
const empty = { id: '', name: '', field_type: 'Mini Soccer', description: '', location: '', price_per_hour: 250000,
  opening_time: '08:00', closing_time: '23:00', facilities: '', status: 'active', photo_url: '' };
export default function AdminFields() {
  const sb = useMemo(() => supabase(), []);
  const [ok, setOk] = useState<boolean | null>(null); const [list, setList] = useState<any[]>([]);
  const [f, setF] = useState<any>(empty); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const load = async () => {
    const { data: { user } } = await sb.auth.getUser();
    const { data: p } = await sb.from('profiles').select('role').eq('id', user!.id).single();
    if (p?.role !== 'admin') return setOk(false); setOk(true);
    const { data } = await sb.from('fields').select('*').order('created_at'); setList(data || []);
  };
  useEffect(() => { load(); }, []);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const pick = async (file: File) => {
    setBusy(true); setMsg('');
    const path = `${crypto.randomUUID()}.${file.name.split('.').pop()}`;
    const up = await sb.storage.from('field-photos').upload(path, file, { contentType: file.type });
    if (up.error) setMsg('Gagal mengunggah foto: ' + up.error.message);
    else setF({ ...f, photo_url: sb.storage.from('field-photos').getPublicUrl(path).data.publicUrl });
    setBusy(false);
  };
  const save = async () => {
    if (f.opening_time.slice(3, 5) !== '00' || f.closing_time.slice(3, 5) !== '00') return setMsg('Jam buka dan tutup harus jam bulat (misal 08:00).');
    if (f.closing_time <= f.opening_time) return setMsg('Jam tutup harus setelah jam buka.');
    if (f.closing_time > '23:00') return setMsg('Jam tutup maksimal 23:00.');
    const row = { name: f.name.trim(), field_type: f.field_type.trim() || 'Mini Soccer', description: f.description, location: f.location,
      price_per_hour: +f.price_per_hour, opening_time: f.opening_time, closing_time: f.closing_time,
      facilities: String(f.facilities).split(',').map(s => s.trim()).filter(Boolean), status: f.status, photo_url: f.photo_url || null };
    setBusy(true);
    const { error } = f.id ? await sb.from('fields').update(row).eq('id', f.id) : await sb.from('fields').insert(row);
    setBusy(false);
    if (error) return setMsg('Gagal menyimpan: ' + error.message);
    setMsg(f.id ? 'Perubahan disimpan.' : 'Lapangan ditambahkan.'); setF(empty); load();
  };
  const edit = (x: any) => { setF({ ...x, facilities: (x.facilities || []).join(', '), opening_time: hhmm(x.opening_time), closing_time: hhmm(x.closing_time),
    photo_url: x.photo_url || '', description: x.description || '', location: x.location || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const del = async (x: any) => {
    if (!confirm(`Hapus ${x.name}?`)) return;
    const { error } = await sb.from('fields').delete().eq('id', x.id);
    setMsg(error ? 'Lapangan ini sudah punya riwayat booking sehingga tidak bisa dihapus. Ubah statusnya menjadi nonaktif.' : 'Lapangan dihapus.'); load();
  };
  if (ok === null) return <p className="text-white/60">Memuat…</p>;
  if (!ok) return <p className="text-red-300">Halaman ini hanya untuk admin.</p>;
  return (<div className="space-y-6">
    <div className="flex items-center justify-between"><h1 className="font-display text-4xl font-bold">Kelola lapangan</h1><Link href="/admin" className="btn-ghost">Kembali ke dashboard</Link></div>
    <div className="card space-y-3">
      <h2 className="font-display text-2xl font-bold">{f.id ? 'Edit lapangan' : 'Tambah lapangan'}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">Nama lapangan<input className="input" value={f.name} onChange={set('name')} placeholder="Lapangan 2" /></label>
        <label className="space-y-1 text-sm">Jenis lapangan<input className="input" list="jenis" value={f.field_type} onChange={set('field_type')} />
          <datalist id="jenis"><option value="Mini Soccer" /><option value="Futsal" /><option value="Rumput Sintetis" /><option value="Rumput Alami" /><option value="Vinyl" /></datalist></label>
        <label className="space-y-1 text-sm">Harga per jam (Rp)<input className="input" type="number" min={0} step={5000} value={f.price_per_hour} onChange={set('price_per_hour')} /></label>
        <label className="space-y-1 text-sm">Status<select className="input" value={f.status} onChange={set('status')}>
          <option value="active" className="text-black">Aktif</option><option value="inactive" className="text-black">Nonaktif</option></select></label>
        <label className="space-y-1 text-sm">Jam buka<input className="input" type="time" step={3600} value={f.opening_time} onChange={set('opening_time')} /></label>
        <label className="space-y-1 text-sm">Jam tutup<input className="input" type="time" step={3600} value={f.closing_time} onChange={set('closing_time')} /></label>
        <label className="space-y-1 text-sm sm:col-span-2">Lokasi<input className="input" value={f.location} onChange={set('location')} /></label>
        <label className="space-y-1 text-sm sm:col-span-2">Fasilitas (pisahkan dengan koma)<input className="input" value={f.facilities} onChange={set('facilities')} placeholder="Lampu LED, Kamar mandi, Parkir" /></label>
        <label className="space-y-1 text-sm sm:col-span-2">Deskripsi<textarea className="input" rows={2} value={f.description} onChange={set('description')} /></label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <FieldPhoto src={f.photo_url} alt="Foto lapangan" className="h-24 w-40 rounded-md" />
        <label className="btn-ghost cursor-pointer">Unggah foto<input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && pick(e.target.files[0])} /></label>
        {f.photo_url && <button className="btn-ghost" onClick={() => setF({ ...f, photo_url: '' })}>Hapus foto</button>}
      </div>
      {msg && <p className="text-sm text-lime">{msg}</p>}
      <div className="flex gap-2"><button className="btn" disabled={busy || f.name.trim().length < 2 || +f.price_per_hour < 0} onClick={save}>{busy ? 'Memproses…' : f.id ? 'Simpan perubahan' : 'Tambah lapangan'}</button>
        {f.id && <button className="btn-ghost" onClick={() => setF(empty)}>Batal</button>}</div>
    </div>
    {!list.length ? <p className="text-white/60">Belum ada lapangan. Tambahkan lapangan pertama di atas.</p> :
    <div className="grid gap-4 sm:grid-cols-2">{list.map(x => (
      <div key={x.id} className="card space-y-2">
        <FieldPhoto src={x.photo_url} alt={x.name} className="h-40 w-full rounded-md" />
        <div className="flex items-center justify-between"><h3 className="font-display text-2xl font-bold">{x.name}</h3>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${x.status === 'active' ? 'bg-lime/20 text-lime' : 'bg-white/10 text-white/50'}`}>{x.status === 'active' ? 'Aktif' : 'Nonaktif'}</span></div>
        <p className="text-sm text-white/70">{x.field_type} · {hhmm(x.opening_time)}–{hhmm(x.closing_time)} · {rupiah(x.price_per_hour)}/jam</p>
        <div className="flex gap-2"><button className="btn-ghost" onClick={() => edit(x)}>Edit</button><button className="btn-ghost" onClick={() => del(x)}>Hapus</button></div>
      </div>))}</div>}
  </div>);
}
