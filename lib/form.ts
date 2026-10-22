import { parseRupiah } from "@/lib/money";

export function formString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export function formOptionalString(formData: FormData, key: string): string | null {
  const value = formString(formData, key);
  return value.length > 0 ? value : null;
}

export function formNumber(formData: FormData, key: string): number {
  return parseRupiah(formString(formData, key));
}

export function formInt(formData: FormData, key: string): number {
  const n = Number(formString(formData, key));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export function formBoolean(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true" || value === "1";
}

export function formFile(formData: FormData, key: string): File | null {
  const value = formData.get(key);
  if (value instanceof File && value.size > 0) return value;
  return null;
}

export function formDate(formData: FormData, key: string): string {
  return formString(formData, key);
}
