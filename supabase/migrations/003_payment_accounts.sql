-- Master data tujuan transfer (rekening/e-wallet). Jalankan SETELAH 002.
create table public.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  bank_name text not null check (char_length(btrim(bank_name)) >= 2),
  account_number text not null check (account_number ~ '^[0-9 -]{5,30}$'),
  account_name text not null check (char_length(btrim(account_name)) >= 2),
  notes text, is_active boolean not null default true, sort_order int not null default 0,
  created_at timestamptz not null default now());
alter table public.payment_accounts enable row level security;
create policy pa_sel on public.payment_accounts for select to authenticated using (is_active or public.is_admin());
create policy pa_adm on public.payment_accounts for all using (public.is_admin()) with check (public.is_admin());

-- pembayaran mencatat rekening tujuan + salinan teksnya (riwayat tetap utuh jika rekening diubah/dihapus)
alter table public.payments add column if not exists payment_account_id uuid references public.payment_accounts(id) on delete set null;
alter table public.payments add column if not exists account_snapshot text;

drop function if exists public.submit_payment(uuid, text, text);
create function public.submit_payment(p_booking_id uuid, p_method text, p_proof_path text default null, p_account_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare b bookings%rowtype; s settings%rowtype; a payment_accounts%rowtype; snap text;
begin
  select * into b from bookings where id = p_booking_id and user_id = auth.uid() for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if b.booking_status <> 'pending_payment' or (b.expires_at is not null and b.expires_at <= now()) then raise exception 'BOOKING_EXPIRED'; end if;
  select * into s from settings;
  if p_method not in ('transfer','cash') then raise exception 'INVALID_INPUT'; end if;
  if p_method = 'cash' and not s.cash_enabled then raise exception 'INVALID_INPUT'; end if;
  if p_method = 'transfer' then
    if p_proof_path is null or split_part(p_proof_path,'/',1) <> auth.uid()::text then raise exception 'INVALID_INPUT'; end if;
    select * into a from payment_accounts where id = p_account_id and is_active;
    if not found then raise exception 'ACCOUNT_UNAVAILABLE'; end if;
    snap := a.bank_name || ' ' || a.account_number || ' a.n. ' || a.account_name;
  end if;
  insert into payments (booking_id, payment_method, amount, proof_url, payment_account_id, account_snapshot)
  values (b.id, p_method, b.total_price, p_proof_path, case when p_method = 'transfer' then a.id end, snap)
  on conflict (booking_id) do update set payment_method = excluded.payment_method, proof_url = excluded.proof_url,
    payment_account_id = excluded.payment_account_id, account_snapshot = excluded.account_snapshot,
    payment_status = 'pending_verification';
  update bookings set payment_status = 'pending_verification', expires_at = null, updated_at = now() where id = b.id;
end $$;
revoke execute on function public.submit_payment(uuid,text,text,uuid) from public, anon;
