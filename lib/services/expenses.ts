import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { addDays, dateOnly, formatDate, monthKey, monthRange, todayDateOnly } from "@/lib/dates";
import { getSettings } from "./settings";
import { sendNotification } from "@/lib/notify";
import { templates } from "@/lib/notify/templates";

export interface CreateExpenseInput {
  tanggal: string;
  categoryId: string;
  nominal: number;
  penerima: string;
  sumberDana: "kas_tunai" | "rekening_bank";
  keterangan: string;
  buktiPath?: string | null;
  userId: string;
  langsungBayar?: boolean;
}

async function writeLedgerKeluar(
  tx: Prisma.TransactionClient,
  input: {
    tanggal: Date;
    nominal: number;
    akun: string;
    expenseId: string;
    keterangan: string;
  },
) {
  return tx.cashLedger.create({
    data: {
      tanggal: input.tanggal,
      tipe: "keluar",
      akun: input.akun,
      nominal: input.nominal,
      sumberType: "expense",
      sumberId: input.expenseId,
      keterangan: input.keterangan,
    },
  });
}

export async function createExpense(input: CreateExpenseInput) {
  const settings = await getSettings();
  if (input.nominal <= 0) throw new Error("Nominal pengeluaran harus lebih dari 0.");
  if (!["kas_tunai", "rekening_bank"].includes(input.sumberDana)) {
    throw new Error("Sumber dana tidak valid.");
  }
  if (input.langsungBayar && input.nominal > settings.batasPersetujuan) {
    throw new Error(
      `Pengeluaran di atas Rp${settings.batasPersetujuan.toLocaleString("id-ID")} wajib disetujui Owner terlebih dahulu.`,
    );
  }

  return prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        tanggal: dateOnly(input.tanggal),
        categoryId: input.categoryId,
        nominal: input.nominal,
        penerima: input.penerima,
        sumberDana: input.sumberDana,
        keterangan: input.keterangan,
        buktiPath: input.buktiPath || null,
        status: input.langsungBayar ? "dibayar" : "diajukan",
        createdBy: input.userId,
        approvedBy: input.langsungBayar ? input.userId : null,
        approvedAt: input.langsungBayar ? new Date() : null,
        paidAt: input.langsungBayar ? new Date() : null,
      },
    });

    if (input.langsungBayar) {
      await writeLedgerKeluar(tx, {
        tanggal: dateOnly(input.tanggal),
        nominal: input.nominal,
        akun: input.sumberDana,
        expenseId: expense.id,
        keterangan: `Pengeluaran: ${input.keterangan}`,
      });
    }

    await writeAudit(tx, {
      userId: input.userId,
      action: "create",
      tableName: "expenses",
      recordId: expense.id,
      after: expense,
    });
    return expense;
  });
}

export async function approveExpense(input: {
  expenseId: string;
  ownerId: string;
}) {
  const expense = await prisma.expense.findUnique({ where: { id: input.expenseId } });
  if (!expense) throw new Error("Pengeluaran tidak ditemukan.");
  if (expense.status !== "diajukan") throw new Error("Hanya pengeluaran berstatus diajukan yang dapat disetujui.");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.expense.update({
      where: { id: expense.id },
      data: { status: "disetujui", approvedBy: input.ownerId, approvedAt: new Date() },
    });
    await writeAudit(tx, {
      userId: input.ownerId,
      action: "approve",
      tableName: "expenses",
      recordId: expense.id,
      before: expense,
      after: updated,
    });
    return updated;
  });
}

export async function rejectExpense(input: {
  expenseId: string;
  reason: string;
  ownerId: string;
}) {
  const expense = await prisma.expense.findUnique({ where: { id: input.expenseId } });
  if (!expense) throw new Error("Pengeluaran tidak ditemukan.");
  if (expense.status !== "diajukan") throw new Error("Hanya pengeluaran diajukan yang dapat ditolak.");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.expense.update({
      where: { id: expense.id },
      data: { status: "ditolak", approvedBy: input.ownerId },
    });
    await writeAudit(tx, {
      userId: input.ownerId,
      action: "reject",
      tableName: "expenses",
      recordId: expense.id,
      before: expense,
      after: updated,
      reason: input.reason,
    });
    return updated;
  });
}

