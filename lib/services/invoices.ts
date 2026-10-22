import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { addDays, monthKey, monthRange, todayDateOnly, wibParts } from "@/lib/dates";
import { nextInvoiceNumber } from "@/lib/numbering";
import { writeAudit } from "@/lib/audit";
import {
  calcInvoiceTotal,
  determineInvoiceStatus,
  isInvoiceOverdue,
  lateFeeToApply,
  summarizePayments,
} from "@/lib/rules/invoice";
import { getSettings } from "./settings";
import { sendNotification } from "@/lib/notify";
import { templates } from "@/lib/notify/templates";
import { formatRupiah } from "@/lib/money";

type Tx = Prisma.TransactionClient;

export interface CreateInvoiceInput {
  studentId: string;
  enrollmentId?: string | null;
  jenis: "pendaftaran" | "spp" | "paket" | "lain";
  periode?: string | null;
  nominal: number;
  potongan?: number;
  denda?: number;
  jatuhTempo: Date;
  catatan?: string | null;
  userId?: string | null;
}

/** Jatuh tempo SPP berikutnya: tanggal 10 bulan ini bila belum lewat, selain itu bulan depan. */
export function nextSppDueDate(now = new Date(), tanggalJatuhTempo = 10): Date {
  const p = wibParts(now);
  if (p.day <= tanggalJatuhTempo) {
    return new Date(Date.UTC(p.year, p.month - 1, tanggalJatuhTempo));
  }
  return new Date(Date.UTC(p.year, p.month, tanggalJatuhTempo));
}

/** Membuat tagihan di dalam transaksi (nomor urut aman dari duplikasi). */
export async function createInvoiceTx(tx: Tx, input: CreateInvoiceInput) {
  const total = calcInvoiceTotal(input);
  const today = todayDateOnly();
  const status =
    total <= 0
      ? "lunas"
      : isInvoiceOverdue(input.jatuhTempo, today)
        ? "menunggak"
        : "belum_dibayar";
  const invoiceNo = await nextInvoiceNumber(tx);

  const invoice = await tx.invoice.create({
    data: {
      invoiceNo,
      studentId: input.studentId,
      enrollmentId: input.enrollmentId ?? null,
      jenis: input.jenis,
      periode: input.periode ?? null,
      nominal: input.nominal,
      potongan: input.potongan ?? 0,
      denda: input.denda ?? 0,
      total,
      jatuhTempo: input.jatuhTempo,
      status,
      menunggakSejak: status === "menunggak" ? today : null,
      catatan: input.catatan ?? null,
    },
    include: { student: true },
  });

  if (input.potongan && input.potongan > 0) {
    await tx.discount.create({
      data: {
        invoiceId: invoice.id,
        jenis: "lain",
        nominal: input.potongan,
        alasan: "Potongan saat tagihan dibuat",
        approvedBy: input.userId ?? null,
      },
    });
  }

  await writeAudit(tx, {
    userId: input.userId,
    action: "create",
    tableName: "invoices",
    recordId: invoice.id,
    after: invoice,
  });

  return invoice;
}

/** Tagihan berikutnya untuk skema paket saat saldo habis. */
export async function createNextPackageInvoiceTx(
  tx: Tx,
  enrollmentId: string,
  userId?: string | null,
) {
  const enrollment = await tx.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      student: true,
      class: { include: { program: true } },
    },
  });
  if (!enrollment) throw new Error("Enrollment tidak ditemukan.");
  const program = enrollment.class.program;
  if (program.skemaTagihan !== "paket") return null;

  const outstanding = await tx.invoice.findFirst({
    where: {
      enrollmentId,
      jenis: "paket",
      status: { in: ["belum_dibayar", "dibayar_sebagian", "menunggak"] },
    },
  });
  if (outstanding) return null;

  const invoice = await createInvoiceTx(tx, {
    studentId: enrollment.studentId,
    enrollmentId,
    jenis: "paket",
    nominal: program.tarif,
    jatuhTempo: addDays(todayDateOnly(), 7),
    catatan: `Paket ${program.jumlahPertemuanPaket ?? 10} pertemuan — ${program.nama}`,
    userId,
  });

  await tx.enrollment.update({
    where: { id: enrollmentId },
    data: { saldoPertemuan: program.jumlahPertemuanPaket ?? 10 },
  });

  await writeAudit(tx, {
    userId,
    action: "create",
    tableName: "enrollments",
    recordId: enrollmentId,
    before: { saldoPertemuan: enrollment.saldoPertemuan },
    after: { saldoPertemuan: program.jumlahPertemuanPaket ?? 10 },
    reason: "Paket berikutnya diterbitkan otomatis setelah saldo habis",
  });

  return invoice;
}

