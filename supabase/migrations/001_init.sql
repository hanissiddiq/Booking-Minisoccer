-- KickZone Booking: skema, anti double booking, RLS. Jalankan di Supabase SQL Editor.
create extension if not exists btree_gist;

create type user_role as enum ('user','admin');
create type booking_status as enum ('pending_payment','confirmed','completed','cancelled','expired');
create type payment_status as enum ('unpaid','pending_verification','paid','refunded');

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null default '', email text, phone text,
  role user_role not null default 'user', is_active boolean not null default true,
  created_at timestamptz not null default now());

create table public.settings (
  id int primary key default 1 check (id = 1),
  pending_minutes int not null default 15 check (pending_minutes > 0),
  cancel_hours_before int not null default 24,
  cash_enabled boolean not null default false,
  bank_info text not null default 'Bank BCA 1234567890 a.n. KickZone');
insert into public.settings default values;

create table public.fields (
  id uuid primary key default gen_random_uuid(),
  name text not null, description text, location text, photo_url text,
  facilities text[] not null default '{}',
  price_per_hour numeric(12,2) not null check (price_per_hour >= 0),
  opening_time time not null default '08:00', closing_time time not null default '23:00',
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  check (closing_time > opening_time));

create table public.price_rules (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references fields(id) on delete cascade,
  day_type text not null check (day_type in ('weekday','weekend','all')),
  start_time time not null, end_time time not null,
  price_per_hour numeric(12,2) not null check (price_per_hour >= 0),
  check (end_time > start_time));

create table public.field_blocked_slots (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references fields(id) on delete cascade,
  start_datetime timestamptz not null, end_datetime timestamptz not null,
  reason text, created_by uuid references profiles(id), created_at timestamptz not null default now(),
  check (end_datetime > start_datetime));

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text not null unique default
    ('KZ-' || to_char(now() at time zone 'Asia/Jakarta','YYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text),1,5))),
  user_id uuid not null references profiles(id),
  field_id uuid not null references fields(id),
  booking_date date not null, start_time time not null, end_time time not null,
  total_price numeric(12,2) not null check (total_price >= 0),
  booking_status booking_status not null default 'pending_payment',
  payment_status payment_status not null default 'unpaid',
  expires_at timestamptz, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (end_time > start_time),
  -- INTI anti double booking: rentang [start,end) pada lapangan sama tidak boleh beririsan
  -- selama status masih mengunci slot. 20:00 setelah 19:00-20:00 diperbolehkan.
  constraint bookings_no_overlap exclude using gist (
    field_id with =,
    tsrange(booking_date + start_time, booking_date + end_time, '[)') with &&
  ) where (booking_status in ('pending_payment','confirmed')));
create index on bookings (user_id);
create index on bookings (field_id, booking_date);
create index on bookings (booking_status, expires_at);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references bookings(id) on delete cascade,
  payment_method text not null check (payment_method in ('transfer','cash')),
  amount numeric(12,2) not null, proof_url text,
  payment_status payment_status not null default 'pending_verification',
  verified_by uuid references profiles(id), verified_at timestamptz,
  created_at timestamptz not null default now());

-- ===== helper =====
create function public.is_admin() returns boolean language sql security definer stable set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and is_active) $$;

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin  -- role SELALU 'user'; metadata dari form registrasi tidak pernah dipakai untuk role
  insert into profiles (id, full_name, email, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email, new.raw_user_meta_data->>'phone');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.guard_profile_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_admin()
     and (new.role <> old.role or new.is_active <> old.is_active or new.id <> old.id) then
    raise exception 'FORBIDDEN';
  end if;
  return new;
end $$;
create trigger guard_profile before update on public.profiles for each row execute function public.guard_profile_update();

-- ===== harga dihitung di server =====
create function public.quote_price(p_field uuid, p_date date, p_start time, p_hours int)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare total numeric := 0; base numeric; r numeric; t time; dt text; h int;
begin
  select price_per_hour into base from fields where id = p_field;
  if base is null then raise exception 'FIELD_UNAVAILABLE'; end if;
  dt := case when extract(isodow from p_date) in (6,7) then 'weekend' else 'weekday' end;
  for h in 0..p_hours-1 loop
    t := p_start + make_interval(hours => h);
    select price_per_hour into r from price_rules
      where field_id = p_field and day_type in (dt,'all') and t >= start_time and t < end_time
      order by (day_type <> 'all') desc limit 1;
    total := total + coalesce(r, base);
  end loop;
  return total;
end $$;

