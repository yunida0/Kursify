import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { dateOnly, monthLabel, monthRange, previousMonthKey, todayDateOnly } from "@/lib/dates";
import { nextSlipNumber } from "@/lib/numbering";
import { calculatePayroll, feeSchemeForPeriod } from "@/lib/rules/payroll";
import { getSettings } from "./settings";
import { sendNotification } from "@/lib/notify";
import { templates } from "@/lib/notify/templates";

async function getHonorCategory(tx: Prisma.TransactionClient) {
  let category = await tx.expenseCategory.findFirst({ where: { nama: "Honor Tutor" } });
  if (!category) {
    category = await tx.expenseCategory.create({ data: { nama: "Honor Tutor" } });
  }
  return category;
}

/** Job tanggal 1: buat draft rekap honor bulan sebelumnya untuk semua tutor. */
export async function generatePayrollDrafts(
  periode: string = previousMonthKey(),
  userId?: string,
) {
  const { start, endExclusive } = monthRange(periode);
  const tutors = await prisma.tutor.findMany({
    where: { status: { in: ["aktif", "cuti"] } },
    include: { feeSchemes: true },
  });

  const created: string[] = [];
  for (const tutor of tutors) {
    const scheme = feeSchemeForPeriod(tutor.feeSchemes, periode);
    if (!scheme) continue;

    const sessions = await prisma.session.findMany({
      where: {
        tanggal: { gte: start, lt: endExclusive },
        status: "selesai",
        OR: [{ tutorId: tutor.id }, { penggantiTutorId: tutor.id }],
      },
      include: {
        tutorAttendance: true,
        class: { select: { kodeKelas: true } },
      },
    });

    const payroll = calculatePayroll({
      tutorId: tutor.id,
      skema: scheme.skema,
      tarif: scheme.tarif,
      sessions: sessions.map((s) => ({
        id: s.id,
        classId: s.classId,
        kodeKelas: s.class.kodeKelas,
        tanggal: s.tanggal,
        tutorId: s.tutorId,
        penggantiTutorId: s.penggantiTutorId,
        status: s.status,
        tutorAttendanceStatus: s.tutorAttendance?.status ?? null,
      })),
    });

    const existing = await prisma.tutorPayroll.findUnique({
      where: { tutorId_periode: { tutorId: tutor.id, periode } },
    });
    if (existing && existing.status !== "draft") continue;

    const saved = await prisma.$transaction(async (tx) => {
      const record = existing
        ? await tx.tutorPayroll.update({
            where: { id: existing.id },
            data: {
              skema: scheme.skema,
              tarif: scheme.tarif,
              jumlahSesi: payroll.jumlahSesi,
              total: payroll.total,
            },
          })
        : await tx.tutorPayroll.create({
            data: {
              tutorId: tutor.id,
              periode,
              skema: scheme.skema,
              tarif: scheme.tarif,
              jumlahSesi: payroll.jumlahSesi,
              total: payroll.total,
              status: "draft",
            },
          });

      await tx.tutorPayrollItem.deleteMany({ where: { tutorPayrollId: record.id } });
      if (payroll.sessionIds.length > 0) {
        await tx.tutorPayrollItem.createMany({
          data: payroll.sessionIds.map((sessionId) => ({
            tutorPayrollId: record.id,
            sessionId,
          })),
        });
      }

      await writeAudit(tx, {
        userId: userId ?? null,
        action: existing ? "update" : "create",
        tableName: "tutor_payrolls",
        recordId: record.id,
        before: existing ?? null,
        after: { ...record, jumlahSesi: payroll.jumlahSesi, total: payroll.total },
        reason: `Rekap honor ${periode}`,
      });
      return record;
    });
    created.push(saved.id);
  }

  return { periode, count: created.length, payrollIds: created };
}

