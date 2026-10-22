import {
  addDays as addDaysFns,
  differenceInCalendarDays,
  format,
  startOfDay,
} from "date-fns";
import { id as localeId } from "date-fns/locale";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

export const TZ = "Asia/Jakarta";

/** Tanggal hari ini di WIB dalam format yyyy-MM-dd */
export function wibTodayStr(now: Date = new Date()): string {
  return formatInTimeZone(now, TZ, "yyyy-MM-dd");
}

/** Komponen tanggal WIB */
export function wibParts(now: Date = new Date()) {
  const zoned = toZonedTime(now, TZ);
  return {
    year: zoned.getFullYear(),
    month: zoned.getMonth() + 1,
    day: zoned.getDate(),
    hour: zoned.getHours(),
    minute: zoned.getMinutes(),
  };
}

/**
 * Normalisasi tanggal kalender menjadi UTC tengah malam.
 * Dipakai konsisten untuk tanggal sesi, jatuh tempo, tanggal lahir.
 */
export function dateOnly(value: Date | string): Date {
  if (typeof value === "string") {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    const d = new Date(value);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

/** Tanggal hari ini (WIB) sebagai UTC midnight, untuk perbandingan tanggal kalender */
export function todayDateOnly(now: Date = new Date()): Date {
  return dateOnly(wibTodayStr(now));
}

export function addDays(date: Date, days: number): Date {
  return addDaysFns(dateOnly(date), days);
}

export function diffCalendarDays(a: Date, b: Date): number {
  return differenceInCalendarDays(dateOnly(a), dateOnly(b));
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "-";
  return formatInTimeZone(d, TZ, "dd MMM yyyy", { locale: localeId });
}

export function formatDateLong(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "-";
  return formatInTimeZone(d, TZ, "dd MMMM yyyy", { locale: localeId });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "-";
  return formatInTimeZone(d, TZ, "dd MMM yyyy HH:mm", { locale: localeId });
}

export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  if (typeof date === "string" && /^\d{1,2}:\d{2}/.test(date)) {
    return date.slice(0, 5).padStart(5, "0");
  }
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "-";
  return formatInTimeZone(d, TZ, "HH:mm");
}

export function dateInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return formatInTimeZone(d, TZ, "yyyy-MM-dd");
}

export function monthKey(date: Date | string = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatInTimeZone(d, TZ, "yyyy-MM");
}

export function monthRange(periode: string): { start: Date; endExclusive: Date } {
  const [y, m] = periode.split("-").map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, 1)),
    endExclusive: new Date(Date.UTC(y, m, 1)),
  };
}

export function monthLabel(periode: string): string {
  if (!/^\d{4}-\d{2}$/.test(periode)) return periode;
  const [y, m] = periode.split("-").map(Number);
  return format(new Date(Date.UTC(y, m - 1, 1)), "MMMM yyyy", { locale: localeId });
}

export const ROMAN_MONTHS = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
];

export function romanMonth(date: Date): string {
  return ROMAN_MONTHS[Number(formatInTimeZone(date, TZ, "M")) - 1];
}

export function previousMonthKey(now: Date = new Date()): string {
  const p = wibParts(now);
  const d = new Date(Date.UTC(p.year, p.month - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return dateOnly(a).getTime() === dateOnly(b).getTime();
}

export function sessionEndDateTime(session: {
  tanggal: Date;
  jamSelesai: string;
}): Date {
  const tanggal = formatInTimeZone(session.tanggal, TZ, "yyyy-MM-dd");
  return new Date(`${tanggal}T${session.jamSelesai}:00+07:00`);
}

export function formatDayName(hari: number): string {
  return ["", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"][hari] ?? "-";
}

export function startOfTodayWib(now: Date = new Date()): Date {
  return startOfDay(toZonedTime(now, TZ));
}

export function periodOptions(count = 18, now: Date = new Date()): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const p = wibParts(now);
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(p.year, p.month - 1 - i, 1));
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    options.push({ value, label: monthLabel(value) });
  }
  return options;
}
