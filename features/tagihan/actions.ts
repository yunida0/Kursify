"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { execute, fail, ok, type ActionResult } from "@/lib/action";
import { formNumber, formOptionalString, formString } from "@/lib/form";
import { createInvoiceTx, generateSppForMonth, issueInvoice, applyDiscount, adjustLateFee } from "@/lib/services/invoices";
import { dateOnly } from "@/lib/dates";

export async function createManualInvoiceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("keuangan", "owner");
    const studentId = formString(formData, "studentId");
    const jenis = formString(formData, "jenis");
    const nominal = formNumber(formData, "nominal");
    const jatuhTempo = formString(formData, "jatuhTempo");
    if (!["pendaftaran", "spp", "paket", "lain"].includes(jenis)) return fail("Jenis tagihan tidak valid.");
    if (nominal <= 0) return fail("Nominal tagihan harus lebih dari 0.");
    if (!jatuhTempo) return fail("Jatuh tempo wajib diisi.");

    const invoice = await prisma.$transaction((tx) =>
      createInvoiceTx(tx, {
        studentId,
        enrollmentId: formOptionalString(formData, "enrollmentId"),
        jenis: jenis as "pendaftaran" | "spp" | "paket" | "lain",
        periode: formOptionalString(formData, "periode"),
        nominal,
        jatuhTempo: dateOnly(jatuhTempo),
        catatan: formOptionalString(formData, "catatan"),
        userId: user.id,
      }),
    );
    await issueInvoice(invoice.id);

    revalidatePath("/keuangan/tagihan");
    revalidatePath("/keuangan");
    return ok(`Tagihan ${invoice.invoiceNo} berhasil diterbitkan.`);
  });
}

export async function generateSppAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("keuangan", "owner");
    const periode = formString(formData, "periode");
    const result = await generateSppForMonth(periode, user.id);
    revalidatePath("/keuangan/tagihan");
    revalidatePath("/keuangan");
    return ok(`${result.created} tagihan SPP periode ${periode} dibuat.`);
  });
}

export async function applyDiscountAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("owner");
    const invoiceId = formString(formData, "invoiceId");
    const nominal = formNumber(formData, "nominal");
    const jenis = formString(formData, "jenis");
    if (!["saudara", "beasiswa", "lain"].includes(jenis)) return fail("Jenis potongan tidak valid.");
    await applyDiscount({
      invoiceId,
      jenis: jenis as "saudara" | "beasiswa" | "lain",
      nominal,
      alasan: formString(formData, "reason") || "Potongan dari Owner",
      ownerId: user.id,
    });
    revalidatePath("/owner/potongan");
    revalidatePath(`/keuangan/tagihan/${invoiceId}`);
    revalidatePath("/keuangan/tagihan");
    return ok("Potongan berhasil diterapkan.");
  });
}

export async function adjustLateFeeAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("owner");
    const invoiceId = formString(formData, "invoiceId");
    const nominal = formNumber(formData, "nominal");
    await adjustLateFee({
      invoiceId,
      nominalDendaBaru: nominal,
      alasan: formString(formData, "reason") || "Penyesuaian denda oleh Owner",
      ownerId: user.id,
    });
    revalidatePath("/owner/potongan");
    revalidatePath(`/keuangan/tagihan/${invoiceId}`);
    revalidatePath("/keuangan/tagihan");
    return ok("Denda berhasil disesuaikan.");
  });
}
