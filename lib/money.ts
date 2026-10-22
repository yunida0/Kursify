export function formatRupiah(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("id-ID").format(Number(value ?? 0));
}

/** Terima "1.250.000", "1250000", "Rp 1.250.000" -> 1250000 */
export function parseRupiah(value: string | number | null | undefined): number {
  if (typeof value === "number") return Math.round(value);
  if (!value) return 0;
  const digits = String(value).replace(/[^\d-]/g, "");
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}
