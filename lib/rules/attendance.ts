export const ATTENDANCE_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export type AttendanceStatus = "hadir" | "izin" | "sakit" | "alpa";

export interface EditPermission {
  allowed: boolean;
  requiresReason: boolean;
  locked: boolean;
  error?: string;
}

/**
 * Tutor: maksimal 24 jam setelah jam selesai sesi.
 * Admin/Owner: boleh kapan saja; wajib alasan bila melewati 24 jam.
 * Sesi terkunci (honor sudah dibayar): hanya Owner, wajib alasan.
 */
export function canEditAttendance(input: {
  endsAt: Date;
  now: Date;
  role: string;
  locked: boolean;
}): EditPermission {
  const withinWindow =
    input.now.getTime() <= input.endsAt.getTime() + ATTENDANCE_EDIT_WINDOW_MS;

  if (input.locked && input.role !== "owner") {
    return {
      allowed: false,
      requiresReason: false,
      locked: true,
      error:
        "Absensi periode ini terkunci karena honor sudah dibayar. Hanya Owner yang dapat mengubah.",
    };
  }

  if (input.role === "tutor") {
    if (!withinWindow) {
      return {
        allowed: false,
        requiresReason: false,
        locked: input.locked,
        error:
          "Batas 24 jam pengisian absensi sudah lewat. Hubungi Admin untuk koreksi.",
      };
    }
    return { allowed: true, requiresReason: false, locked: false };
  }

  if (input.role === "admin" || input.role === "owner") {
    return {
      allowed: true,
      requiresReason: !withinWindow || input.locked,
      locked: input.locked,
    };
  }

  return { allowed: false, requiresReason: false, locked: input.locked, error: "Tidak berhak." };
}

/** hadir & alpa mengurangi saldo paket; izin & sakit tidak. */
export function packageBalanceDelta(status: AttendanceStatus): number {
  return status === "hadir" || status === "alpa" ? -1 : 0;
}

export function applyPackageDelta(
  saldo: number | null | undefined,
  status: AttendanceStatus,
): number | null {
  if (saldo === null || saldo === undefined) return null;
  return Math.max(0, saldo + packageBalanceDelta(status));
}

/** Jumlah alpa berturut-turut di akhir riwayat (urut kronologis). */
export function trailingAbsences(statuses: AttendanceStatus[]): number {
  let count = 0;
  for (let i = statuses.length - 1; i >= 0; i--) {
    if (statuses[i] !== "alpa") break;
    count++;
  }
  return count;
}

export const ABSENCE_ALERT_THRESHOLD = 3;

export function shouldNotifyConsecutiveAbsence(statuses: AttendanceStatus[]): boolean {
  return trailingAbsences(statuses) === ABSENCE_ALERT_THRESHOLD;
}

/** Persentase kehadiran = hadir ÷ sesi selesai × 100 */
export function attendancePercentage(hadir: number, totalSelesai: number): number {
  if (totalSelesai <= 0) return 0;
  return Math.round((hadir / totalSelesai) * 10000) / 100;
}

export function isAttendanceBelowMinimum(
  percentage: number,
  minimum = 75,
): boolean {
  return percentage < minimum;
}

export function canRecordForSession(input: {
  status: string;
  sessionDate: Date;
  today: Date;
}): { ok: boolean; error?: string } {
  if (input.status !== "terjadwal") {
    return { ok: false, error: "Absensi hanya dapat diisi untuk sesi berstatus terjadwal." };
  }
  const sameDay =
    input.sessionDate.getUTCFullYear() === input.today.getUTCFullYear() &&
    input.sessionDate.getUTCMonth() === input.today.getUTCMonth() &&
    input.sessionDate.getUTCDate() === input.today.getUTCDate();
  if (!sameDay) {
    return { ok: false, error: "Absensi hanya dapat diisi pada hari pelaksanaan sesi." };
  }
  return { ok: true };
}