export async function reviewPayroll(input: { payrollId: string; userId: string }) {
  const payroll = await prisma.tutorPayroll.findUnique({
    where: { id: input.payrollId },
    include: { tutor: true, expenses: true },
  });
  if (!payroll) throw new Error("Rekap honor tidak ditemukan.");
  if (payroll.status !== "draft") throw new Error("Hanya rekap berstatus draft yang dapat direview.");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.tutorPayroll.update({
      where: { id: payroll.id },
      data: { status: "direview", reviewedAt: new Date() },
    });

    const category = await getHonorCategory(tx);
    if (payroll.expenses.length === 0) {
      await tx.expense.create({
        data: {
          tanggal: todayDateOnly(),
          categoryId: category.id,
          nominal: payroll.total,
          penerima: payroll.tutor.nama,
          sumberDana: "rekening_bank",
          keterangan: `Honor tutor ${payroll.tutor.nama} periode ${monthLabel(payroll.periode)} (${payroll.jumlahSesi} sesi)`,
          status: "diajukan",
          createdBy: input.userId,
          tutorPayrollId: payroll.id,
        },
      });
    }

    await writeAudit(tx, {
      userId: input.userId,
      action: "update",
      tableName: "tutor_payrolls",
      recordId: payroll.id,
      before: payroll,
      after: updated,
      reason: "Review rekap honor oleh Staf Keuangan",
    });
    return updated;
  });
}

export async function approvePayroll(input: { payrollId: string; ownerId: string }) {
  const payroll = await prisma.tutorPayroll.findUnique({
    where: { id: input.payrollId },
    include: { expenses: { include: { tutorPayroll: true } } },
  });
  if (!payroll) throw new Error("Rekap honor tidak ditemukan.");
  if (!["direview", "draft"].includes(payroll.status)) {
    throw new Error("Rekap honor tidak dapat disetujui pada status ini.");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.tutorPayroll.update({
      where: { id: payroll.id },
      data: { status: "disetujui", approvedAt: new Date() },
    });
    for (const expense of payroll.expenses) {
      await tx.expense.update({
        where: { id: expense.id },
        data: {
          status: "disetujui",
          approvedBy: input.ownerId,
          approvedAt: new Date(),
        },
      });
    }
    await writeAudit(tx, {
      userId: input.ownerId,
      action: "approve",
      tableName: "tutor_payrolls",
      recordId: payroll.id,
      before: payroll,
      after: updated,
    });
    return updated;
  });
}