export async function issueInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { student: true },
  });
  if (!invoice || invoice.status === "void") return;
  await sendNotification({
    tujuan: invoice.student.noWaWali || invoice.student.noWa,
    template: "tagihan_terbit",
    invoiceId: invoice.id,
    payload: { invoiceNo: invoice.invoiceNo },
    text: templates.tagihanTerbit({
      nama: invoice.student.nama,
      invoiceNo: invoice.invoiceNo,
      jenis: invoice.jenis,
      total: invoice.total,
      jatuhTempo: invoice.jatuhTempo,
    }),
  });
}

/** Hitung ulang status tagihan dari pembayaran valid. */
export async function recalcInvoiceTx(tx: Tx, invoiceId: string) {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  });
  if (!invoice) throw new Error("Tagihan tidak ditemukan.");
  if (invoice.status === "void") return invoice;

  const { paid, validCount } = summarizePayments(invoice.payments);
  const status = determineInvoiceStatus({
    total: invoice.total,
    paid,
    validCount,
    jatuhTempo: invoice.jatuhTempo,
    today: todayDateOnly(),
  });

  return tx.invoice.update({
    where: { id: invoiceId },
    data: { status, menunggakSejak: invoice.menunggakSejak },
  });
}

/**
 * Sinkronisasi status penangguhan siswa:
 * - aktif -> ditangguhkan bila ada tagihan lewat jatuh tempo > batas hari
 * - ditangguhkan -> aktif bila tidak ada lagi tagihan menunggak
 */
export async function syncStudentSuspensionTx(
  tx: Tx,
  studentId: string,
  today = todayDateOnly(),
) {
  const settings = await getSettings();
  const student = await tx.student.findUnique({ where: { id: studentId } });
  if (!student || !["aktif", "ditangguhkan"].includes(student.status)) return student;

  const overdueInvoices = await tx.invoice.findMany({
    where: {
      studentId,
      status: "menunggak",
    },
    select: { jatuhTempo: true },
  });

  const stillMenunggak = await tx.invoice.count({
    where: { studentId, status: "menunggak" },
  });

  const shouldSuspend =
    student.status === "aktif" &&
    overdueInvoices.some(
      (inv) =>
        (today.getTime() - inv.jatuhTempo.getTime()) / 86_400_000 >
        settings.batasTangguhHari,
    );

  if (shouldSuspend) {
    const updated = await tx.student.update({
      where: { id: studentId },
      data: { status: "ditangguhkan", suspendedAt: today },
    });
    await writeAudit(tx, {
      userId: null,
      action: "update",
      tableName: "students",
      recordId: studentId,
      before: { status: student.status },
      after: { status: "ditangguhkan" },
      reason: `Tunggakan melebihi ${settings.batasTangguhHari} hari`,
    });
    return updated;
  }

  if (student.status === "ditangguhkan" && stillMenunggak === 0) {
    const updated = await tx.student.update({
      where: { id: studentId },
      data: { status: "aktif", suspendedAt: null },
    });
    await writeAudit(tx, {
      userId: null,
      action: "update",
      tableName: "students",
      recordId: studentId,
      before: { status: student.status },
      after: { status: "aktif" },
      reason: "Semua tunggakan telah dilunasi",
    });
    return updated;
  }

  return student;
}

/** Potongan/beasiswa hanya oleh Owner. */
export async function applyDiscount(input: {
  invoiceId: string;
  jenis: "saudara" | "beasiswa" | "lain";
  nominal: number;
  alasan: string;
  ownerId: string;
}) {
  const invoice = await prisma.invoice.findUnique({ where: { id: input.invoiceId } });
  if (!invoice) throw new Error("Tagihan tidak ditemukan.");
  if (invoice.status === "void") throw new Error("Tagihan sudah dibatalkan.");
  if (input.nominal <= 0) throw new Error("Nominal potongan harus lebih dari 0.");
  if (invoice.potongan + input.nominal > invoice.nominal) {
    throw new Error("Total potongan tidak boleh melebihi nominal tagihan.");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        potongan: invoice.potongan + input.nominal,
        total: calcInvoiceTotal({
          nominal: invoice.nominal,
          potongan: invoice.potongan + input.nominal,
          denda: invoice.denda,
        }),
      },
    });
    await tx.discount.create({
      data: {
        invoiceId: invoice.id,
        jenis: input.jenis,
        nominal: input.nominal,
        alasan: input.alasan,
        approvedBy: input.ownerId,
      },
    });
    await writeAudit(tx, {
      userId: input.ownerId,
      action: "update",
      tableName: "invoices",
      recordId: invoice.id,
      before: invoice,
      after: updated,
      reason: `Potongan ${input.jenis}: ${input.alasan}`,
    });
    return updated;
  });
}

