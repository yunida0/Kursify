/**
 * Seeder Kursify — data demo lengkap untuk LKP Nida Course.
 * Jalankan: npm run db:seed
 *
 * Alur seed meniru alur nyata: pendaftaran → pembayaran → aktivasi → kelas →
 * absensi → nilai → sertifikat → honor → pengeluaran → job penunggakan.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, monthKey, previousMonthKey, wibTodayStr } from "@/lib/dates";
import { createClass } from "@/lib/services/classes";
import { registerStudent, activateStudent } from "@/lib/services/students";
import { recordPayment } from "@/lib/services/payments";
import { saveAttendance } from "@/lib/services/sessions";
import { issueCertificate, saveGrades } from "@/lib/services/grades";
import { generatePayrollDrafts, payPayroll, reviewPayroll } from "@/lib/services/payroll";
import { approveExpense, createExpense, payExpense } from "@/lib/services/expenses";
import { applyDiscount, generateSppForMonth, runOverdueInvoices } from "@/lib/services/invoices";

const prisma = new PrismaClient();

const PASSWORD = process.env.SEED_PASSWORD ?? "Kursify123!";

function day(offset: number): string {
  return wibTodayStr(addDays(new Date(), offset));
}

async function wipe() {
  console.log("• Menghapus data lama...");
  await prisma.notificationLog.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.cashLedger.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.discount.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.certificate.deleteMany();
  await prisma.tutorPayrollItem.deleteMany();
  await prisma.tutorPayroll.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.recurringExpense.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.studentAttendance.deleteMany();
  await prisma.tutorAttendance.deleteMany();
  await prisma.session.deleteMany();
  await prisma.classSchedule.deleteMany();
  await prisma.courseClass.deleteMany();
  await prisma.material.deleteMany();
  await prisma.program.deleteMany();
  await prisma.tutorFeeScheme.deleteMany();
  await prisma.tutor.deleteMany();
  await prisma.room.deleteMany();
  await prisma.studentDocument.deleteMany();
  await prisma.student.deleteMany();
  await prisma.expenseCategory.deleteMany();
  await prisma.user.deleteMany();
  await prisma.counter.deleteMany();
  await prisma.setting.deleteMany();
}

async function main() {
  console.log("🌱 Seeder Kursify dimulai...");
  await wipe();

  // ─── Pengaturan lembaga ────────────────────────────────────────────────
  await prisma.setting.create({
    data: {
      id: 1,
      namaLembaga: "LKP Nida Course",
      alamat: "Jl. Melati No. 12, Bandung, Jawa Barat",
      telepon: "022-1234567",
      email: "info@nidacourse.id",
      kodeSiswa: "KSF",
      kodeSertifikat: "LKP.NC",
      namaDirektur: "Nida Rahmawati",
    },
  });

  // ─── Pengguna ──────────────────────────────────────────────────────────
  const hash = await bcrypt.hash(PASSWORD, 10);
  const owner = await prisma.user.create({
    data: { name: "Nida Rahmawati", email: "owner@kursify.id", password: hash, role: "owner" },
  });
  const admin = await prisma.user.create({
    data: { name: "Rani Pertiwi", email: "admin@kursify.id", password: hash, role: "admin" },
  });
  const keuangan = await prisma.user.create({
    data: { name: "Budi Santoso", email: "keuangan@kursify.id", password: hash, role: "keuangan" },
  });

  // ─── Kategori pengeluaran ──────────────────────────────────────────────
  const kategori = async (nama: string, parentId?: string) =>
    prisma.expenseCategory.create({ data: { nama, parentId } });
  await Promise.all([
    kategori("Honor Tutor"),
    kategori("Gaji Staf"),
    kategori("Sewa Tempat"),
    kategori("Perlengkapan & ATK"),
    kategori("Pemasaran"),
    kategori("Perawatan"),
    kategori("Lain-lain"),
  ]);
  const utilities = await kategori("Utilitas");
  const listrik = await kategori("Listrik", utilities.id);
  const air = await kategori("Air", utilities.id);
  await kategori("Internet", utilities.id);

  // ─── Program + materi ──────────────────────────────────────────────────
  const kap = await prisma.program.create({
    data: {
      kode: "KAP",
      nama: "Komputer Aplikasi Perkantoran",
      level: "Dasar",
      biayaPendaftaran: 100_000,
      skemaTagihan: "paket",
      tarif: 700_000,
      jumlahPertemuanPaket: 10,
      materials: {
        create: [
          { nama: "Microsoft Word", urutan: 1 },
          { nama: "Microsoft Excel", urutan: 2 },
          { nama: "Microsoft PowerPoint", urutan: 3 },
          { nama: "Pengenalan Internet", urutan: 4 },
        ],
      },
    },
    include: { materials: { orderBy: { urutan: "asc" } } },
  });
  const eng = await prisma.program.create({
    data: {
      kode: "ENG-B1",
      nama: "Bahasa Inggris Beginner",
      level: "Beginner",
      biayaPendaftaran: 100_000,
      skemaTagihan: "spp_bulanan",
      tarif: 300_000,
      materials: {
        create: [
          { nama: "Listening", urutan: 1 },
          { nama: "Speaking", urutan: 2 },
          { nama: "Reading", urutan: 3 },
          { nama: "Writing", urutan: 4 },
        ],
      },
    },
    include: { materials: { orderBy: { urutan: "asc" } } },
  });

  // ─── Ruangan ───────────────────────────────────────────────────────────
  const ruangKomputer = await prisma.room.create({
    data: { nama: "Ruang Komputer", kapasitas: 15 },
  });
  const ruangBahasa = await prisma.room.create({ data: { nama: "Ruang Bahasa", kapasitas: 12 } });

  // ─── Tutor + akun login + tarif honor ──────────────────────────────────
  const tutorUser1 = await prisma.user.create({
    data: { name: "Sinta Ayu", email: "tutor@kursify.id", password: hash, role: "tutor" },
  });
  const tutorUser2 = await prisma.user.create({
    data: { name: "Markus Pratama", email: "tutor2@kursify.id", password: hash, role: "tutor" },
  });
  const tutor1 = await prisma.tutor.create({
    data: {
      userId: tutorUser1.id,
      tutorCode: "TTR-001",
      nama: "Sinta Ayu",
      noWa: "081234567001",
      email: "tutor@kursify.id",
      keahlian: "Komputer & Aplikasi Perkantoran",
      status: "aktif",
    },
  });
  const tutor2 = await prisma.tutor.create({
    data: {
      userId: tutorUser2.id,
      tutorCode: "TTR-002",
      nama: "Markus Pratama",
      noWa: "081234567002",
      email: "tutor2@kursify.id",
      keahlian: "Bahasa Inggris",
      status: "aktif",
    },
  });
  const fixedPrev = previousMonthKey();
  await prisma.tutorFeeScheme.createMany({
    data: [
      { tutorId: tutor1.id, skema: "per_pertemuan", tarif: 50_000, berlakuMulai: fixedPrev, setBy: owner.id },
      { tutorId: tutor2.id, skema: "bulanan_tetap", tarif: 1_000_000, berlakuMulai: fixedPrev, setBy: owner.id },
    ],
  });

  // ─── Kelas + jadwal rutin (sesi otomatis) ──────────────────────────────
  console.log("• Membuat kelas dan sesi...");
  const kelasKap = await createClass({
    programId: kap.id,
    tutorId: tutor1.id,
    roomId: ruangKomputer.id,
    jenis: "reguler",
    kuota: 15,
    tanggalMulai: day(-42),
    tanggalSelesai: day(28),
    schedules: [
      { hari: 2, jamMulai: "15:00", jamSelesai: "17:00" },
      { hari: 4, jamMulai: "15:00", jamSelesai: "17:00" },
    ],
    userId: admin.id,
  });
  const kelasEng = await createClass({
    programId: eng.id,
    tutorId: tutor2.id,
    roomId: ruangBahasa.id,
    jenis: "reguler",
    kuota: 12,
    tanggalMulai: day(-28),
    tanggalSelesai: day(42),
    schedules: [
      { hari: 1, jamMulai: "09:00", jamSelesai: "11:00" },
      { hari: 3, jamMulai: "09:00", jamSelesai: "11:00" },
    ],
    userId: admin.id,
  });

  // ─── Siswa: pendaftaran → pembayaran → aktivasi ───────────────────────
  console.log("• Mendaftarkan siswa demo...");
  const reg = {
    s1: await registerStudent({
      nama: "Aditya Pratama", noWa: "081300000001", email: "aditya@example.com",
      tempatLahir: "Bandung", tanggalLahir: "2005-04-12", jenisKelamin: "L",
      alamat: "Jl. Kenanga No. 3, Bandung", programId: kap.id,
    }),
    s2: await registerStudent({
      nama: "Bella Safitri", noWa: "081300000002",
      tempatLahir: "Cimahi", tanggalLahir: "2006-08-20", jenisKelamin: "P",
      alamat: "Jl. Anggrek No. 8, Cimahi", programId: kap.id,
    }),
    s3: await registerStudent({
      nama: "Citra Lestari", noWa: "081300000003",
      tempatLahir: "Bandung", tanggalLahir: "2010-02-15", jenisKelamin: "P",
      alamat: "Jl. Mawar No. 21, Bandung", programId: eng.id,
      namaWali: "Dewi Lestari", noWaWali: "081300000013",
    }),
    s4: await registerStudent({
      nama: "Dimas Anggara", noWa: "081300000004",
      tempatLahir: "Sumedang", tanggalLahir: "2004-11-30", jenisKelamin: "L",
      alamat: "Jl. Dahlia No. 5, Sumedang", programId: eng.id,
    }),
    s5: await registerStudent({
      nama: "Eka Wijaya", noWa: "081300000005",
      tempatLahir: "Garut", tanggalLahir: "2003-06-18", jenisKelamin: "L",
      alamat: "Jl. Flamboyan No. 14, Garut", programId: kap.id,
    }),
    s6: await registerStudent({
      nama: "Fajar Nugroho", noWa: "081300000006", email: "fajar@example.com",
      tempatLahir: "Bandung", tanggalLahir: "2002-01-25", jenisKelamin: "L",
      alamat: "Jl. Cendana No. 9, Bandung", programId: eng.id,
    }),
  };

  let refCounter = 0;
  const pay = async (invoiceId: string, nominal: number, metode: "tunai" | "transfer" | "qris", tanggal: string) =>
    recordPayment({
      invoiceId,
      nominal,
      metode,
      tanggal,
      userId: keuangan.id,
      noReferensi: metode === "tunai" ? null : `REF-${String(++refCounter).padStart(4, "0")}`,
    });

  console.log("• Membayar biaya pendaftaran dan mengaktivasi siswa...");
  await pay(reg.s1.invoice.id, 100_000, "tunai", day(-40));
  await activateStudent({ studentId: reg.s1.student.id, classId: kelasKap.kelas.id, userId: admin.id });
  await pay(reg.s2.invoice.id, 100_000, "transfer", day(-30));
  await activateStudent({ studentId: reg.s2.student.id, classId: kelasKap.kelas.id, userId: admin.id });
  await pay(reg.s3.invoice.id, 100_000, "tunai", day(-26));
  await activateStudent({ studentId: reg.s3.student.id, classId: kelasEng.kelas.id, userId: admin.id });
  await pay(reg.s4.invoice.id, 100_000, "qris", day(-26));
  await activateStudent({ studentId: reg.s4.student.id, classId: kelasEng.kelas.id, userId: admin.id });
  await pay(reg.s6.invoice.id, 100_000, "tunai", day(-25));
  await activateStudent({ studentId: reg.s6.student.id, classId: kelasEng.kelas.id, userId: admin.id });
  // s5 sengaja dibiarkan pending (tagihan pendaftaran belum dibayar)

  // ─── Tagihan paket & SPP + cicilan ─────────────────────────────────────
  console.log("• Membuat pembayaran tagihan kursus...");
  // Paket pertama Aditya (Rp700.000) dibayar 2× cicilan
  const paketS1 = await prisma.invoice.findFirst({
    where: { studentId: reg.s1.student.id, jenis: "paket", status: { not: "void" } },
    orderBy: { createdAt: "asc" },
  });
  if (paketS1) {
    await pay(paketS1.id, 300_000, "tunai", day(-35));
    await pay(paketS1.id, 400_000, "transfer", day(-20));
  }
  // Bella: paket belum dibayar + potongan saudara dari Owner
  const paketS2 = await prisma.invoice.findFirst({
    where: { studentId: reg.s2.student.id, jenis: "paket", status: { not: "void" } },
    orderBy: { createdAt: "asc" },
  });
  if (paketS2) {
    await applyDiscount({
      invoiceId: paketS2.id,
      jenis: "saudara",
      nominal: 50_000,
      alasan: "Diskon saudara kandung siswa lain",
      ownerId: owner.id,
    });
  }
  // SPP: September & Oktober untuk kelas Bahasa Inggris
  await generateSppForMonth(fixedPrev, keuangan.id);
  const sppS3 = await prisma.invoice.findMany({
    where: { studentId: reg.s3.student.id, jenis: "spp", status: { not: "void" } },
    orderBy: { periode: "asc" },
  });
  for (const inv of sppS3) {
    if (inv.status !== "lunas") await pay(inv.id, inv.total, "transfer", day(-15));
  }
  // Fajar: SPP September dilunasi agar tetap aktif untuk demo sertifikat.
  // SPP Oktober miliknya tetap terbuka sebagai contoh tagihan berjalan.
  const sppS6 = await prisma.invoice.findFirst({
    where: { studentId: reg.s6.student.id, jenis: "spp", periode: fixedPrev, status: { not: "void" } },
  });
  if (sppS6 && sppS6.status !== "lunas") {
    await pay(sppS6.id, sppS6.total, "transfer", day(-12));
  }
  // Dimas: SPP September sengaja belum dibayar — dibuat dengan tanggal lampau
  // agar job penunggakan (denda + penangguhan) dapat didemonstrasikan.
  const sppS4 = await prisma.invoice.findFirst({
    where: { studentId: reg.s4.student.id, jenis: "spp", periode: fixedPrev, status: { not: "void" } },
  });
  if (sppS4) {
    await prisma.invoice.update({
      where: { id: sppS4.id },
      data: { status: "belum_dibayar", menunggakSejak: null, denda: 0, total: sppS4.nominal - sppS4.potongan },
    });
  }

  // ─── Absensi seluruh sesi lampau (ditandai selesai) ────────────────────
  console.log("• Mengisi absensi sesi lampau...");
  const today = day(0);
  const sessionsKap = await prisma.session.findMany({
    where: { classId: kelasKap.kelas.id, tanggal: { lt: new Date(`${today}T00:00:00.000Z`) } },
    orderBy: { tanggal: "asc" },
  });
  const sessionsEng = await prisma.session.findMany({
    where: { classId: kelasEng.kelas.id, tanggal: { lt: new Date(`${today}T00:00:00.000Z`) } },
    orderBy: { tanggal: "asc" },
  });
  const enrollKap = await prisma.enrollment.findMany({ where: { classId: kelasKap.kelas.id } });
  const enrollEng = await prisma.enrollment.findMany({ where: { classId: kelasEng.kelas.id } });
  const enKapS1 = enrollKap.find((e) => e.studentId === reg.s1.student.id);
  const enKapS2 = enrollKap.find((e) => e.studentId === reg.s2.student.id);
  const enEngS3 = enrollEng.find((e) => e.studentId === reg.s3.student.id);
  const enEngS4 = enrollEng.find((e) => e.studentId === reg.s4.student.id);
  const enEngS6 = enrollEng.find((e) => e.studentId === reg.s6.student.id);

  type Att = "hadir" | "izin" | "sakit" | "alpa";
  const s1Pattern: Att[] = ["hadir", "hadir", "hadir", "izin", "hadir", "hadir", "hadir", "sakit", "hadir", "hadir", "hadir", "hadir"];
  const s2Pattern: Att[] = ["hadir", "hadir", "izin", "hadir", "hadir", "hadir", "hadir", "izin", "hadir", "hadir", "hadir", "hadir"];
  const s3Pattern: Att[] = ["hadir", "hadir", "izin", "hadir", "hadir", "sakit", "hadir", "hadir"];
  const s4Pattern: Att[] = ["hadir", "izin", "hadir", "hadir", "alpa", "hadir", "hadir", "sakit"];

  const mark = async (
    sessionId: string,
    entries: { studentId: string; status: Att }[],
  ) =>
    saveAttendance({
      sessionId,
      entries,
      userId: admin.id,
      role: "admin",
      tutorStatus: "hadir",
      reason: "Pengisian data seed",
    });

  for (let i = 0; i < sessionsKap.length; i++) {
    const entries: { studentId: string; status: Att }[] = [];
    if (enKapS1) entries.push({ studentId: enKapS1.studentId, status: s1Pattern[i % s1Pattern.length] });
    if (enKapS2) entries.push({ studentId: enKapS2.studentId, status: s2Pattern[i % s2Pattern.length] });
    await mark(sessionsKap[i].id, entries);
  }
  for (let i = 0; i < sessionsEng.length; i++) {
    const entries: { studentId: string; status: Att }[] = [];
    if (enEngS3) entries.push({ studentId: enEngS3.studentId, status: s3Pattern[i % s3Pattern.length] });
    if (enEngS4) entries.push({ studentId: enEngS4.studentId, status: s4Pattern[i % s4Pattern.length] });
    if (enEngS6) entries.push({ studentId: enEngS6.studentId, status: "hadir" });
    await mark(sessionsEng[i].id, entries);
  }

  // ─── Nilai final test + sertifikat ─────────────────────────────────────
  console.log("• Menginput nilai final test dan menerbitkan sertifikat...");
  if (enEngS6) {
    const nilai = [93, 92, 92, 90];
    await saveGrades({
      classId: kelasEng.kelas.id,
      entries: eng.materials.map((m, i) => ({
        enrollmentId: enEngS6.id,
        materialId: m.id,
        nilai: nilai[i],
        tanggalTest: day(-2),
      })),
      userId: admin.id,
      role: "admin",
    });
    await issueCertificate({ enrollmentId: enEngS6.id, userId: admin.id });
  }
  if (enEngS3) {
    await saveGrades({
      classId: kelasEng.kelas.id,
      entries: eng.materials.slice(0, 2).map((m, i) => ({
        enrollmentId: enEngS3.id,
        materialId: m.id,
        nilai: 78 + i * 2,
        tanggalTest: day(-2),
      })),
      userId: admin.id,
      role: "admin",
    });
  }

  // ─── Honor tutor ───────────────────────────────────────────────────────
  console.log("• Menghitung honor tutor...");
  const payrolls = await generatePayrollDrafts(monthKey(), keuangan.id);
  const payrollTutor1 = await prisma.tutorPayroll.findFirst({
    where: { tutorId: tutor1.id, periode: monthKey() },
  });
  if (payrollTutor1) {
    await reviewPayroll({ payrollId: payrollTutor1.id, userId: keuangan.id });
    await payPayroll({ payrollId: payrollTutor1.id, userId: keuangan.id, role: "keuangan" });
  }
  // payroll tutor2 sengaja dibiarkan draft untuk demo alur review

  // ─── Pengeluaran ───────────────────────────────────────────────────────
  console.log("• Mencatat pengeluaran...");
  const katATK = await prisma.expenseCategory.findFirst({ where: { nama: "Perlengkapan & ATK" } });
  const katSewa = await prisma.expenseCategory.findFirst({ where: { nama: "Sewa Tempat" } });
  if (katATK) {
    await createExpense({
      tanggal: day(-6), categoryId: katATK.id, nominal: 150_000,
      penerima: "Toko Alat Tulis Jaya", sumberDana: "kas_tunai",
      keterangan: "ATK dan tinta printer", userId: keuangan.id, langsungBayar: true,
    });
  }
  if (katSewa) {
    const sewa = await createExpense({
      tanggal: day(-3), categoryId: katSewa.id, nominal: 900_000,
      penerima: "Pemilik Gedung", sumberDana: "rekening_bank",
      keterangan: "Sewa tempat bulan ini", userId: keuangan.id,
    });
    await approveExpense({ expenseId: sewa.id, ownerId: owner.id });
    await payExpense({ expenseId: sewa.id, userId: keuangan.id });
  }
  if (listrik) {
    await createExpense({
      tanggal: day(0), categoryId: listrik.id, nominal: 350_000,
      penerima: "PLN", sumberDana: "rekening_bank",
      keterangan: "Tagihan listrik bulan ini", userId: keuangan.id,
    });
  }
  if (air) {
    await createExpense({
      tanggal: day(0), categoryId: air.id, nominal: 120_000,
      penerima: "PDAM", sumberDana: "kas_tunai",
      keterangan: "Tagihan air bulan ini", userId: keuangan.id,
    });
  }

  // ─── Pengeluaran rutin ─────────────────────────────────────────────────
  const internet = await prisma.expenseCategory.findFirst({ where: { nama: "Internet" } });
  if (katSewa) {
    await prisma.recurringExpense.create({
      data: {
        categoryId: katSewa.id, nominal: 900_000, penerima: "Pemilik Gedung",
        sumberDana: "rekening_bank", tanggalBayar: 5,
        keterangan: "Sewa tempat bulanan", isActive: true,
      },
    });
  }
  if (internet) {
    await prisma.recurringExpense.create({
      data: {
        categoryId: internet.id, nominal: 350_000, penerima: "ISP Lokal",
        sumberDana: "rekening_bank", tanggalBayar: 20,
        keterangan: "Internet bulanan", isActive: true,
      },
    });
  }

  // ─── Job penunggakan: denda + penangguhan ──────────────────────────────
  console.log("• Menjalankan job penunggakan...");
  const overdue = await runOverdueInvoices();

  // ─── Ringkasan ─────────────────────────────────────────────────────────
  const [students, invoices, payments, sessions, payrollCount, statusCounts] = await Promise.all([
    prisma.student.count(),
    prisma.invoice.count(),
    prisma.payment.count(),
    prisma.session.count(),
    prisma.tutorPayroll.count(),
    prisma.student.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const countStatus = (status: string) =>
    statusCounts.find((row) => row.status === status)?._count._all ?? 0;
  console.log("─".repeat(60));
  console.log(`✅ Seed selesai:
  • ${students} siswa (${countStatus("aktif")} aktif, ${countStatus("ditangguhkan")} ditangguhkan, ${countStatus("pending")} pending)
  • ${invoices} tagihan, ${payments} pembayaran
  • ${sessions} sesi, ${payrollCount} rekap honor
  • Job penunggakan: ${overdue.marked} ditandai, ${overdue.fined} didenda, ${overdue.suspended} ditangguhkan`);
  console.log("─".repeat(60));
  console.log("Akun demo (password: " + PASSWORD + "):");
  console.log("  owner@kursify.id    | admin@kursify.id");
  console.log("  keuangan@kursify.id | tutor@kursify.id | tutor2@kursify.id");
}

main()
  .catch((e) => {
    console.error("❌ Seed gagal:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