export async function payPayroll(input: {
  payrollId: string;
  userId: string;
  role: string;
}) {
  const settings = await getSettings();
  const payroll = await prisma.tutorPayroll.findUnique({
    where: { id: input.payrollId },
    include: {
      tutor: true,
      items: true,
      expenses: true,
    },
  });
  if (!payroll) throw new Error("Rekap honor tidak ditemukan.");
  if (payroll.status === "dibayar") throw new Error("Honor sudah dibayarkan.");
  if (!["direview", "disetujui"].includes(payroll.status)) {
    throw new Error("Staf Keuangan harus mereview rekap honor terlebih dahulu.");
  }
  if (payroll.total > settings.batasPersetujuan && payroll.status !== "disetujui") {
    throw new Error(
      `Honor di atas Rp${settings.batasPersetujuan.toLocaleString("id-ID")} wajib disetujui Owner terlebih dahulu.`,
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const slipNo = await nextSlipNumber(tx);
    const updated = await tx.tutorPayroll.update({
      where: { id: payroll.id },
      data: {
        status: "dibayar",
        paidAt: new Date(),
        slipNo,
        slipPdfPath: `/api/pdf/slip/${payroll.id}`,
      },
    });

    const expense = payroll.expenses[0];
    if (expense) {
      if (expense.status !== "dibayar") {
        await tx.expense.update({
          where: { id: expense.id },
          data: { status: "dibayar", paidAt: new Date() },
        });
        await tx.cashLedger.create({
          data: {
            tanggal: todayDateOnly(),
            tipe: "keluar",
            akun: expense.sumberDana,
            nominal: expense.nominal,
            sumberType: "expense",
            sumberId: expense.id,
            keterangan: `Pembayaran honor ${payroll.tutor.nama} ${payroll.periode}`,
          },
        });
      }
    } else {
      const category = await getHonorCategory(tx);
      const createdExpense = await tx.expense.create({
        data: {
          tanggal: todayDateOnly(),
          categoryId: category.id,
          nominal: payroll.total,
          penerima: payroll.tutor.nama,
          sumberDana: "rekening_bank",
          keterangan: `Honor tutor ${payroll.tutor.nama} periode ${monthLabel(payroll.periode)}`,
          status: "dibayar",
          createdBy: input.userId,
          approvedBy: input.userId,
          approvedAt: new Date(),
          paidAt: new Date(),
          tutorPayrollId: payroll.id,
        },
      });
      await tx.cashLedger.create({
        data: {
          tanggal: todayDateOnly(),
          tipe: "keluar",
          akun: "rekening_bank",
          nominal: payroll.total,
          sumberType: "expense",
          sumberId: createdExpense.id,
          keterangan: `Pembayaran honor ${payroll.tutor.nama} ${payroll.periode}`,
        },
      });
    }

    // Kunci absensi sesi yang tercakup honor periode ini
    const sessionIds = payroll.items.map((i) => i.sessionId);
    if (sessionIds.length > 0) {
      await tx.session.updateMany({
        where: { id: { in: sessionIds } },
        data: { locked: true },
      });
    }

    await writeAudit(tx, {
      userId: input.userId,
      action: "pay",
      tableName: "tutor_payrolls",
      recordId: payroll.id,
      before: payroll,
      after: updated,
      reason: `Honor ${payroll.periode} dibayar${payroll.total > settings.batasPersetujuan ? " (disetujui Owner)" : ""}`,
    });

    return { payroll: updated, sessionIds };
  });

  await sendNotification({
    tujuan: payroll.tutor.noWa,
    template: "honor_dibayar",
    payload: { slipNo: result.payroll.slipNo, pdf: result.payroll.slipPdfPath },
    text: templates.honorDibayar({
      nama: payroll.tutor.nama,
      periode: monthLabel(payroll.periode),
      total: payroll.total,
      slipNo: result.payroll.slipNo ?? "-",
    }),
  });

  return result;
}

/** Job pengingat honor belum dibayar mendekati tanggal 5. */
export async function remindUnpaidPayroll(now = new Date()) {
  const today = todayDateOnly(now);
  const day = today.getUTCDate();
  if (day < 2 || day > 5) return { notified: 0 };
  const periode = previousMonthKey();
  const unpaid = await prisma.tutorPayroll.findMany({
    where: { periode, status: { in: ["draft", "direview", "disetujui"] } },
    include: { tutor: true },
  });
  const finance = await prisma.user.findMany({
    where: { role: { in: ["keuangan", "owner"] }, isActive: true },
  });
  let notified = 0;
  for (const payroll of unpaid) {
    for (const user of finance) {
      if (!user.email) continue;
      await sendNotification({
        tujuan: user.email,
        channel: "email",
        template: "pengingat_honor",
        payload: { payrollId: payroll.id, periode },
        text: `Honor ${payroll.tutor.nama} periode ${monthLabel(periode)} sebesar Rp${payroll.total.toLocaleString("id-ID")} belum dibayar. Batas pembayaran tanggal 5.`,
      });
      notified++;
    }
  }
  return { notified, total: unpaid.length };
}

export function payrollPeriodLabel(periode: string) {
  return monthLabel(periode);
}

/** Session lock helper untuk periode tertentu (dipakai job/test). */
export async function lockSessionsForPeriod(tutorId: string, periode: string) {
  const { start, endExclusive } = monthRange(periode);
  return prisma.session.updateMany({
    where: {
      tutorId,
      tanggal: { gte: start, lt: endExclusive },
      status: "selesai",
    },
    data: { locked: true },
  });
}

export function payrollPaidMarker(date: Date) {
  return dateOnly(date);
}
