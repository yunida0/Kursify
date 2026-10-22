# Progress Pembangunan Kursify

Dokumen ini mencatat status implementasi tiap fase, keputusan teknis, hasil
pengujian, dan catatan lanjutan. Spesifikasi acuan:
`kursify-spesifikasi-sistem.md` (bagian 6, 9, 12, dan 14).

Status akhir: **selesai (fase 0–8)**, seluruh gerbang kualitas lulus.

---

## Ringkasan status

| Fase | Status | Ringkasan |
|---|---|---|
| 0. Fondasi | ✅ | Next.js 15 + TypeScript + Tailwind, Prisma/MySQL, Auth.js, role guard, layout, audit, numbering, seed |
| 1. Data Master | ✅ | Program + materi, ruangan, tutor + akun, tarif honor, kelas + jadwal + generate sesi, deteksi bentrok |
| 2. Siswa & Pendaftaran | ✅ | Form publik + upload, pendaftar, verifikasi, tagihan pendaftaran, aktivasi, kartu QR, kuota kelas |
| 3. Absensi | ✅ | Sesi hari ini, check-in, H/I/S/A, scan QR, saldo paket, batas 24 jam, koreksi, batal + sesi pengganti, alpa 3× |
| 4. Pemasukan | ✅ | Tagihan, pembayaran maks. 2 cicilan, kuitansi, void, potongan, buku kas, job SPP/reminder/overdue, tagihan paket otomatis |
| 5. Pengeluaran & Honor | ✅ | Pengeluaran + nota, approval Rp500.000, rutin, draft honor, review/bayar, slip, kunci absensi, kas keluar |
| 6. Nilai & Sertifikat | ✅ | Input nilai, rata-rata/huruf/predikat, kelayakan, sertifikat + QR, verifikasi publik, Hasil Penilaian |
| 7. Laporan & Dashboard | ✅ | 5 laporan + filter, ekspor PDF/Excel, dashboard per role, audit log, buku kas |
| 8. Notifikasi & Rapikan | ✅ | Driver log/Fonnte, template notifikasi, `notification_logs`, cron Vercel, responsif, README |

---

## Fase 0 — Fondasi

- Next.js 15 App Router, React 19, TypeScript `strict`, Tailwind CSS 3.
- Prisma 6 + MySQL/MariaDB. Seluruh tabel spesifikasi bagian 6 dibuat di
  `prisma/schema.prisma`, termasuk `counters`, `audit_logs`, `notification_logs`,
  `cash_ledger`, dan relasi transaksi.
- Auth.js v5 Credentials + bcrypt, sesi JWT berisi `role` dan `tutorId`.
- `middleware.ts` + `lib/guard.ts`:
  - `/owner` hanya owner.
  - `/admin` owner + admin.
  - `/keuangan` owner + keuangan.
  - `/tutor` owner + tutor.
  - API/route handler memeriksa role ulang.
- Layout dashboard dengan sidebar navy, menu per role, topbar, logout.
- `lib/audit.ts`, `lib/numbering.ts`, `lib/money.ts`, `lib/terbilang.ts`,
  `lib/dates.ts` (Asia/Jakarta).
- Halaman pengaturan lembaga, pengguna, audit log.
- Seed data demo lengkap.

Catatan penting:
- Nomor urut memakai tabel `counters` + `SELECT ... FOR UPDATE`. Implementasi
  awal memakai `upsert` Prisma dan terbukti gagal P2002 saat 25 transaksi
  paralel; sudah diganti dengan `INSERT ... ON DUPLICATE KEY UPDATE` yang
  atomik. Regresi diuji di `tests/unit/numbering-concurrency.test.ts`.
- Status berupa string terkontrol (bukan enum Prisma) agar mudah mengikuti
  spesifikasi; uang memakai `Int` rupiah.
- Tanggal kalender dinormalisasi ke UTC tengah malam; tampilan waktu memakai
  WIB.

---

## Fase 1 — Data Master

- Program + materi (CRUD), termasuk skema tagihan `spp_bulanan`/`paket`,
  biaya pendaftaran, tarif, jumlah pertemuan paket, level.
- Ruangan (CRUD).
- Tutor: data + akun login opsional, status aktif/cuti/nonaktif, tanpa tarif di
  halaman Admin.
- Tarif honor per tutor (Owner): `per_sesi` / `bulanan_tetap`, berlaku mulai
  bulan tertentu.
