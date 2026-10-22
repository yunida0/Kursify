import { diffCalendarDays } from "@/lib/dates";

export const MAX_VALID_PAYMENTS = 2;

export type InvoiceStatus =
  | "belum_dibayar"
  | "dibayar_sebagian"
  | "lunas"
  | "menunggak"
  | "void";

export interface PaymentLite {
  nominal: number;
  status: string;
}

/** total = nominal − potongan + denda */
export function calcInvoiceTotal(input: {
  nominal: number;
  potongan?: number;
  denda?: number;
}): number {
  return Math.max(0, input.nominal - (input.potongan ?? 0) + (input.denda ?? 0));
}

export function summarizePayments(payments: PaymentLite[]) {
  const valid = payments.filter((p) => p.status === "valid");
  return {
    paid: valid.reduce((sum, p) => sum + p.nominal, 0),
    validCount: valid.length,
  };
}

/**
 * Status tagihan dihitung dari total, pembayaran valid, dan jatuh tempo.
 * `denda` yang sudah tersimpan di total ikut dihitung.
 */
export function determineInvoiceStatus(input: {
  total: number;
  paid: number;
  validCount: number;
  jatuhTempo: Date;
  today: Date;
  isVoid?: boolean;
}): InvoiceStatus {
  if (input.isVoid) return "void";
  if (input.paid >= input.total) return "lunas";
  if (diffCalendarDays(input.today, input.jatuhTempo) > 0) return "menunggak";
  if (input.validCount > 0 || input.paid > 0) return "dibayar_sebagian";
  return "belum_dibayar";
}

export interface PaymentCheck {
  ok: boolean;
  error?: string;
}

/** Validasi cicilan: maksimal 2 pembayaran valid, tidak boleh melebihi sisa. */
export function canAcceptPayment(input: {
  total: number;
  paid: number;
  validCount: number;
  amount: number;
}): PaymentCheck {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: "Nominal pembayaran harus lebih dari 0." };
  }
  if (input.validCount >= MAX_VALID_PAYMENTS) {
    return {
      ok: false,
      error: `Tagihan ini sudah memiliki ${MAX_VALID_PAYMENTS} pembayaran valid. Void pembayaran lama terlebih dahulu.`,
    };
  }
  if (input.paid + input.amount > input.total) {
    return {
      ok: false,
      error: `Nominal melebihi sisa tagihan (sisa Rp${(input.total - input.paid).toLocaleString("id-ID")}).`,
    };
  }
  return { ok: true };
}

/** Denda hanya ditambahkan sekali, saat tagihan pertama kali menunggak. */
export function lateFeeToApply(input: {
  status: InvoiceStatus;
  menunggakSejak: Date | null;
  jatuhTempo: Date;
  today: Date;
  denda: number;
}): number {
  const overdue = diffCalendarDays(input.today, input.jatuhTempo) > 0;
  if (!overdue) return 0;
  if (input.status === "lunas" || input.status === "void") return 0;
  if (input.menunggakSejak) return 0;
  return Math.max(0, input.denda);
}

/** Menunggak lebih dari N hari sejak jatuh tempo -> siswa ditangguhkan. */
export function isSuspensionDue(input: {
  jatuhTempo: Date;
  today: Date;
  batasHari?: number;
}): boolean {
  return diffCalendarDays(input.today, input.jatuhTempo) > (input.batasHari ?? 14);
}

export function isInvoiceOverdue(jatuhTempo: Date, today: Date): boolean {
  return diffCalendarDays(today, jatuhTempo) > 0;
}

/** Persentase tagihan yang sudah dibayar (untuk progress bar). */
export function paymentProgress(total: number, paid: number): number {
  if (total <= 0) return 100;
  return Math.min(100, Math.round((paid / total) * 100));
}
