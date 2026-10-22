"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { execute, fail, ok, type ActionResult } from "@/lib/action";
import { formBoolean, formFile, formInt, formNumber, formOptionalString, formString } from "@/lib/form";
import { saveUploadedFile } from "@/lib/uploads";
import {
  approveExpense,
  createExpense,
  generateRecurringDrafts,
  payExpense,
  rejectExpense,
  voidExpense,
} from "@/lib/services/expenses";
import { writeAudit } from "@/lib/audit";

export async function createExpenseAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("keuangan", "owner");
    let buktiPath: string | null = null;
    const bukti = formFile(formData, "bukti");
    if (bukti) buktiPath = await saveUploadedFile(bukti, "pengeluaran");
    const langsungBayar = formBoolean(formData, "langsungBayar");

    const expense = await createExpense({
      tanggal: formString(formData, "tanggal"),
      categoryId: formString(formData, "categoryId"),
      nominal: formNumber(formData, "nominal"),
      penerima: formString(formData, "penerima"),
      sumberDana: formString(formData, "sumberDana") as "kas_tunai" | "rekening_bank",
      keterangan: formString(formData, "keterangan"),
      buktiPath,
      userId: user.id,
      langsungBayar,
    });

    revalidatePath("/keuangan/pengeluaran");
    revalidatePath("/keuangan");
    revalidatePath("/keuangan/buku-kas");
    revalidatePath("/owner/persetujuan");
    return ok(
      langsungBayar
        ? "Pengeluaran dicatat dan langsung dibayar."
        : "Pengeluaran diajukan. Menunggu persetujuan Owner.",
      `/keuangan/pengeluaran`,
    );
  });
}

export async function approveExpenseAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("owner");
    await approveExpense({ expenseId: formString(formData, "expenseId"), ownerId: user.id });
    revalidatePath("/owner/persetujuan");
    revalidatePath("/keuangan/pengeluaran");
    return ok("Pengeluaran disetujui. Staf Keuangan dapat melakukan pembayaran.");
  });
}

export async function rejectExpenseAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("owner");
    await rejectExpense({
      expenseId: formString(formData, "expenseId"),
      reason: formString(formData, "reason"),
      ownerId: user.id,
    });
    revalidatePath("/owner/persetujuan");
    revalidatePath("/keuangan/pengeluaran");
    return ok("Pengeluaran ditolak.");
  });
}

export async function payExpenseAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("keuangan", "owner");
    await payExpense({ expenseId: formString(formData, "expenseId"), userId: user.id });
    revalidatePath("/keuangan/pengeluaran");
    revalidatePath("/keuangan");
    revalidatePath("/keuangan/buku-kas");
    return ok("Pengeluaran dibayar dan dicatat di buku kas.");
  });
}

export async function voidExpenseAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("keuangan", "owner");
    await voidExpense({
      expenseId: formString(formData, "expenseId"),
      reason: formString(formData, "reason"),
      userId: user.id,
    });
    revalidatePath("/keuangan/pengeluaran");
    revalidatePath("/keuangan/buku-kas");
    revalidatePath("/keuangan");
    return ok("Pengeluaran dibatalkan.");
  });
}

export async function saveRecurringAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("keuangan", "owner");
    const id = formOptionalString(formData, "id");
    const tanggalBayar = formInt(formData, "tanggalBayar");
    if (tanggalBayar < 1 || tanggalBayar > 28) return fail("Tanggal bayar harus 1–28.");
    const data = {
      categoryId: formString(formData, "categoryId"),
      nominal: formNumber(formData, "nominal"),
      penerima: formString(formData, "penerima"),
      sumberDana: formString(formData, "sumberDana"),
      tanggalBayar,
      keterangan: formString(formData, "keterangan"),
      isActive: formBoolean(formData, "isActive"),
    };
    if (data.nominal <= 0) return fail("Nominal harus lebih dari 0.");
    if (!["kas_tunai", "rekening_bank"].includes(data.sumberDana)) return fail("Sumber dana tidak valid.");

    await prisma.$transaction(async (tx) => {
      const before = id ? await tx.recurringExpense.findUnique({ where: { id } }) : null;
      const recurring = id
        ? await tx.recurringExpense.update({ where: { id }, data })
        : await tx.recurringExpense.create({ data });
      await writeAudit(tx, {
        userId: user.id,
        action: id ? "update" : "create",
        tableName: "recurring_expenses",
        recordId: recurring.id,
        before,
        after: recurring,
      });
    });
    revalidatePath("/keuangan/pengeluaran-rutin");
    return ok("Pengeluaran rutin disimpan.");
  });
}

export async function toggleRecurringAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("keuangan", "owner");
    const id = formString(formData, "id");
    const recurring = await prisma.recurringExpense.findUnique({ where: { id } });
    if (!recurring) return fail("Data tidak ditemukan.");
    const updated = await prisma.recurringExpense.update({
      where: { id },
      data: { isActive: !recurring.isActive },
    });
    await prisma.$transaction((tx) =>
      writeAudit(tx, {
        userId: user.id,
        action: "update",
        tableName: "recurring_expenses",
        recordId: id,
        before: recurring,
        after: updated,
      }),
    );
    revalidatePath("/keuangan/pengeluaran-rutin");
    return ok(updated.isActive ? "Pengeluaran rutin diaktifkan." : "Pengeluaran rutin dinonaktifkan.");
  });
}

export async function generateRecurringAction(
  _prev: ActionResult | null,
  _formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    await requireRole("keuangan", "owner");
    const result = await generateRecurringDrafts();
    revalidatePath("/keuangan/pengeluaran");
    revalidatePath("/keuangan/pengeluaran-rutin");
    return ok(`${result.created} draft pengeluaran rutin dibuat.`);
  });
}