-- ===== kedaluwarsa & selesai =====
create function public.expire_pending_bookings() returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update bookings set booking_status = 'expired', updated_at = now()
   where booking_status = 'pending_payment' and expires_at is not null and expires_at <= now();
  get diagnostics n = row_count;
  update bookings set booking_status = 'completed', updated_at = now()
   where booking_status = 'confirmed' and (booking_date + end_time) at time zone 'Asia/Jakarta' <= now();
  return n;
end $$;
revoke execute on function public.expire_pending_bookings() from public, anon, authenticated;

do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('expire-bookings', '* * * * *', 'select public.expire_pending_bookings()');
exception when others then raise notice 'pg_cron belum aktif: aktifkan di Database > Extensions lalu jalankan ulang blok ini.';
end $$;

-- ===== ketersediaan (publik, hanya status terisi/kosong) =====
create function public.get_availability(p_field_id uuid, p_date date)
returns table (slot_start time, available boolean) language sql security definer stable set search_path = public as $$
  with f as (select opening_time o, closing_time c from fields where id = p_field_id and status = 'active'),
  hrs as (
    select (f.o + make_interval(hours => g))::time as s
    from f, generate_series(0, 23) g
    where g + extract(hour from f.o) + 1 <= extract(hour from f.c))
  select h.s, not (
    (p_date + h.s) at time zone 'Asia/Jakarta' <= now()
    or exists (select 1 from bookings b where b.field_id = p_field_id and b.booking_date = p_date
         and b.booking_status in ('pending_payment','confirmed')
         and (b.booking_status = 'confirmed' or b.expires_at is null or b.expires_at > now())
         and b.start_time < h.s + interval '1 hour' and b.end_time > h.s)
    or exists (select 1 from field_blocked_slots x where x.field_id = p_field_id
         and tstzrange(x.start_datetime, x.end_datetime) &&
             tstzrange((p_date + h.s) at time zone 'Asia/Jakarta', (p_date + h.s + interval '1 hour') at time zone 'Asia/Jakarta'))
  ) from hrs h order by h.s
$$;

