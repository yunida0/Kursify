import { describe, expect, it } from "vitest";
import {
  calcInvoiceTotal,
  canAcceptPayment,
  determineInvoiceStatus,
  isInvoiceOverdue,
  isSuspensionDue,
  lateFeeToApply,
  paymentProgress,
  summarizePayments,
} from "@/lib/rules/invoice";

const DAY = 86_400_000;
const today = new Date("2026-10-22T00:00:00.000Z");

describe("invoice rules", () => {
  it("menghitung total tagihan: nominal - potongan + denda", () => {
    expect(calcInvoiceTotal({ nominal: 500_000, potongan: 50_000, denda: 20_000 })).toBe(470_000);
    expect(calcInvoiceTotal({ nominal: 100_000 })).toBe(100_000);
  });

  it("tidak membiarkan total negatif", () => {
    expect(calcInvoiceTotal({ nominal: 100_000, potongan: 250_000 })).toBe(0);
  });

  it("meringkas hanya pembayaran valid", () => {
    const result = summarizePayments([
      { nominal: 150_000, status: "valid" },
      { nominal: 50_000, status: "valid" },
      { nominal: 100_000, status: "void" },
    ]);
    expect(result).toEqual({ paid: 200_000, validCount: 2 });
  });

  it("menentukan status lunas, menunggak, sebagian, dan belum dibayar", () => {
    const base = { total: 300_000, jatuhTempo: new Date(today.getTime() + 5 * DAY), today };
    expect(determineInvoiceStatus({ ...base, paid: 300_000, validCount: 1 })).toBe("lunas");
    expect(determineInvoiceStatus({ ...base, paid: 100_000, validCount: 1 })).toBe("dibayar_sebagian");
    expect(determineInvoiceStatus({ ...base, paid: 0, validCount: 0 })).toBe("belum_dibayar");
    expect(
      determineInvoiceStatus({
        ...base,
        jatuhTempo: new Date(today.getTime() - DAY),
        paid: 0,
        validCount: 0,
      }),
    ).toBe("menunggak");
    expect(determineInvoiceStatus({ ...base, paid: 0, validCount: 0, isVoid: true })).toBe("void");
  });

  it("membatasi maksimal dua pembayaran valid dan menolak kelebihan", () => {
    expect(
      canAcceptPayment({ total: 300_000, paid: 100_000, validCount: 1, amount: 100_000 }).ok,
    ).toBe(true);
    expect(
      canAcceptPayment({ total: 300_000, paid: 100_000, validCount: 2, amount: 100_000 }).ok,
    ).toBe(false);
    expect(
      canAcceptPayment({ total: 300_000, paid: 250_000, validCount: 1, amount: 100_000 }).error,
    ).toContain("melebihi sisa");
    expect(canAcceptPayment({ total: 300_000, paid: 0, validCount: 0, amount: 0 }).ok).toBe(false);
  });

  it("hanya menambahkan denda sekali saat pertama menunggak", () => {
    const jatuhTempo = new Date(today.getTime() - 3 * DAY);
    expect(
      lateFeeToApply({ status: "belum_dibayar", menunggakSejak: null, jatuhTempo, today, denda: 25_000 }),
    ).toBe(25_000);
    expect(
      lateFeeToApply({
        status: "menunggak",
        menunggakSejak: new Date(today.getTime() - DAY),
        jatuhTempo,
        today,
        denda: 25_000,
      }),
    ).toBe(0);
    expect(
      lateFeeToApply({ status: "lunas", menunggakSejak: null, jatuhTempo, today, denda: 25_000 }),
    ).toBe(0);
  });

  it("menandai penangguhan setelah lebih dari 14 hari", () => {
    const tempo = new Date(today.getTime() - 15 * DAY);
    expect(isSuspensionDue({ jatuhTempo: tempo, today })).toBe(true);
    expect(isSuspensionDue({ jatuhTempo: tempo, today, batasHari: 20 })).toBe(false);
    expect(isInvoiceOverdue(tempo, today)).toBe(true);
  });

  it("menghitung progres pembayaran", () => {
    expect(paymentProgress(400_000, 100_000)).toBe(25);
    expect(paymentProgress(400_000, 400_000)).toBe(100);
    expect(paymentProgress(0, 0)).toBe(100);
  });
});