- Kelas: CRUD, jadwal rutin, generate seluruh sesi, validasi kuota, validasi
  bentrok ruangan/tutor (termasuk sesi non-rutin).
- Halaman sesi: daftar/filter, detail, batal sesi + sesi pengganti.

Validasi bentrok memakai `lib/rules/schedule.ts` dan diuji unit.

---

## Fase 2 — Siswa & Pendaftaran

- `/daftar`: form publik bertahap, pilihan program, data wali wajib untuk
  usia < 17, upload berkas.
- Pendaftaran membuat siswa `pending` + tagihan pendaftaran; nomor induk belum
  terbit.
- Admin: daftar pendaftar, verifikasi, aktivasi.
- Aktivasi mensyaratkan tagihan pendaftaran `lunas`, memilih kelas, lalu:
  - menerbitkan `studentCode` `KSF-YYYY-NNNN` + `qrToken`;
  - membuat enrollment;
  - menerbitkan tagihan pertama (SPP atau paket);
  - mencatat audit + notifikasi.
- Kartu Siswa PDF dengan QR.
- Penempatan siswa ke kelas dengan validasi kuota, status siswa, dan duplikasi.
- Detail siswa: profil, kelas, tagihan, absensi, dokumen, aksi status.
- Ubah status siswa: aktif/ditangguhkan/nonaktif + alasan.

---

## Fase 3 — Absensi

- Dashboard tutor: sesi hari ini, buka sesi (check-in).
- Form absensi H/I/S/A, "Semua Hadir", scan QR kamera (`html5-qrcode`).
- Simpan absensi:
  - sesi menjadi `selesai`;
  - menyimpan absensi tutor (hadir/digantikan/tidak hadir);
  - tutor pengganti wajib dan harus aktif;
  - mencatat audit per perubahan.
- Saldo paket:
  - `hadir`/`alpa` −1;
  - `izin`/`sakit` 0;
  - perubahan status mengoreksi delta dengan benar;
  - saldo 0 memicu tagihan paket berikutnya bila tidak ada tagihan paket
    outstanding dan siswa tidak ditangguhkan.
- Batas edit:
  - tutor hanya dalam 24 jam setelah sesi berakhir;
  - admin/owner di luar 24 jam wajib alasan;
  - sesi terkunci hanya owner, wajib alasan.
- Deteksi 3 alpa berturut-turut → `notification_logs` (template `alpa_3x`).
- Batal sesi + buat sesi pengganti dengan validasi bentrok.

---

## Fase 4 — Pemasukan

- Tagihan: pendaftaran, SPP, paket, lain-lain; filter dan pagination server.
- Pembayaran:
  - maksimal 2 pembayaran valid per tagihan;
  - tidak boleh melebihi sisa;
  - row lock `SELECT ... FOR UPDATE` pada invoice;
  - metode tunai/transfer/QRIS, referensi/bukti wajib untuk non-tunai;
  - kuitansi bernomor `KWT/YYYY/MM/NNNN`;
  - entri buku kas masuk.
- Void pembayaran:
  - status pembayaran `void`, kuitansi tetap ada dan PDF bertanda VOID;
  - entri kas keluar pembalik;
  - status tagihan dihitung ulang.
- Potongan/beasiswa dan koreksi denda hanya Owner, dengan alasan + audit.
- Job:
  - `generate-spp` idempoten per siswa + kelas + periode;
  - `sendDueReminders` H-3;
  - `runOverdueInvoices` menandai menunggak, menambah denda sekali, dan
    menangguhkan siswa setelah melewati batas hari.
- Perbaikan penting: penangguhan kini memeriksa seluruh tagihan yang sudah
  menunggak setiap hari, bukan hanya tagihan yang berubah status pada hari itu.
  Tanpa perbaikan ini, siswa yang menunggak sejak lama tidak pernah otomatis
  ditangguhkan saat melewati hari ke-14.
- Pelunasan memulihkan siswa `ditangguhkan` → `aktif`.

---

## Fase 5 — Pengeluaran & Honor

- Kategori pengeluaran, input pengeluaran + nota, daftar/filter.
- Batas persetujuan Rp500.000:
  - ≤ batas boleh langsung dibayar Staf Keuangan;
  - > batas wajib `disetujui` Owner sebelum `dibayar`.