-- ===== buat booking (atomik) =====
create function public.create_booking(p_field_id uuid, p_date date, p_start time, p_hours int, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare f fields%rowtype; v_end time; v_price numeric; s settings%rowtype; b bookings%rowtype;
        ts_start timestamptz; ts_end timestamptz;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not exists (select 1 from profiles where id = auth.uid() and is_active) then raise exception 'ACCOUNT_DISABLED'; end if;
  if p_hours < 1 or p_hours > 6 or extract(minute from p_start) <> 0 then raise exception 'INVALID_INPUT'; end if;
  select * into f from fields where id = p_field_id and status = 'active';
  if not found then raise exception 'FIELD_UNAVAILABLE'; end if;
  v_end := p_start + make_interval(hours => p_hours);
  if v_end <= p_start or p_start < f.opening_time or v_end > f.closing_time then raise exception 'OUTSIDE_HOURS'; end if;
  ts_start := (p_date + p_start) at time zone 'Asia/Jakarta';
  ts_end   := (p_date + v_end)   at time zone 'Asia/Jakarta';
  if ts_start <= now() then raise exception 'PAST_TIME'; end if;
  if exists (select 1 from field_blocked_slots x where x.field_id = p_field_id
             and tstzrange(x.start_datetime, x.end_datetime) && tstzrange(ts_start, ts_end)) then
    raise exception 'SLOT_BLOCKED'; end if;
  perform expire_pending_bookings();   -- lepaskan slot milik booking kedaluwarsa
  v_price := quote_price(p_field_id, p_date, p_start, p_hours);   -- harga selalu dari server
  select * into s from settings;
  begin
    insert into bookings (user_id, field_id, booking_date, start_time, end_time, total_price, expires_at, notes)
    values (auth.uid(), p_field_id, p_date, p_start, v_end, v_price, now() + make_interval(mins => s.pending_minutes), p_notes)
    returning * into b;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN';      -- constraint menjamin hanya satu transaksi yang menang
  end;
  return jsonb_build_object('id', b.id, 'booking_code', b.booking_code);
end $$;

create function public.submit_payment(p_booking_id uuid, p_method text, p_proof_path text default null)
returns void language plpgsql security definer set search_path = public as $$
declare b bookings%rowtype; s settings%rowtype;
begin
  select * into b from bookings where id = p_booking_id and user_id = auth.uid() for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if b.booking_status <> 'pending_payment' or (b.expires_at is not null and b.expires_at <= now()) then raise exception 'BOOKING_EXPIRED'; end if;
  select * into s from settings;
  if p_method = 'cash' and not s.cash_enabled then raise exception 'INVALID_INPUT'; end if;
  if p_method = 'transfer' and (p_proof_path is null or split_part(p_proof_path,'/',1) <> auth.uid()::text) then raise exception 'INVALID_INPUT'; end if;
  insert into payments (booking_id, payment_method, amount, proof_url)
  values (b.id, p_method, b.total_price, p_proof_path)
  on conflict (booking_id) do update set payment_method = excluded.payment_method, proof_url = excluded.proof_url,
    payment_status = 'pending_verification';
  -- slot tetap ditahan selama menunggu verifikasi admin
  update bookings set payment_status = 'pending_verification', expires_at = null, updated_at = now() where id = b.id;
end $$;

create function public.admin_verify_payment(p_booking_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare s settings%rowtype;
begin
  if not is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into s from settings;
  if p_approve then
    update payments set payment_status = 'paid', verified_by = auth.uid(), verified_at = now() where booking_id = p_booking_id;
    update bookings set booking_status = 'confirmed', payment_status = 'paid', expires_at = null, updated_at = now()
     where id = p_booking_id and booking_status = 'pending_payment';
  else
    update payments set payment_status = 'unpaid', verified_by = auth.uid(), verified_at = now() where booking_id = p_booking_id;
    update bookings set payment_status = 'unpaid', expires_at = now() + make_interval(mins => s.pending_minutes), updated_at = now()
     where id = p_booking_id and booking_status = 'pending_payment';
  end if;
end $$;

create function public.cancel_booking(p_booking_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare b bookings%rowtype; s settings%rowtype;
begin
  select * into b from bookings where id = p_booking_id for update;
  if not found or (b.user_id <> auth.uid() and not is_admin()) then raise exception 'NOT_FOUND'; end if;
  if b.booking_status not in ('pending_payment','confirmed') then raise exception 'NOT_CANCELLABLE'; end if;
  select * into s from settings;
  if b.booking_status = 'confirmed' and not is_admin()
     and ((b.booking_date + b.start_time) at time zone 'Asia/Jakarta') - now() < make_interval(hours => s.cancel_hours_before) then
    raise exception 'CANCEL_WINDOW_PASSED';
  end if;
  update bookings set booking_status = 'cancelled', updated_at = now(),
    payment_status = case when payment_status = 'paid' then 'refunded' else payment_status end where id = b.id;
  update payments set payment_status = 'refunded' where booking_id = b.id and payment_status = 'paid';
end $$;

grant execute on function public.get_availability(uuid,date), public.quote_price(uuid,date,time,int) to anon, authenticated;
revoke execute on function public.create_booking(uuid,date,time,int,text), public.submit_payment(uuid,text,text),
  public.admin_verify_payment(uuid,boolean), public.cancel_booking(uuid) from public, anon;

-- ===== RLS =====
alter table profiles enable row level security;  alter table settings enable row level security;
alter table fields enable row level security;    alter table price_rules enable row level security;
alter table field_blocked_slots enable row level security;
alter table bookings enable row level security;  alter table payments enable row level security;

create policy p_sel on profiles for select using (id = auth.uid() or is_admin());
create policy p_upd on profiles for update using (id = auth.uid() or is_admin()) with check (id = auth.uid() or is_admin());
create policy s_sel on settings for select using (true);
create policy s_adm on settings for all using (is_admin()) with check (is_admin());
create policy f_sel on fields for select using (status = 'active' or is_admin());
create policy f_adm on fields for all using (is_admin()) with check (is_admin());
create policy r_sel on price_rules for select using (true);
create policy r_adm on price_rules for all using (is_admin()) with check (is_admin());
create policy x_adm on field_blocked_slots for all using (is_admin()) with check (is_admin());
create policy b_sel on bookings for select using (user_id = auth.uid() or is_admin());
create policy b_adm on bookings for all using (is_admin()) with check (is_admin());  -- user biasa: tanpa insert/update/delete langsung
create policy y_sel on payments for select using (is_admin() or exists (select 1 from bookings b where b.id = booking_id and b.user_id = auth.uid()));
create policy y_adm on payments for all using (is_admin()) with check (is_admin());

-- ===== storage bukti bayar (privat) =====
insert into storage.buckets (id, name, public) values ('payment-proofs','payment-proofs', false) on conflict do nothing;
create policy proofs_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy proofs_sel on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- contoh data awal
insert into fields (name, description, location, facilities, price_per_hour)
values ('Lapangan 1','Rumput sintetis standar mini soccer, lampu LED.','Bireuen, Aceh', array['Lampu LED','Kamar mandi','Parkir','Kantin'], 250000);
