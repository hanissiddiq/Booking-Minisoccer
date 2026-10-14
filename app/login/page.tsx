'use client';
import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
export default function Login() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true); setErr('');
    const { error } = await supabase().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setErr('Email atau password salah.');
    const next = new URLSearchParams(location.search).get('next') || '/my';
    location.href = next.startsWith('/') ? next : '/my';
  };
  return (<div className="card mx-auto max-w-sm space-y-3">
    <h1 className="font-display text-3xl font-bold">Masuk</h1>
    <input className="input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
    <input className="input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && go()} />
    {err && <p className="text-sm text-red-300">{err}</p>}
    <button className="btn w-full" disabled={busy || !email || !password} onClick={go}>{busy ? 'Memproses…' : 'Masuk'}</button>
    <p className="text-sm text-white/60">Belum punya akun? <Link className="text-lime" href="/register">Daftar</Link></p></div>);
}