/** Owner dapat menghapus/mengurangi denda dengan alasan. */
export async function adjustLateFee(input: {
  invoiceId: string;
  nominalDendaBaru: number;
  alasan: string;
  ownerId: string;
}) {
  const invoice = await prisma.invoice.findUnique({ where: { id: input.invoiceId } });
  if (!invoice) throw new Error("Tagihan tidak ditemukan.");
  if (input.nominalDendaBaru < 0) throw new Error("Denda tidak boleh negatif.");
  if (input.nominalDendaBaru > invoice.denda)
    throw new Error("Nominal denda baru tidak boleh lebih besar dari denda saat ini.");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        denda: input.nominalDendaBaru,
        total: calcInvoiceTotal({
          nominal: invoice.nominal,
          potongan: invoice.potongan,
          denda: input.nominalDendaBaru,
        }),
      },
    });
    await writeAudit(tx, {
      userId: input.ownerId,
      action: "update",
      tableName: "invoices",
      recordId: invoice.id,
      before: invoice,
      after: updated,
      reason: input.alasan,
    });
    return updated;
  });
}

/** Membuat tagihan SPP untuk semua siswa aktif di kelas berskema SPP. Idempoten. */
export async function generateSppForMonth(periode = monthKey(), userId?: string) {
  const { start } = monthRange(periode);
  const [year, month] = periode.split("-").map(Number);
  const dueDate = new Date(Date.UTC(year, month - 1, 10));

  const enrollments = await prisma.enrollment.findMany({
    where: {
      status: "aktif",
      student: { status: "aktif" },
      class: { program: { skemaTagihan: "spp_bulanan", isActive: true } },
    },
    include: {
      student: true,
      class: { include: { program: true } },
    },
  });

  const createdIds: string[] = [];
  for (const enrollment of enrollments) {
    const existing = await prisma.invoice.findFirst({
      where: {
        studentId: enrollment.studentId,
        enrollmentId: enrollment.id,
        jenis: "spp",
        periode,
        status: { not: "void" },
      },
    });
    if (existing) continue;

    const invoice = await prisma.$transaction((tx) =>
      createInvoiceTx(tx, {
        studentId: enrollment.studentId,
        enrollmentId: enrollment.id,
        jenis: "spp",
        periode,
        nominal: enrollment.class.program.tarif,
        jatuhTempo: dueDate,
        catatan: `SPP ${periode}`,
        userId,
      }),
    );
    createdIds.push(invoice.id);
    await issueInvoice(invoice.id);
  }

  return { periode, created: createdIds.length, invoiceIds: createdIds, start };
}

/**
 * Job harian: tandai menunggak + denda sekali, kirim pengingat,
 * lalu tangguhkan siswa yang menunggak > batas hari.
 */
export async function runOverdueInvoices(now = new Date()) {
  const settings = await getSettings();
  const today = todayDateOnly(now);
  const candidates = await prisma.invoice.findMany({
    where: {
      status: { in: ["belum_dibayar", "dibayar_sebagian", "menunggak"] },
      jatuhTempo: { lt: today },
    },
    include: { student: true, payments: true },
  });

  let marked = 0;
  let fined = 0;
  const reasonIds: string[] = [];

  for (const invoice of candidates) {
    const { paid, validCount } = summarizePayments(invoice.payments);
    if (paid >= invoice.total) continue;

    const newStatus = determineInvoiceStatus({
      total: invoice.total,
      paid,
      validCount,
      jatuhTempo: invoice.jatuhTempo,
      today,
    });
    const fee = lateFeeToApply({
      status: newStatus,
      menunggakSejak: invoice.menunggakSejak,
      jatuhTempo: invoice.jatuhTempo,
      today,
      denda: settings.dendaKeterlambatan,
    });

    if (newStatus !== invoice.status || fee > 0) {
      const updated = await prisma.$transaction(async (tx) => {
        const inv = await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            status: newStatus,
            menunggakSejak: invoice.menunggakSejak ?? (fee > 0 ? today : null),
            denda: invoice.denda + fee,
            total: invoice.total + fee,
          },
        });
        await writeAudit(tx, {
          userId: null,
          action: "update",
          tableName: "invoices",
          recordId: invoice.id,
          before: invoice,
          after: inv,
          reason: fee > 0 ? "Denda keterlambatan otomatis" : "Status menunggak otomatis",
        });
        return inv;
      });

      if (fee > 0) {
        fined++;
        await sendNotification({
          tujuan: invoice.student.noWaWali || invoice.student.noWa,
          template: "menunggak",
          invoiceId: invoice.id,
          payload: { invoiceNo: invoice.invoiceNo },
          text: templates.menunggak({
            nama: invoice.student.nama,
            invoiceNo: invoice.invoiceNo,
            total: updated.total,
            denda: updated.denda,
          }),
        });
      }
      marked++;
      reasonIds.push(invoice.studentId);
    }
  }

  // Penangguhan / pemulihan status siswa. Sertakan juga siswa yang tagihannya
  // sudah menunggak sebelum job ini berjalan agar ambang batas penangguhan
  // tetap diperiksa setiap hari (bukan hanya saat status/denda berubah).
  const affectedStudentIds = Array.from(
    new Set([
      ...reasonIds,
      ...candidates
        .filter((inv) => inv.status === "menunggak")
        .map((inv) => inv.studentId),
    ]),
  );
  const suspended: string[] = [];
  for (const studentId of affectedStudentIds) {
    const before = await prisma.student.findUnique({ where: { id: studentId } });
    const after = await prisma.$transaction((tx) =>
      syncStudentSuspensionTx(tx, studentId, today),
    );
    if (before?.status !== after?.status && after?.status === "ditangguhkan") {
      suspended.push(studentId);
    }
  }

  return {
    checked: candidates.length,
    marked,
    fined,
    suspended: suspended.length,
    totalDenda: settings.dendaKeterlambatan,
  };
}

