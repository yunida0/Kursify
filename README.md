# Kursify

Sistem informasi absensi dan keuangan untuk lembaga kursus. Aplikasi web full-stack
dengan empat peran (Owner, Admin, Staf Keuangan, Tutor), pendaftaran publik,
verifikasi sertifikat, dokumen PDF, ekspor laporan, dan job terjadwal.

Dokumentasi status pembangunan per fase ada di [`docs/progress.md`](docs/progress.md).

---

## 1. Fitur utama

### Publik
- `/daftar` — pendaftaran siswa baru + upload berkas, membuat siswa `pending` dan
  tagihan pendaftaran otomatis.
- `/verifikasi` dan `/verifikasi/{token}` — verifikasi keaslian sertifikat melalui
  nomor sertifikat atau QR.
- `/login` — login email + password (Auth.js Credentials, bcrypt, JWT role).

### Owner
- Dashboard ringkasan: siswa aktif, pemasukan/pengeluaran bulan ini, saldo kas,
  tunggakan, dan antrean persetujuan.
- Persetujuan pengeluaran dan rekap honor.
- Potongan/beasiswa dan koreksi denda (dengan alasan + audit log).
- Skema/tarif honor tutor.
- Kelola pengguna, pengaturan lembaga, audit log.
- Akses ke seluruh halaman Admin dan Keuangan.

### Admin
- Dashboard pendaftar, kelas hari ini, dan sesi yang belum diisi absensinya.
- Data siswa: daftar/filter, detail, verifikasi + aktivasi, ubah status, kartu QR.
- Master data tutor (tanpa tarif), program + materi, ruangan, kelas + jadwal rutin.
- Penempatan siswa ke kelas dengan validasi kuota dan bentrok jadwal.
- Kalender sesi: pembatalan, sesi pengganti, koreksi absensi di luar 24 jam.
- Penerbitan sertifikat dan Hasil Penilaian.
- Laporan absensi dan program terpopuler (PDF/Excel).

### Staf Keuangan
- Dashboard tagihan jatuh tempo, tunggakan, dan saldo per akun.
- Tagihan: daftar/filter, tagihan `lain`, detail, pembayaran, void, kuitansi PDF.
- Pembayaran maksimal 2 cicilan valid per tagihan; kelebihan sisa ditolak.
- Pengeluaran: input + nota, daftar, pembayaran, approval Owner di atas
  Rp500.000, pengeluaran rutin.
- Rekap honor: review, approval Owner bila perlu, pembayaran, slip PDF,
  penguncian absensi periode.
- Buku kas dan laporan keuangan/honor/siswa kritis (PDF/Excel).

### Tutor
- Sesi hari ini: buka sesi, absensi H/I/S/A manual atau scan QR kamera,
  penanda tunggakan siswa.
- Kelas saya: riwayat sesi dan rekap kehadiran.
- Input nilai final test per materi.
- Honor saya: riwayat dan unduh slip honor.

---

## 2. Stack

| Bagian | Teknologi |
|---|---|
| Framework | Next.js 15 App Router + TypeScript (`strict`) |
| UI | Tailwind CSS 3, komponen bergaya shadcn/ui, lucide-react |
| Database | MySQL 8 / MariaDB 10.4 melalui Prisma ORM 6 |
| Auth | Auth.js (NextAuth v5 beta), Credentials, bcrypt, JWT role |
| Validasi | Zod, react-hook-form |
| Tabel & filter | TanStack Table, pagination/filter server-side |
| PDF | `@react-pdf/renderer`, `qrcode` |
| Excel | `exceljs` |
| QR kamera | `html5-qrcode` |
| Tanggal | `date-fns` + `date-fns-tz` (Asia/Jakarta) |
| Uang | integer rupiah, format `Intl.NumberFormat("id-ID")` |
| Unit test | Vitest |
| E2E test | Playwright (Chrome) |

---

## 3. Persyaratan

- Node.js 20+ (minimum Next.js 15: 18.18)
- npm 10+
- MySQL 8 atau MariaDB (proyek ini diuji dengan XAMPP MariaDB 10.4 di
  `127.0.0.1:3306`)
- Google Chrome terpasang (dipakai Playwright `channel: "chrome"`)

---

## 4. Menjalankan proyek

### 4.1 Siapkan database

Pastikan MySQL/MariaDB berjalan. Dengan XAMPP:

```powershell
# dari panel XAMPP: Start MySQL
# atau dari terminal:
C:\xampp\mysql\bin\mysqld.exe --defaults-file=C:\xampp\mysql\bin\my.ini --standalone
```

Buat database (jika belum ada):

