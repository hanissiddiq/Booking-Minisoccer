'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { rupiah, todayWIB, errMsg, hhmm, endOf } from '@/lib/utils';
export default function Book() {
  const sb = useMemo(() => supabase(), []); const router = useRouter();
  const [fields, setFields] = useState<any[]>([]); const [fieldId, setFieldId] = useState('');
  const [date, setDate] = useState(todayWIB()); const [slots, setSlots] = useState<any[] | null>(null);
  const [start, setStart] = useState<string | null>(null); const [hours, setHours] = useState(1);
  const [price, setPrice] = useState<number | null>(null); const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { sb.from('fields').select('*').eq('status', 'active').order('name').then(({ data }) => {
    setFields(data || []); setFieldId(new URLSearchParams(location.search).get('field') || data?.[0]?.id || ''); }); }, [sb]);
  const load = async () => {
    if (!fieldId) return; setSlots(null);
    const { data, error } = await sb.rpc('get_availability', { p_field_id: fieldId, p_date: date });
    if (error) setMsg(errMsg(error.message)); setSlots(data || []);
  };
  useEffect(() => { setStart(null); setHours(1); load(); }, [fieldId, date]);
  const maxHours = useMemo(() => {
    if (!start || !slots) return 1; const i = slots.findIndex(s => s.slot_start === start); let n = 0;
    while (i + n < slots.length && slots[i + n].available && n < 6) n++; return Math.max(n, 1);
  }, [start, slots]);
  useEffect(() => { setPrice(null); if (!start) return;
    sb.rpc('quote_price', { p_field: fieldId, p_date: date, p_start: start, p_hours: hours }).then(({ data }) => setPrice(data)); }, [start, hours]);
  const submit = async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return router.push('/login?next=/book');
    setBusy(true); setMsg(null);
    const { error } = await sb.rpc('create_booking', { p_field_id: fieldId, p_date: date, p_start: start, p_hours: hours, p_notes: notes || null });
    setBusy(false);
    if (error) { setMsg(errMsg(error.message)); setStart(null); load(); return; }
    router.push('/my');
  };
  const field = fields.find(f => f.id === fieldId);
  return (<div className="grid gap-6 md:grid-cols-[1fr_320px]">
    <section className="space-y-4">
      <h1 className="font-display text-4xl font-bold">Jadwal & booking</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">Lapangan<select className="input" value={fieldId} onChange={e => setFieldId(e.target.value)}>
          {fields.map(f => <option key={f.id} value={f.id} className="text-black">{f.name}</option>)}</select></label>
        <label className="space-y-1 text-sm">Tanggal<input className="input" type="date" min={todayWIB()} value={date} onChange={e => e.target.value && setDate(e.target.value)} /></label>
      </div>
      {field && <p className="text-sm text-white/60">Buka {hhmm(field.opening_time)}–{hhmm(field.closing_time)} WIB · mulai {rupiah(field.price_per_hour)}/jam</p>}
      {slots === null ? <p className="text-white/60">Memuat slot…</p> : !slots.length ? <p className="text-white/60">Tidak ada slot pada lapangan ini.</p> :
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{slots.map(s => {
        const sel = s.slot_start === start;
        return <button key={s.slot_start} disabled={!s.available} onClick={() => { setStart(s.slot_start); setHours(1); }}
          className={`rounded-md border px-2 py-3 text-sm font-semibold transition ${!s.available ? 'cursor-not-allowed border-red-500/30 bg-red-500/10 text-red-300/60 line-through' :
            sel ? 'border-lime bg-lime text-black' : 'border-lime/50 bg-lime/10 text-lime hover:bg-lime/20'}`}>{hhmm(s.slot_start)}</button>; })}</div>}
      <p className="text-xs text-white/50"><span className="text-lime">Hijau</span> tersedia · <span className="text-red-300">Merah</span> terisi, ditutup, atau sudah lewat</p>
    </section>
    <aside className="card h-fit space-y-3">
      <h2 className="font-display text-2xl font-bold">Ringkasan</h2>
      {!start ? <p className="text-sm text-white/60">Pilih jam mulai untuk melihat ringkasan.</p> : <>
        <p>{field?.name}<br /><span className="text-white/70">{date} · {hhmm(start)}–{endOf(start, hours)} WIB</span></p>
        <label className="block space-y-1 text-sm">Durasi<select className="input" value={hours} onChange={e => setHours(+e.target.value)}>
          {Array.from({ length: maxHours }, (_, i) => i + 1).map(h => <option key={h} value={h} className="text-black">{h} jam</option>)}</select></label>
        <textarea className="input" rows={2} placeholder="Catatan (opsional)" value={notes} onChange={e => setNotes(e.target.value)} />
        <p className="text-2xl font-bold text-lime">{price === null ? '…' : rupiah(price)}</p>
        <button className="btn w-full" disabled={busy || price === null} onClick={submit}>{busy ? 'Memproses…' : 'Pesan sekarang'}</button></>}
      {msg && <p className="text-sm text-red-300">{msg}</p>}
    </aside></div>);
}