- Pengeluaran rutin + job `recurring` (draft H-3, idempoten per periode).
- Rekap honor:
  - draft per tutor per periode;
  - hanya sesi `selesai` dengan tutor `hadir` atau tutor pengganti;
  - sesi `dibatalkan` tidak dihitung;
  - tarif dipilih dari skema yang berlaku pada periode.
- Review Staf Keuangan → approval Owner bila perlu → bayar.
- Pembayaran honor:
  - slip bernomor `SLIP/YYYY/MM/NNN`;
  - pengeluaran kategori Honor Tutor + kas keluar;
  - sesi periode dikunci (`locked`);
  - notifikasi ke tutor.
- Slip PDF berisi periode, sesi per kelas, tarif, total, tanggal bayar.

---

## Fase 6 — Nilai & Sertifikat

- Tutor input nilai per materi (0–100) untuk kelas yang diampu.
- Nilai dikunci setelah sertifikat terbit.
- Rata-rata 2 desimal, huruf A/B/C/D/E, predikat:
  - ≥ 90 A Sangat Memuaskan;
  - 80–89,99 B Memuaskan;
  - 70–79,99 C Cukup;
  - 40–69,99 D Kurang;
  - < 40 E Tidak Lulus.
- Kelayakan sertifikat: nilai lengkap, rata-rata ≥ 70, kehadiran ≥ 75%, siswa
  aktif (bukan ditangguhkan).
- Sertifikat + QR verifikasi; halaman publik `/verifikasi/{token}` menampilkan
  nama, program, nomor, dan tanggal terbit.
- Hasil Penilaian PDF per enrollment.
- Contoh seed: 93/92/92/90 → 91,75 / A / Sangat Memuaskan.

---

## Fase 7 — Laporan & Dashboard

Laporan wajib:
1. Rekap absensi siswa (H/I/S/A, persentase, penanda di bawah minimum).
2. Absensi & honor tutor per periode.
3. Program terpopuler (siswa aktif, kelas, kuota, keterisian).
4. Siswa kritis (tunggakan > 30 hari).
5. Laporan keuangan (saldo awal, pemasukan, pengeluaran, saldo akhir per akun).

- Filter periode/program/kelas.
- Ekspor PDF dan Excel (`exceljs`) dengan kop lembaga.
- Dashboard Owner/Admin/Keuangan/Tutor memakai data yang sama dengan laporan.
- Buku kas menampilkan saldo per akun dan seluruh mutasi.
- Audit log dengan filter dan detail before/after.

Catatan:
- Total pemasukan/pengeluaran laporan keuangan diambil dari `cash_ledger`,
  sehingga konsisten dengan buku kas, termasuk entri pembalik void.
- Rincian pemasukan per jenis tagihan dan pengeluaran per kategori disajikan
  sebagai analisis pelengkap.

---

## Fase 8 — Notifikasi & Penyelesaian

- `NotificationChannel` dengan driver:
  - `log` (default, menulis `notification_logs`);
  - `fonnte` (WhatsApp via HTTP, token env).
- Template notifikasi: tagihan terbit, pengingat H-3, menunggak, pembayaran
  diterima, aktivasi, alpa 3×, honor dibayar, pengeluaran rutin, pengingat honor.
- Endpoint cron `GET|POST /api/cron/{job}` dengan `CRON_SECRET`.
- `vercel.json` berisi 5 cron.
- Tampilan responsif, khususnya halaman tutor.
- README setup, akun demo, endpoint, cron, dan testing.
- Pembersihan lint hingga **0 warning**.

---

## Pengujian

### Unit test (`npm test`)

8 file, **49 test** lulus:

| File | Cakupan |
|---|---|
| `invoice.test.ts` | total, status, 2 cicilan, denda, penangguhan, progres |
| `attendance.test.ts` | batas 24 jam, lock, saldo paket, alpa beruntun, persentase |
| `payroll.test.ts` | tarif per periode, sesi eligible, pengganti, bulanan |
| `grading.test.ts` | rata-rata 91,75, huruf/predikat, kelayakan, format nilai |
| `schedule.test.ts` | overlap, konflik ruangan/tutor, generate tanggal sesi |
| `dates.test.ts` | WIB, normalisasi tanggal, rentang bulan, rupiah |
| `numbering.test.ts` | format KSF/INV/KWT/SLIP/TTR/sertifikat, terbilang |
| `numbering-concurrency.test.ts` | 25 transaksi paralel → nomor 1–25 tanpa duplikat |

