-- Jenis lapangan, foto lapangan, dan nama penyewa. Jalankan SETELAH 001_init.sql.
alter table public.fields add column if not exists field_type text not null default 'Mini Soccer';
alter table public.bookings add column if not exists renter_name text not null default '';

-- bucket foto lapangan: publik untuk dibaca, hanya admin yang boleh mengunggah/mengubah/menghapus
insert into storage.buckets (id, name, public) values ('field-photos','field-photos', true) on conflict do nothing;
create policy fphotos_ins on storage.objects for insert to authenticated with check (bucket_id = 'field-photos' and public.is_admin());
create policy fphotos_upd on storage.objects for update to authenticated using (bucket_id = 'field-photos' and public.is_admin());
create policy fphotos_del on storage.objects for delete to authenticated using (bucket_id = 'field-photos' and public.is_admin());

-- create_booking sekarang wajib menerima nama penyewa
drop function if exists public.create_booking(uuid,date,time,int,text);
create function public.create_booking(p_field_id uuid, p_date date, p_start time, p_hours int, p_renter_name text, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare f fields%rowtype; v_end time; v_price numeric; s settings%rowtype; b bookings%rowtype;
        ts_start timestamptz; ts_end timestamptz;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not exists (select 1 from profiles where id = auth.uid() and is_active) then raise exception 'ACCOUNT_DISABLED'; end if;
  p_renter_name := btrim(coalesce(p_renter_name, ''));
  if char_length(p_renter_name) < 2 or char_length(p_renter_name) > 100 then raise exception 'INVALID_RENTER'; end if;
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
  perform expire_pending_bookings();
  v_price := quote_price(p_field_id, p_date, p_start, p_hours);
  select * into s from settings;
  begin
    insert into bookings (user_id, renter_name, field_id, booking_date, start_time, end_time, total_price, expires_at, notes)
    values (auth.uid(), p_renter_name, p_field_id, p_date, p_start, v_end, v_price, now() + make_interval(mins => s.pending_minutes), p_notes)
    returning * into b;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN';
  end;
  return jsonb_build_object('id', b.id, 'booking_code', b.booking_code);
end $$;
revoke execute on function public.create_booking(uuid,date,time,int,text,text) from public, anon;
