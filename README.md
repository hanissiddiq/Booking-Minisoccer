# KickZone Booking
Next.js 15 + TypeScript + Tailwind + Supabase (Postgres, Auth, RLS, Storage).

## Instalasi
1. Buat project di supabase.com. (Opsional: Authentication > Providers > Email > matikan "Confirm email" untuk uji coba.)
2. Database > Extensions: aktifkan `pg_cron`. Lalu SQL Editor: jalankan seluruh `supabase/migrations/001_init.sql`.
3. `cp .env.example .env.local`, isi URL dan anon key (Project Settings > API). Service role key tidak dipakai.
4. `npm install && npm run dev` lalu buka http://localhost:3000
5. Daftar akun lewat /register, lalu jadikan admin di SQL Editor:
   `update profiles set role = 'admin' where email = 'email-anda@contoh.com';`
6. Atur rekening / waktu tahan / kebijakan batal: `update settings set bank_info='...', pending_minutes=15, cancel_hours_before=24, cash_enabled=true;`

## Cara anti double booking bekerja
- `bookings_no_overlap` (exclusion constraint GiST) menolak rentang [mulai, selesai) yang beririsan pada lapangan sama selama status `pending_payment` / `confirmed`. 19-20 lalu 20-21 diperbolehkan.
- Semua booking dibuat lewat fungsi `create_booking` (validasi jam operasional, waktu lampau, slot diblokir, harga dari server). Dua klik bersamaan: satu berhasil, satu menerima `SLOT_TAKEN`.
- Kedaluwarsa: `pg_cron` memanggil `expire_pending_bookings()` tiap menit, dan `create_booking` juga memanggilnya sebelum insert, sehingga slot tidak tertahan walau cron mati.
- Tabel tidak bisa di-insert/update langsung oleh user (RLS); perubahan status hanya lewat fungsi yang memeriksa kepemilikan/role.
