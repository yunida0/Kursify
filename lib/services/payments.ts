import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { dateOnly, todayDateOnly } from "@/lib/dates";
import { nextReceiptNumber } from "@/lib/numbering";
import { canAcceptPayment, determineInvoiceStatus, summarizePayments } from "@/lib/rules/invoice";
import { sendNotification } from "@/lib/notify";
import { templates } from "@/lib/notify/templates";
import { syncStudentSuspensionTx } from "./invoices";

export interface RecordPaymentInput {
  invoiceId: string;
  nominal: number;
  metode: "tunai" | "transfer" | "qris";
  tanggal: string;
  noReferensi?: string | null;
  buktiPath?: string | null;
  userId: string;
}

/**
 * Mencatat pembayaran + kuitansi + entri buku kas dalam satu transaksi.
 * Baris tagihan dikunci agar dua pembayaran paralel tidak melewati batas cicilan.
 */
export async function recordPayment(input: RecordPaymentInput) {
  if (!["tunai", "transfer", "qris"].includes(input.metode)) {
    throw new Error("Metode pembayaran tidak valid.");
  }
  if (input.metode !== "tunai" && !input.noReferensi && !input.buktiPath) {
    throw new Error("Pembayaran non-tunai wajib mengisi nomor referensi atau bukti transfer.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM invoices WHERE id = ${input.invoiceId} FOR UPDATE
    `;
    if (locked.length === 0) throw new Error("Tagihan tidak ditemukan.");

    const invoice = await tx.invoice.findUnique({
      where: { id: input.invoiceId },
      include: { payments: true, student: true },
    });
    if (!invoice) throw new Error("Tagihan tidak ditemukan.");
    if (invoice.status === "void") throw new Error("Tagihan sudah dibatalkan.");
    if (invoice.total <= 0) throw new Error("Tagihan ini tidak memerlukan pembayaran.");

    const { paid, validCount } = summarizePayments(invoice.payments);
    const check = canAcceptPayment({
      total: invoice.total,
      paid,
      validCount,
      amount: input.nominal,
    });
    if (!check.ok) throw new Error(check.error);

    const payment = await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        tanggal: dateOnly(input.tanggal),
        nominal: input.nominal,
        metode: input.metode,
        noReferensi: input.noReferensi || null,
        buktiPath: input.buktiPath || null,
        receivedBy: input.userId,
        status: "valid",
      },
    });

    const receiptNo = await nextReceiptNumber(tx, dateOnly(input.tanggal));
    const receipt = await tx.receipt.create({
      data: {
        paymentId: payment.id,
        receiptNo,
        issuedAt: new Date(),
        pdfPath: `/api/pdf/kuitansi/${payment.id}`,
      },
    });

    const paidBaru = paid + input.nominal;
    const status = determineInvoiceStatus({
      total: invoice.total,
      paid: paidBaru,
      validCount: validCount + 1,
      jatuhTempo: invoice.jatuhTempo,
      today: todayDateOnly(),
    });
    const updatedInvoice = await tx.invoice.update({
      where: { id: invoice.id },
      data: { status },
    });

    await tx.cashLedger.create({
      data: {
        tanggal: dateOnly(input.tanggal),
        tipe: "masuk",
        akun: input.metode === "tunai" ? "kas_tunai" : "rekening_bank",
        nominal: input.nominal,
        sumberType: "payment",
        sumberId: payment.id,
        keterangan: `Pembayaran ${invoice.invoiceNo} (${receipt.receiptNo})`,
      },
    });

    await writeAudit(tx, {
      userId: input.userId,
      action: "create",
      tableName: "payments",
      recordId: payment.id,
      after: { ...payment, receiptNo },
    });

    if (status === "lunas") {
      await syncStudentSuspensionTx(tx, invoice.studentId);
      await writeAudit(tx, {
        userId: input.userId,
        action: "update",
        tableName: "invoices",
        recordId: invoice.id,
        before: { status: invoice.status },
        after: { status },
        reason: "Tagihan lunas",
      });
    }

    return {
      payment,
      receipt,
      invoice: updatedInvoice,
      student: invoice.student,
      sisa: invoice.total - paidBaru,
    };
  });

  await sendNotification({
    tujuan: result.student.noWaWali || result.student.noWa,
    template: "pembayaran_diterima",
    invoiceId: result.invoice.id,
    payload: {
      receiptNo: result.receipt.receiptNo,
      nominal: result.payment.nominal,
      pdf: result.receipt.pdfPath,
    },
    text: templates.pembayaranDiterima({
      nama: result.student.nama,
      receiptNo: result.receipt.receiptNo,
      nominal: result.payment.nominal,
      invoiceNo: result.invoice.invoiceNo,
    }),
  });

  return result;
}

/** Void pembayaran: kuitansi tetap tersimpan, entri pembalik masuk buku kas. */
export async function voidPayment(input: {
  paymentId: string;
  reason: string;
  userId: string;
}) {
  if (!input.reason || input.reason.trim().length < 5) {
    throw new Error("Alasan void wajib diisi (minimal 5 karakter).");
  }

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: input.paymentId },
      include: { invoice: true, receipt: true },
    });
    if (!payment) throw new Error("Pembayaran tidak ditemukan.");
    if (payment.status === "void") throw new Error("Pembayaran sudah di-void.");

    const voided = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "void",
        voidReason: input.reason,
        voidBy: input.userId,
        voidAt: new Date(),
      },
    });

    await tx.cashLedger.create({
      data: {
        tanggal: todayDateOnly(),
        tipe: "keluar",
        akun: payment.metode === "tunai" ? "kas_tunai" : "rekening_bank",
        nominal: payment.nominal,
        sumberType: "payment",
        sumberId: payment.id,
        keterangan: `Pembalik void ${payment.receipt?.receiptNo ?? "pembayaran"}`,
        isReversal: true,
      },
    });

    const remaining = await tx.payment.findMany({
      where: { invoiceId: payment.invoiceId },
    });
    const { paid, validCount } = summarizePayments(remaining);
    const status = determineInvoiceStatus({
      total: payment.invoice.total,
      paid,
      validCount,
      jatuhTempo: payment.invoice.jatuhTempo,
      today: todayDateOnly(),
    });
    const invoice = await tx.invoice.update({
      where: { id: payment.invoiceId },
      data: { status },
    });

    await writeAudit(tx, {
      userId: input.userId,
      action: "void",
      tableName: "payments",
      recordId: payment.id,
      before: payment,
      after: voided,
      reason: input.reason,
    });

    return { payment: voided, invoice, sisa: payment.invoice.total - paid };
  });
}