/** Pengingat H-3 jatuh tempo. Idempoten per hari (cek notifikasi hari ini). */
export async function sendDueReminders(now = new Date()) {
  const settings = await getSettings();
  const today = todayDateOnly(now);
  const target = addDays(today, 3);
  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: ["belum_dibayar", "dibayar_sebagian"] },
      jatuhTempo: target,
    },
    include: { student: true },
  });

  let sent = 0;
  for (const invoice of invoices) {
    const already = await prisma.notificationLog.findFirst({
      where: {
        invoiceId: invoice.id,
        template: "pengingat_jatuh_tempo",
        sentAt: { gte: today },
      },
    });
    if (already) continue;
    await sendNotification({
      tujuan: invoice.student.noWaWali || invoice.student.noWa,
      template: "pengingat_jatuh_tempo",
      invoiceId: invoice.id,
      payload: { invoiceNo: invoice.invoiceNo },
      text: templates.pengingatJatuhTempo({
        nama: invoice.student.nama,
        invoiceNo: invoice.invoiceNo,
        total: invoice.total,
        jatuhTempo: invoice.jatuhTempo,
      }),
    });
    sent++;
  }
  return { targetDate: target.toISOString().slice(0, 10), sent, total: invoices.length, settings };
}

/** Ringkasan outstanding untuk dashboard. */
export async function outstandingSummary(studentId?: string) {
  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: ["belum_dibayar", "dibayar_sebagian", "menunggak"] },
      ...(studentId ? { studentId } : {}),
    },
    select: { total: true, status: true, payments: { where: { status: "valid" }, select: { nominal: true } } },
  });
  let total = 0;
  let menunggak = 0;
  for (const inv of invoices) {
    const paid = inv.payments.reduce((s, p) => s + p.nominal, 0);
    const sisa = Math.max(0, inv.total - paid);
    total += sisa;
    if (inv.status === "menunggak") menunggak += sisa;
  }
  return { total, menunggak, count: invoices.length };
}

export function invoiceSisa(total: number, payments: { nominal: number }[]) {
  return Math.max(0, total - payments.reduce((s, p) => s + p.nominal, 0));
}

/** Dipakai UI: label status tagihan. */
export function invoiceTypeLabel(jenis: string) {
  return (
    {
      pendaftaran: "Pendaftaran",
      spp: "SPP Bulanan",
      paket: "Paket Pertemuan",
      lain: "Lain-lain",
    }[jenis] ?? jenis
  );
}

/** Tagihan pendaftaran untuk siswa baru (dipanggil saat pendaftaran). */
export async function createRegistrationInvoiceTx(
  tx: Tx,
  studentId: string,
  programId: string,
  userId?: string | null,
) {
  const program = await tx.program.findUnique({ where: { id: programId } });
  if (!program) throw new Error("Program tidak ditemukan.");
  const invoice = await createInvoiceTx(tx, {
    studentId,
    jenis: "pendaftaran",
    nominal: program.biayaPendaftaran,
    jatuhTempo: addDays(todayDateOnly(), 7),
    catatan: `Biaya pendaftaran ${program.nama}`,
    userId,
  });
  return invoice;
}

/** Helper notifikasi tagihan gagal (dipakai cron) */
export async function notifyInvoiceFallback(invoice: {
  id: string;
  invoiceNo: string;
  total: number;
  jatuhTempo: Date;
  student: { nama: string; noWa: string; noWaWali: string | null };
}) {
  await sendNotification({
    tujuan: invoice.student.noWaWali || invoice.student.noWa,
    template: "tagihan_terbit",
    invoiceId: invoice.id,
    text: templates.tagihanTerbit({
      nama: invoice.student.nama,
      invoiceNo: invoice.invoiceNo,
      jenis: "tagihan",
      total: invoice.total,
      jatuhTempo: invoice.jatuhTempo,
    }),
  });
  return formatRupiah(invoice.total);
}
