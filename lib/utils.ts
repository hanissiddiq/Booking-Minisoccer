export const rupiah = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
export const todayWIB = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
export const hhmm = (t: string) => t.slice(0, 5);
export const endOf = (start: string, h: number) => String(parseInt(start) + h).padStart(2, '0') + ':00';
const M: Record<string, string> = {
  SLOT_TAKEN: 'Maaf, jadwal yang Anda pilih baru saja dipesan oleh pengguna lain. Silakan pilih jadwal yang tersedia.',
  SLOT_BLOCKED: 'Jadwal ini ditutup oleh pengelola. Silakan pilih jadwal lain.',
  PAST_TIME: 'Jadwal yang dipilih sudah lewat.', OUTSIDE_HOURS: 'Jadwal di luar jam operasional.',
  UNAUTHENTICATED: 'Silakan login terlebih dahulu.', ACCOUNT_DISABLED: 'Akun Anda dinonaktifkan.',
  INVALID_RENTER: 'Nama penyewa wajib diisi (minimal 2 karakter).',
  ACCOUNT_UNAVAILABLE: 'Rekening tujuan tidak tersedia. Pilih rekening lain.',
  INVALID_INPUT: 'Data tidak valid.', FIELD_UNAVAILABLE: 'Lapangan tidak tersedia.',
  BOOKING_EXPIRED: 'Booking sudah kedaluwarsa. Silakan buat booking baru.',
  NOT_CANCELLABLE: 'Booking ini tidak dapat dibatalkan.',
  CANCEL_WINDOW_PASSED: 'Batas waktu pembatalan sudah lewat.', FORBIDDEN: 'Anda tidak memiliki akses.' };
export const errMsg = (m: string) => Object.entries(M).find(([k]) => m?.includes(k))?.[1] ?? 'Terjadi kesalahan. Coba lagi.';
export const STATUS: Record<string, [string, string]> = {
  pending_payment: ['Menunggu pembayaran', 'bg-amber-400/20 text-amber-300'], confirmed: ['Terkonfirmasi', 'bg-lime/20 text-lime'],
  completed: ['Selesai', 'bg-white/15 text-white/70'], cancelled: ['Dibatalkan', 'bg-red-500/20 text-red-300'],
  expired: ['Kedaluwarsa', 'bg-white/10 text-white/50'] };
export const PAY: Record<string, string> = { unpaid: 'Belum Dibayar', pending_verification: 'Menunggu Verifikasi', paid: 'Lunas', refunded: 'Dikembalikan' };
export const effStatus = (b: any) => b.booking_status === 'pending_payment' && b.expires_at && new Date(b.expires_at) < new Date() ? 'expired' : b.booking_status;