/** Menandai pengeluaran dibayar + entri kas keluar. */
export async function payExpense(input: { expenseId: string; userId: string }) {
  const settings = await getSettings();
  const expense = await prisma.expense.findUnique({
    where: { id: input.expenseId },
    include: { category: true, tutorPayroll: true },
  });
  if (!expense) throw new Error("Pengeluaran tidak ditemukan.");
  if (!["diajukan", "disetujui"].includes(expense.status)) {
    throw new Error("Status pengeluaran tidak dapat dibayar.");
  }
  if (expense.nominal > settings.batasPersetujuan && expense.status !== "disetujui") {
    throw new Error("Pengeluaran di atas batas wajib disetujui Owner.");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.expense.update({
      where: { id: expense.id },
      data: {
        status: "dibayar",
        paidAt: new Date(),
        approvedBy: expense.approvedBy ?? input.userId,
        approvedAt: expense.approvedAt ?? new Date(),
      },
    });
    await writeLedgerKeluar(tx, {
      tanggal: expense.tanggal,
      nominal: expense.nominal,
      akun: expense.sumberDana,
      expenseId: expense.id,
      keterangan: `Pengeluaran: ${expense.keterangan}`,
    });
    await writeAudit(tx, {
      userId: input.userId,
      action: "pay",
      tableName: "expenses",
      recordId: expense.id,
      before: expense,
      after: updated,
    });
    return updated;
  });
}

/** Koreksi pengeluaran: void + alasan; bila sudah dibayar dibuat pembalik kas. */
export async function voidExpense(input: {
  expenseId: string;
  reason: string;
  userId: string;
}) {
  if (!input.reason || input.reason.trim().length < 5) throw new Error("Alasan void wajib diisi.");
  const expense = await prisma.expense.findUnique({ where: { id: input.expenseId } });
  if (!expense) throw new Error("Pengeluaran tidak ditemukan.");
  if (expense.status === "dibatalkan") throw new Error("Pengeluaran sudah dibatalkan.");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.expense.update({
      where: { id: expense.id },
      data: { status: "dibatalkan", voidReason: input.reason },
    });
    if (expense.status === "dibayar") {
      await tx.cashLedger.create({
        data: {
          tanggal: todayDateOnly(),
          tipe: "masuk",
          akun: expense.sumberDana,
          nominal: expense.nominal,
          sumberType: "expense",
          sumberId: expense.id,
          keterangan: `Pembalik void pengeluaran: ${expense.keterangan}`,
          isReversal: true,
        },
      });
    }
    await writeAudit(tx, {
      userId: input.userId,
      action: "void",
      tableName: "expenses",
      recordId: expense.id,
      before: expense,
      after: updated,
      reason: input.reason,
    });
    return updated;
  });
}

/** Draft pengeluaran rutin H-3 (idempoten per periode). */
export async function generateRecurringDrafts(now = new Date()) {
  const today = todayDateOnly(now);
  const recents = await prisma.recurringExpense.findMany({
    where: { isActive: true },
    include: { category: true },
  });
  const created: string[] = [];

  for (const rec of recents) {
    const dueThisMonth = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), rec.tanggalBayar),
    );
    let due = dueThisMonth;
    let startReminder = addDays(due, -3);
    if (today > due) {
      // Jika tanggal bayar sudah lewat, siapkan untuk bulan berikutnya.
      due = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, rec.tanggalBayar));
      startReminder = addDays(due, -3);
    }
    if (today < startReminder) continue;

    const { start, endExclusive } = monthRange(monthKey(due));
    const existing = await prisma.expense.findFirst({
      where: {
        recurringExpenseId: rec.id,
        tanggal: { gte: start, lt: endExclusive },
        status: { not: "dibatalkan" },
      },
    });
    if (existing) continue;

    const expense = await prisma.expense.create({
      data: {
        tanggal: due,
        categoryId: rec.categoryId,
        nominal: rec.nominal,
        penerima: rec.penerima,
        sumberDana: rec.sumberDana,
        keterangan: `${rec.keterangan} (rutin ${monthKey(due)})`,
        status: "diajukan",
        recurringExpenseId: rec.id,
      },
    });
    await prisma.recurringExpense.update({
      where: { id: rec.id },
      data: { lastDraftAt: new Date() },
    });
    created.push(expense.id);

    const financeUsers = await prisma.user.findMany({
      where: { role: { in: ["keuangan", "owner"] }, isActive: true },
      select: { email: true },
    });
    for (const u of financeUsers) {
      if (!u.email) continue;
      await sendNotification({
        tujuan: u.email,
        channel: "email",
        template: "pengeluaran_rutin",
        payload: { recurringExpenseId: rec.id },
        text: templates.pengeluaranRutin({
          keterangan: rec.keterangan,
          nominal: rec.nominal,
          tanggalBayar: formatDate(due),
        }),
      });
    }
  }

  return { created: created.length, expenseIds: created };
}
