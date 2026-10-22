import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function truncate(value: string, length = 60): string {
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Terjadi kesalahan. Silakan coba lagi.";
}

export function hitungUmur(tanggalLahir: Date | null | undefined, now = new Date()): number | null {
  if (!tanggalLahir) return null;
  const d = new Date(tanggalLahir);
  let age = now.getFullYear() - d.getUTCFullYear();
  const m = now.getMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getUTCDate())) age--;
  return age;
}
