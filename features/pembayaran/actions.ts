"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/guard";
import { execute, fail, ok, type ActionResult } from "@/lib/action";
import { formFile, formNumber, formOptionalString, formString } from "@/lib/form";
import { saveUploadedFile } from "@/lib/uploads";
import { recordPayment, voidPayment } from "@/lib/services/payments";

export async function recordPaymentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("keuangan", "owner");
    const invoiceId = formString(formData, "invoiceId");
    const nominal = formNumber(formData, "nominal");
    const metode = formString(formData, "metode");
    const tanggal = formString(formData, "tanggal");

    let buktiPath: string | null = null;
    const bukti = formFile(formData, "bukti");
    if (bukti) buktiPath = await saveUploadedFile(bukti, "pembayaran");

    const result = await recordPayment({
      invoiceId,
      nominal,
      metode: metode as "tunai" | "transfer" | "qris",
      tanggal,
      noReferensi: formOptionalString(formData, "noReferensi"),
      buktiPath,
      userId: user.id,
    });

    revalidatePath("/keuangan/tagihan");
    revalidatePath(`/keuangan/tagihan/${invoiceId}`);
    revalidatePath("/keuangan/pembayaran");
    revalidatePath("/keuangan");
    revalidatePath("/keuangan/buku-kas");
    return ok(
      `Pembayaran dicatat. Kuitansi ${result.receipt.receiptNo} berhasil diterbitkan.`,
      `/keuangan/tagihan/${invoiceId}`,
    );
  });
}

export async function voidPaymentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("keuangan", "owner");
    const paymentId = formString(formData, "paymentId");
    const reason = formString(formData, "reason");
    const result = await voidPayment({ paymentId, reason, userId: user.id });
    revalidatePath("/keuangan/tagihan");
    revalidatePath(`/keuangan/tagihan/${result.invoice.id}`);
    revalidatePath("/keuangan/buku-kas");
    revalidatePath("/keuangan");
    return ok("Pembayaran di-void dan entri pembalik telah dibuat.");
  });
}