### E2E test (`npm run test:e2e`)

9 test Playwright lulus:

- Halaman publik `/daftar` dan `/verifikasi`.
- Verifikasi sertifikat demo lewat token.
- Dashboard Owner + honor + buku kas + laporan + persetujuan.
- Dashboard Keuangan + honor + buku kas + laporan.
- Proteksi route: Keuangan tidak bisa membuka `/owner/pengguna`.
- Dashboard Tutor + kelas + nilai + honor.
- Semua dokumen PDF: kartu, kuitansi, slip, penilaian, sertifikat.
- Ekspor laporan keuangan PDF + Excel.
- Hak akses ekspor per role.

### Gerbang kualitas

| Perintah | Hasil |
|---|---|
| `npm run lint` | ✅ 0 warning/error |
| `npx tsc --noEmit` | ✅ lulus |
| `npm test` | ✅ 49 test |
| `npm run test:e2e` | ✅ 9 test |
| `npm run build` | ✅ lulus |

---

## Matriks skenario uji bagian 12

| # | Skenario | Status | Bukti/implementasi |
|---|---|---|---|
| 1 | Daftar → pending → bayar pendaftaran → aktivasi → KSF/QR/kelas/tagihan pertama | ✅ | `registerStudent`, `activateStudent`, form publik, unit + E2E role |
| 2 | Kelas 15 siswa → pendaftaran ke-16 ditolak | ✅ | cek kuota di `enrollStudent` dan `activateStudent` |
| 3 | Jadwal bentrok ruangan/tutor ditolak | ✅ | `findConflicts`, `detectClassConflicts`, unit test |
| 4 | Absensi hari ini → selesai; saldo paket H/A −1, I/S tetap | ✅ | `saveAttendance`, unit test |
| 5 | Saldo 0 → tagihan paket berikutnya otomatis | ✅ | `createNextPackageInvoiceTx`, idempoten |
| 6 | Tutor > 24 jam ditolak; Admin dengan alasan + audit | ✅ | `canEditAttendance`, unit test |
| 7 | Alpa 3× berturut → notifikasi tercatat | ✅ | `trailingAbsences` + `sendNotification` |
| 8 | SPP 300rb dibayar 100rb + 200rb → lunas; ke-3/kelebihan ditolak | ✅ | `canAcceptPayment`, row lock, unit test |
| 9 | Tanggal 11 menunggak + denda; hari ke-15 ditangguhkan; lunas → aktif | ✅ | `runOverdueInvoices`, `syncStudentSuspensionTx`, unit test |
| 10 | Void → kuitansi VOID, kas pembalik, status dihitung ulang | ✅ | `voidPayment`, `KuitansiDocument`, E2E PDF |
| 11 | 400rb langsung bayar; 600rb perlu approval Owner | ✅ | `createExpense`, `payExpense`, halaman persetujuan |
| 12 | Honor 14 sesi × tarif; batal tidak dihitung; pengganti masuk | ✅ | `calculatePayroll`, `eligibleSessionsForTutor`, unit test |
| 13 | Honor dibayar → slip + absensi terkunci; owner bisa audit | ✅ | `payPayroll`, `canEditAttendance`, slip PDF |
| 14 | Nilai 93/92/92/90 → 91,75/A/Sangat Memuaskan + sertifikat QR | ✅ | unit grading, seed Fajar, verifikasi E2E |
| 15 | Kehadiran 70% / ditangguhkan → sertifikat ditolak | ✅ | `canIssueCertificate`, unit test |
| 16 | Laporan keuangan sesuai buku kas, ekspor PDF + Excel | ✅ | `financialReport`, E2E ekspor |

---

## Catatan lanjutan (opsional)

- Notifikasi WhatsApp memakai driver `log` secara default; produksi perlu
  `FONNTE_TOKEN`.
- Belum ada payment gateway dan integrasi S3; pembayaran dicatat manual dan
  berkas disimpan lokal.
- Skema saat ini memakai `prisma db push`; untuk produksi disarankan membuat
  migration (`npm run db:migrate`) dan backup rutin.
- Job cron di `vercel.json` memakai UTC; sesuaikan bila deploy di server dengan
  zona waktu berbeda.
- Nilai minimum kelulusan (70) dan kehadiran (75) dapat diubah lewat
  `settings`, bukan hard-code di UI.
