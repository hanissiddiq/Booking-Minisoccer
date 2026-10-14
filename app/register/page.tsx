'use client';
import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
export default function Register() {
  const [f, setF] = useState({ full_name: '', email: '', phone: '', password: '' });
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const go = async () => {
    setBusy(true); setMsg('');
    const { data, error } = await supabase().auth.signUp({ email: f.email, password: f.password,
      options: { data: { full_name: f.full_name, phone: f.phone } } });  // role tidak pernah dikirim/dipercaya
    setBusy(false);
    if (error) return setMsg(error.message);
    if (data.session) location.href = '/my'; else setMsg('Pendaftaran berhasil. Cek email Anda untuk konfirmasi, lalu masuk.');
  };
  const ok = f.full_name && f.email && f.phone && f.password.length >= 8;
  return (<div className="card mx-auto max-w-sm space-y-3">
    <h1 className="font-display text-3xl font-bold">Daftar</h1>
    <input className="input" placeholder="Nama lengkap" value={f.full_name} onChange={set('full_name')} />
    <input className="input" type="email" placeholder="Email" value={f.email} onChange={set('email')} />
    <input className="input" type="tel" placeholder="Nomor telepon" value={f.phone} onChange={set('phone')} />
    <input className="input" type="password" placeholder="Password (min. 8 karakter)" value={f.password} onChange={set('password')} />
    {msg && <p className="text-sm text-lime">{msg}</p>}
    <button className="btn w-full" disabled={busy || !ok} onClick={go}>{busy ? 'Memproses…' : 'Buat akun'}</button>
    <p className="text-sm text-white/60">Sudah punya akun? <Link className="text-lime" href="/login">Masuk</Link></p></div>);
}
