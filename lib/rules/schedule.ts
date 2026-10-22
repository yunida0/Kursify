export interface ScheduleLite {
  id?: string;
  hari: number;
  jamMulai: string;
  jamSelesai: string;
  roomId: string;
  tutorId: string;
  kodeKelas?: string;
}

export interface Conflict {
  type: "ruangan" | "tutor";
  message: string;
  jadwal: ScheduleLite;
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Interval beririsan bila mulai < selesai lawan dan selesai > mulai lawan. */
export function timesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(aEnd) > toMinutes(bStart);
}

/** hari: 1=Senin ... 7=Minggu (DateTime disimpan UTC tengah malam). */
export function jsDayToHari(day: number): number {
  return day === 0 ? 7 : day;
}

export function generateSessionDates(input: {
  tanggalMulai: Date;
  tanggalSelesai: Date;
  schedules: { hari: number }[];
}): Date[] {
  const dates: Date[] = [];
  const days = new Set(input.schedules.map((s) => s.hari));
  const cursor = new Date(input.tanggalMulai.getTime());
  const end = input.tanggalSelesai.getTime();
  while (cursor.getTime() <= end) {
    if (days.has(jsDayToHari(cursor.getUTCDay()))) {
      dates.push(new Date(cursor.getTime()));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function findConflicts(
  candidate: ScheduleLite,
  existing: ScheduleLite[],
): Conflict[] {
  const conflicts: Conflict[] = [];
  for (const e of existing) {
    if (e.id && candidate.id && e.id === candidate.id) continue;
    if (e.hari !== candidate.hari) continue;
    if (!timesOverlap(candidate.jamMulai, candidate.jamSelesai, e.jamMulai, e.jamSelesai))
      continue;
    if (e.roomId === candidate.roomId) {
      conflicts.push({
        type: "ruangan",
        message: `Ruangan sudah dipakai kelas ${e.kodeKelas ?? ""} pada ${candidate.jamMulai}-${candidate.jamSelesai}.`,
        jadwal: e,
      });
    }
    if (e.tutorId === candidate.tutorId) {
      conflicts.push({
        type: "tutor",
        message: `Tutor sudah mengajar kelas ${e.kodeKelas ?? ""} pada ${candidate.jamMulai}-${candidate.jamSelesai}.`,
        jadwal: e,
      });
    }
  }
  return conflicts;
}

/** Validasi bentrok untuk sesi yang akan digeser/disusulkan. */
export function sessionsOverlap(
  a: { tanggal: Date; jamMulai: string; jamSelesai: string },
  b: { tanggal: Date; jamMulai: string; jamSelesai: string },
): boolean {
  const sameDay =
    a.tanggal.getUTCFullYear() === b.tanggal.getUTCFullYear() &&
    a.tanggal.getUTCMonth() === b.tanggal.getUTCMonth() &&
    a.tanggal.getUTCDate() === b.tanggal.getUTCDate();
  return (
    sameDay && timesOverlap(a.jamMulai, a.jamSelesai, b.jamMulai, b.jamSelesai)
  );
}