```sql
CREATE DATABASE kursify CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 4.2 Konfigurasi environment

```powershell
Copy-Item .env.example .env
```

Sesuaikan isi `.env` bila perlu. Nilai default cocok untuk XAMPP tanpa password:

```env
DATABASE_URL="mysql://root@127.0.0.1:3306/kursify"
AUTH_SECRET="kursify-dev-secret-change-me-in-production-0123456789"
AUTH_TRUST_HOST="true"
CRON_SECRET="kursify-cron-secret"
NOTIFY_DRIVER="log"
FONNTE_TOKEN=""
UPLOAD_DIR="./uploads"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
SEED_PASSWORD="Kursify123!"
```

> Ganti `AUTH_SECRET` dan `CRON_SECRET` sebelum deploy.

### 4.3 Install, push schema, seed

```powershell
npm install
npm run db:push
npm run db:seed
```

Seeder membuat data demo: 6 siswa (4 aktif, 1 ditangguhkan, 1 pending), program,
kelas, sesi, tagihan, pembayaran, pengeluaran, rekap honor, dan satu sertifikat
demo (Fajar Nugroho).

### 4.4 Jalankan

```powershell
npm run dev
```

Buka <http://localhost:3000>.

Untuk produksi:

```powershell
npm run build
npm start
```

---

## 5. Akun demo

Semua akun memakai password `Kursify123!` (dapat diubah lewat `SEED_PASSWORD`
sebelum seed).

| Peran | Email | Halaman awal |
|---|---|---|
| Owner | `owner@kursify.id` | `/owner` |
| Admin | `admin@kursify.id` | `/admin` |
| Staf Keuangan | `keuangan@kursify.id` | `/keuangan` |
| Tutor | `tutor@kursify.id` | `/tutor` |
| Tutor kedua | `tutor2@kursify.id` | `/tutor` |

Data demo penting:

- Sertifikat Fajar Nugroho: `1/LKP.NC/X/2026`, program Bahasa Inggris Beginner.
- Rekap honor Oktober 2026: Sinta (per sesi) sudah dibayar + slip; Markus
  (bulanan) masih draft.
- Pengeluaran menunggu approval: Listrik Rp350.000 dan Air Rp120.000.
- Tagihan menunggak dan siswa ditangguhkan tersedia untuk menguji alur
  penagihan.

---

## 6. Script

| Perintah | Keterangan |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Build produksi |
| `npm start` | Jalankan hasil build |
| `npm run lint` | ESLint |
| `npm test` | Unit test Vitest |
| `npm run test:watch` | Vitest watch |
| `npm run test:e2e` | Playwright (butuh DB + seed + Chrome) |
| `npm run db:push` | Sinkronkan schema Prisma ke database |
| `npm run db:migrate` | Buat migration (opsional) |
| `npm run db:seed` | Jalankan seeder |
| `npm run db:studio` | Prisma Studio |

---

## 7. Struktur singkat

```
app/
  (public)/login, daftar, daftar/sukses, verifikasi/[token]
  (dashboard)/owner/*, admin/*, keuangan/*, tutor/*
  api/auth, api/upload, api/files/[...path]
  api/pdf/[type]/[id], api/export/[report], api/cron/[job]
components/        UI, layout, tabel, form
features/          form + server action per domain
lib/
  rules/           aturan bisnis murni (diuji Vitest)
  services/        logika transaksi database
  pdf/, reports/, notify/
prisma/schema.prisma, prisma/seed.ts
tests/unit, tests/e2e
docs/progress.md
```

---

## 8. Aturan bisnis penting

- **Nomor dokumen**
  - Siswa: `KSF-YYYY-NNNN`
  - Invoice: `INV/YYYY/MM/NNNN`
  - Kuitansi: `KWT/YYYY/MM/NNNN`
  - Slip honor: `SLIP/YYYY/MM/NNN`
  - Sertifikat: mengikuti `settings.kodeSertifikat` + urutan + bulan romawi.
- **Tagihan**: `total = nominal − potongan + denda`; tidak boleh negatif.
- **Pembayaran**: maksimal 2 pembayaran valid per tagihan; tidak boleh melebihi
  sisa; non-tunai wajib nomor referensi atau bukti.
- **SPP**: dibuat tanggal 1 untuk enrollment aktif program `spp_bulanan`, jatuh
  tempo tanggal 10, idempoten per siswa + kelas + periode.
- **Keterlambatan**: lewat jatuh tempo → `menunggak` + denda sekali; lebih dari
  14 hari → siswa `ditangguhkan`; pelunasan → aktif kembali.
- **Paket**: `hadir`/`alpa` mengurangi saldo 1; `izin`/`sakit` tidak; saldo 0
  memicu tagihan paket berikutnya (kecuali siswa ditangguhkan).
- **Absensi**: tutor dapat mengisi/mengubah dalam 24 jam setelah sesi; Admin
  dapat mengoreksi dengan alasan; Owner dapat mengoreksi sesi terkunci dengan
  alasan. Semua koreksi masuk audit log.
- **Honor**: hanya sesi `selesai` dengan tutor `hadir` atau tutor pengganti;
  sesi `dibatalkan` tidak dihitung. Pembayaran mengunci absensi periode.
- **Sertifikat**: semua materi memiliki nilai, rata-rata ≥ 70, kehadiran ≥ 75%,
  siswa aktif. Nilai 93/92/92/90 → 91,75 / A / Sangat Memuaskan.
- **Pengeluaran**: di atas Rp500.000 wajib disetujui Owner sebelum dibayar.
- **Penghapusan**: tabel transaksi tidak dihapus fisik; gunakan void/status
  dengan alasan dan jejak audit.

---

## 9. Dokumen PDF

Semua dokumen memakai kop dan identitas dari tabel `settings`.

| Jenis | URL | Parameter `id` |
|---|---|---|
| Kartu Siswa (QR) | `/api/pdf/kartu/{id}` | ID siswa |
| Kuitansi | `/api/pdf/kuitansi/{id}` | ID pembayaran |
| Slip Honor | `/api/pdf/slip/{id}` | ID rekap honor |
| Hasil Penilaian | `/api/pdf/penilaian/{id}` | ID enrollment |
| Sertifikat (QR) | `/api/pdf/sertifikat/{id}` | ID enrollment |
| Ekspor laporan | `/api/export/{report}?format=pdf\|xlsx` | — |

`report`: `absensi`, `honor`, `program`, `kritis`, `keuangan`. Filter opsional:
`periode=YYYY-MM`, `programId`, `classId`.

Hak akses ekspor:

- Owner: semua laporan.
- Admin: `absensi`, `program`.
- Staf Keuangan: `honor`, `kritis`, `keuangan`.
- Tutor: tidak memiliki akses ekspor; dapat mengunduh slip miliknya.

Kuitansi yang sudah di-void tetap dapat diunduh dan diberi tanda **VOID**
beserta alasannya. Void juga membuat entri kas keluar pembalik.

---

## 10. Upload berkas

- Berkas disimpan di `UPLOAD_DIR` (default `./uploads`), **di luar** `public/`.
- Hanya dapat diunduh melalui `/api/files/[...path]` yang memeriksa sesi/role.
- Form pendaftaran, pengeluaran, dan pembayaran memakai route
  `/api/upload` untuk menyimpan lampiran.

---

## 11. Job terjadwal

Endpoint: `GET|POST /api/cron/{job}` dengan header
`Authorization: Bearer $CRON_SECRET` atau `x-cron-secret`.

| Job | Fungsi | Jadwal Vercel (`vercel.json`, UTC) |
|---|---|---|
| `generate-spp` | Tagihan SPP bulan berjalan | `5 0 1 * *` |
| `generate-honor` | Draft honor bulan sebelumnya | `15 0 1 * *` |
| `overdue` | Menunggak, denda, penangguhan | `10 0 * * *` |
| `reminder` | H-3 tagihan + pengingat honor | `0 7 * * *` |
| `recurring` | Draft pengeluaran rutin H-3 | `0 7 * * *` |

Semua job idempoten. Untuk server sendiri, panggil dengan cron/crontab:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://domain-anda/api/cron/overdue
```

> Vercel Cron otomatis mengirim `Authorization: Bearer $CRON_SECRET` bila env
> tersebut tersedia.

---

## 12. Testing

### Unit test

```powershell
npm test
```

Menguji aturan murni di `lib/rules/*`: tagihan/pembayaran, absensi, honor,
penilaian, jadwal, tanggal, uang, format nomor dokumen, dan terbilang. Ada juga
satu tes konkurensi nomor urut yang memakai database (dilewati otomatis bila
database tidak tersedia). Saat ini **49 test** lulus.

### E2E test

Prasyarat: database berjalan, sudah di-seed, dan Chrome terpasang.

```powershell
npm run test:e2e
```

Cakupan: halaman publik, verifikasi sertifikat, dashboard per role, proteksi
route, seluruh dokumen PDF, ekspor PDF/Excel, dan hak akses ekspor. Playwright
menjalankan `npm run dev` otomatis (timeout 120 detik per test karena kompilasi
on-demand).

Jika Chrome tidak berada di lokasi standar, ubah `channel` di
`playwright.config.ts` atau install browser Playwright.

### Pemeriksaan akhir

```powershell
npm run lint
npx tsc --noEmit
npm test
npm run build
```

---

## 13. Catatan & batasan

- Notifikasi default `log` (tercatat di `notification_logs`). Untuk WhatsApp
  sungguhan, set `NOTIFY_DRIVER=fonnte` dan isi `FONNTE_TOKEN`.
- Belum ada payment gateway; pembayaran dicatat manual oleh Staf Keuangan.
- Penyimpanan berkas lokal; untuk produksi multi-instance gunakan storage
  bersama/S3-compatible.
- Aplikasi single-tenant (satu lembaga per instalasi).
- Route PDF/Excel memakai runtime Node.js (bukan Edge).
- Zona waktu tampilan dan perhitungan tanggal menggunakan Asia/Jakarta;
  tanggal kalender disimpan sebagai UTC midnight.
- Tidak ada hard delete pada tabel transaksi; koreksi memakai void/status dan
  audit log.
