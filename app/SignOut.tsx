'use client';
import { supabase } from '@/lib/supabase/client';
export default function SignOut() {
  return <button className="btn-ghost" onClick={async () => { await supabase().auth.signOut(); location.href = '/'; }}>Keluar</button>;
}
