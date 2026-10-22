import { prisma } from "@/lib/db";
import { monthRange, todayDateOnly } from "@/lib/dates";
import { attendancePercentage } from "@/lib/rules/attendance";
import { averageScore } from "@/lib/rules/grading";
import { calculatePayroll, feeSchemeForPeriod } from "@/lib/rules/payroll";

export interface ReportFilter {
  periode?: string;
  programId?: string;
  classId?: string;
}

export interface AttendanceReportRow {
  studentId: string;
  studentCode: string;
  nama: string;
  classId: string;
  kelas: string;
  program: string;
  hadir: number;
  izin: number;
  sakit: number;
  alpa: number;
  total: number;
  persen: number;
  diBawahMinimum: boolean;
}

export async function attendanceReport(
  filter: ReportFilter,
  minKehadiran = 75,
): Promise<{ rows: AttendanceReportRow[]; totalSesi: number }> {
  const periode = filter.periode ?? new Date().toISOString().slice(0, 7);
  const { start, endExclusive } = monthRange(periode);

  const enrollments = await prisma.enrollment.findMany({
    where: {
      status: "aktif",
      ...(filter.classId ? { classId: filter.classId } : {}),
      class: {
        ...(filter.programId ? { programId: filter.programId } : {}),
        ...(filter.classId ? { id: filter.classId } : {}),
      },
    },
    include: {
      student: true,
      class: { include: { program: true } },
    },
    orderBy: [{ class: { kodeKelas: "asc" } }, { student: { nama: "asc" } }],
  });

  const sessions = await prisma.session.findMany({
    where: {
      status: "selesai",
      tanggal: { gte: start, lt: endExclusive },
      ...(filter.classId ? { classId: filter.classId } : {}),
      class: filter.programId ? { programId: filter.programId } : undefined,
    },
    select: {
      classId: true,
      attendances: { select: { studentId: true, status: true } },
    },
  });

  const totalSesiPerClass = new Map<string, number>();
  const attendanceMap = new Map<string, { hadir: number; izin: number; sakit: number; alpa: number }>();
  for (const session of sessions) {
    totalSesiPerClass.set(session.classId, (totalSesiPerClass.get(session.classId) ?? 0) + 1);
    for (const a of session.attendances) {
      const key = `${session.classId}:${a.studentId}`;
      const current = attendanceMap.get(key) ?? { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
      if (a.status in current) current[a.status as keyof typeof current]++;
      attendanceMap.set(key, current);
    }
  }

  const rows = enrollments.map((en) => {
    const key = `${en.classId}:${en.studentId}`;
    const counts = attendanceMap.get(key) ?? { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
    const total = counts.hadir + counts.izin + counts.sakit + counts.alpa;
    const totalSesi = totalSesiPerClass.get(en.classId) ?? 0;
    const persen = attendancePercentage(counts.hadir, totalSesi);
    return {
      studentId: en.studentId,
      studentCode: en.student.studentCode ?? "-",
      nama: en.student.nama,
      classId: en.classId,
      kelas: en.class.kodeKelas,
      program: en.class.program.nama,
      ...counts,
      total,
      persen,
      diBawahMinimum: persen < minKehadiran,
    };
  });

  return { rows, totalSesi: sessions.length };
}

export interface HonorReportRow {
  tutorId: string;
  tutorCode: string;
  nama: string;
  skema: string;
  tarif: number;
  jumlahSesi: number;
  total: number;
  perClass: { kodeKelas: string; jumlah: number }[];
}

export async function honorReport(filter: ReportFilter): Promise<HonorReportRow[]> {
  const periode = filter.periode ?? new Date().toISOString().slice(0, 7);
  const { start, endExclusive } = monthRange(periode);

  const sessions = await prisma.session.findMany({
    where: { tanggal: { gte: start, lt: endExclusive }, status: "selesai" },
    include: {
      tutorAttendance: true,
      class: { include: { program: true } },
    },
  });

  const tutorIds = Array.from(
    new Set(
      sessions.flatMap((s) => [s.tutorId, s.penggantiTutorId].filter(Boolean) as string[]),
    ),
  );

  const tutors = await prisma.tutor.findMany({
    where: tutorIds.length ? { id: { in: tutorIds } } : undefined,
    include: { feeSchemes: true },
    orderBy: { nama: "asc" },
  });

  const rows: HonorReportRow[] = [];
  for (const tutor of tutors) {
    if (filter.classId && !sessions.some((s) => s.classId === filter.classId)) continue;
    if (filter.programId && !sessions.some((s) => s.class.programId === filter.programId)) continue;
    const scheme = feeSchemeForPeriod(tutor.feeSchemes, periode);
    if (!scheme) continue;
    const scoped = filter.classId
      ? sessions.filter((s) => s.classId === filter.classId)
      : filter.programId
        ? sessions.filter((s) => s.class.programId === filter.programId)
        : sessions;
    const result = calculatePayroll({
      tutorId: tutor.id,
      skema: scheme.skema,
      tarif: scheme.tarif,
      sessions: scoped.map((s) => ({
        id: s.id,
        classId: s.classId,
        kodeKelas: s.class.kodeKelas,
        tutorId: s.tutorId,
        penggantiTutorId: s.penggantiTutorId,
        status: s.status,
        tutorAttendanceStatus: s.tutorAttendance?.status ?? null,
      })),
    });
    if (result.jumlahSesi === 0 && scheme.skema !== "bulanan_tetap") continue;
    rows.push({
      tutorId: tutor.id,
      tutorCode: tutor.tutorCode,
      nama: tutor.nama,
      skema: scheme.skema,
      tarif: scheme.tarif,
      jumlahSesi: result.jumlahSesi,
      total: result.total,
      perClass: result.perClass.map((c) => ({ kodeKelas: c.kodeKelas, jumlah: c.jumlah })),
    });
  }
  return rows;
}

export interface ProgramPopularityRow {
  programId: string;
  kode: string;
  nama: string;
  level: string | null;
  jumlahSiswa: number;
  jumlahKelas: number;
  totalKuota: number;
  persentase: number;
}

export async function programPopularity(): Promise<ProgramPopularityRow[]> {
  const programs = await prisma.program.findMany({
    where: { isActive: true },
    include: {
      _count: { select: { students: { where: { status: "aktif" } } } },
      classes: {
        where: { status: { not: "ditutup" } },
        include: {
          _count: { select: { enrollments: { where: { status: "aktif" } } } },
        },
      },
    },
    orderBy: { nama: "asc" },
  });

  return programs.map((p) => {
    const jumlahKelas = p.classes.length;
    const totalKuota = p.classes.reduce((sum, c) => sum + c.kuota, 0);
    const enrolled = p.classes.reduce((sum, c) => sum + c._count.enrollments, 0);
    return {
      programId: p.id,
      kode: p.kode,
      nama: p.nama,
      level: p.level,
      jumlahSiswa: p._count.students,
      jumlahKelas,
      totalKuota,
      persentase: totalKuota ? Math.round((enrolled / totalKuota) * 10000) / 100 : 0,
    };
  });
}

export interface CriticalStudentRow {
  studentId: string;
  studentCode: string;
  nama: string;
  noWa: string;
  jumlahTagihan: number;
  totalTunggakan: number;
  hariTerlambat: number;
  jatuhTempoTertua: Date;
}

export async function criticalStudents(minDays = 30): Promise<CriticalStudentRow[]> {
  const today = todayDateOnly();
  const invoices = await prisma.invoice.findMany({
    where: { status: "menunggak" },
    include: { student: true, payments: { where: { status: "valid" } } },
  });

  const map = new Map<string, CriticalStudentRow>();
  for (const inv of invoices) {
    const paid = inv.payments.reduce((sum, p) => sum + p.nominal, 0);
    const sisa = Math.max(0, inv.total - paid);
    if (sisa <= 0) continue;
    const days = Math.floor((today.getTime() - inv.jatuhTempo.getTime()) / 86_400_000);
    if (days <= minDays) continue;
    const current = map.get(inv.studentId);
    if (current) {
      current.jumlahTagihan++;
      current.totalTunggakan += sisa;
      current.hariTerlambat = Math.max(current.hariTerlambat, days);
      if (inv.jatuhTempo < current.jatuhTempoTertua) current.jatuhTempoTertua = inv.jatuhTempo;
    } else {
      map.set(inv.studentId, {
        studentId: inv.studentId,
        studentCode: inv.student.studentCode ?? "-",
        nama: inv.student.nama,
        noWa: inv.student.noWaWali || inv.student.noWa,
        jumlahTagihan: 1,
        totalTunggakan: sisa,
        hariTerlambat: days,
        jatuhTempoTertua: inv.jatuhTempo,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.hariTerlambat - a.hariTerlambat);
}

export interface FinancialReport {
  periode: string;
  initial: { kas_tunai: number; rekening_bank: number; total: number };
  incomes: { jenis: string; total: number }[];
  expenses: { kategori: string; total: number }[];
  accounts: {
    akun: string;
    awal: number;
    masuk: number;
    keluar: number;
    akhir: number;
  }[];
  totalMasuk: number;
  totalKeluar: number;
  saldoAkhir: number;
}

export async function financialReport(filter: ReportFilter): Promise<FinancialReport> {
  const periode = filter.periode ?? new Date().toISOString().slice(0, 7);
  const { start, endExclusive } = monthRange(periode);

  const before = await prisma.cashLedger.groupBy({
    by: ["akun", "tipe"],
    where: { tanggal: { lt: start } },
    _sum: { nominal: true },
  });
  const initial = { kas_tunai: 0, rekening_bank: 0, total: 0 };
  for (const row of before) {
    const amount = row.tipe === "masuk" ? row._sum.nominal ?? 0 : -(row._sum.nominal ?? 0);
    if (row.akun === "kas_tunai") initial.kas_tunai += amount;
    else initial.rekening_bank += amount;
  }
  initial.total = initial.kas_tunai + initial.rekening_bank;

  const periodRows = await prisma.cashLedger.groupBy({
    by: ["akun", "tipe"],
    where: { tanggal: { gte: start, lt: endExclusive } },
    _sum: { nominal: true },
  });

  const accounts = ["kas_tunai", "rekening_bank"].map((akun) => {
    const awal = akun === "kas_tunai" ? initial.kas_tunai : initial.rekening_bank;
    const masuk =
      periodRows.find((r) => r.akun === akun && r.tipe === "masuk")?._sum.nominal ?? 0;
    const keluar =
      periodRows.find((r) => r.akun === akun && r.tipe === "keluar")?._sum.nominal ?? 0;
    return { akun, awal, masuk, keluar, akhir: awal + masuk - keluar };
  });

  const payments = await prisma.payment.findMany({
    where: { status: "valid", tanggal: { gte: start, lt: endExclusive } },
    include: { invoice: { select: { jenis: true } } },
  });
  const incomeMap = new Map<string, number>();
  for (const p of payments) {
    incomeMap.set(p.invoice.jenis, (incomeMap.get(p.invoice.jenis) ?? 0) + p.nominal);
  }

  const expenses = await prisma.expense.findMany({
    where: {
      status: "dibayar",
      paidAt: { gte: start, lt: endExclusive },
    },
    include: { category: true },
  });
  const expMap = new Map<string, number>();
  for (const e of expenses) {
    expMap.set(e.category.nama, (expMap.get(e.category.nama) ?? 0) + e.nominal);
  }

  const totalMasuk = accounts.reduce((s, a) => s + a.masuk, 0);
  const totalKeluar = accounts.reduce((s, a) => s + a.keluar, 0);

  return {
    periode,
    initial,
    incomes: Array.from(incomeMap.entries())
      .map(([jenis, total]) => ({ jenis, total }))
      .sort((a, b) => b.total - a.total),
    expenses: Array.from(expMap.entries())
      .map(([kategori, total]) => ({ kategori, total }))
      .sort((a, b) => b.total - a.total),
    accounts,
    totalMasuk,
    totalKeluar,
    saldoAkhir: accounts.reduce((s, a) => s + a.akhir, 0),
  };
}

export async function cashBalances() {
  const rows = await prisma.cashLedger.groupBy({
    by: ["akun", "tipe"],
    _sum: { nominal: true },
  });
  const result = { kas_tunai: 0, rekening_bank: 0, total: 0 };
  for (const row of rows) {
    const amount = row.tipe === "masuk" ? row._sum.nominal ?? 0 : -(row._sum.nominal ?? 0);
    if (row.akun === "kas_tunai") result.kas_tunai += amount;
    else result.rekening_bank += amount;
  }
  result.total = result.kas_tunai + result.rekening_bank;
  return result;
}

export async function recentLedger(limit = 10) {
  return prisma.cashLedger.findMany({ orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }], take: limit });
}

export async function monthlyStats(periode = new Date().toISOString().slice(0, 7)) {
  const financial = await financialReport({ periode });
  const activeStudents = await prisma.student.count({ where: { status: "aktif" } });
  const pendingStudents = await prisma.student.count({ where: { status: "pending" } });
  const outstanding = await prisma.invoice.findMany({
    where: { status: { in: ["belum_dibayar", "dibayar_sebagian", "menunggak"] } },
    include: { payments: { where: { status: "valid" } } },
  });
  const tunggakan = outstanding.reduce((sum, inv) => {
    const paid = inv.payments.reduce((s, p) => s + p.nominal, 0);
    return sum + Math.max(0, inv.total - paid);
  }, 0);
  return {
    activeStudents,
    pendingStudents,
    pemasukan: financial.totalMasuk,
    pengeluaran: financial.totalKeluar,
    saldo: financial.saldoAkhir,
    tunggakan,
    saldoPerAkun: financial.accounts,
    incomeBreakdown: financial.incomes,
    expenseBreakdown: financial.expenses,
  };
}

export function averageFromGrades(grades: { nilai: number }[]) {
  return averageScore(grades.map((g) => g.nilai));
}
