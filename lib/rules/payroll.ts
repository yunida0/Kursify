export interface FeeScheme {
  skema: string;
  tarif: number;
  berlakuMulai: string;
}

/** Tarif yang berlaku: baris terbaru dengan berlaku_mulai <= periode. */
export function feeSchemeForPeriod(
  schemes: FeeScheme[],
  periode: string,
): FeeScheme | null {
  const applicable = schemes
    .filter((s) => s.berlakuMulai.slice(0, 7) <= periode)
    .sort((a, b) => (a.berlakuMulai < b.berlakuMulai ? 1 : -1));
  return applicable[0] ?? null;
}

export interface PayrollSessionLite {
  id: string;
  classId: string;
  kodeKelas?: string;
  tanggal?: Date;
  tutorId: string;
  penggantiTutorId?: string | null;
  status: string;
  tutorAttendanceStatus?: string | null;
}

export interface PayrollResult {
  jumlahSesi: number;
  total: number;
  sessionIds: string[];
  perClass: { classId: string; kodeKelas: string; jumlah: number }[];
}

/**
 * Sesi dihitung bila: status selesai DAN
 * - tutor asli hadir, atau
 * - tutor tersebut menjadi pengganti (penggantiTutorId).
 * Sesi dibatalkan tidak pernah dihitung.
 */
export function eligibleSessionsForTutor(
  tutorId: string,
  sessions: PayrollSessionLite[],
): PayrollSessionLite[] {
  return sessions.filter((s) => {
    if (s.status !== "selesai") return false;
    if (s.penggantiTutorId === tutorId) return true;
    if (s.tutorId === tutorId && s.tutorAttendanceStatus === "hadir") return true;
    return false;
  });
}

export function calculatePayroll(input: {
  tutorId: string;
  skema: string;
  tarif: number;
  sessions: PayrollSessionLite[];
}): PayrollResult {
  const eligible = eligibleSessionsForTutor(input.tutorId, input.sessions);
  const jumlahSesi = eligible.length;
  const total =
    input.skema === "bulanan_tetap" ? input.tarif : jumlahSesi * input.tarif;

  const map = new Map<string, { classId: string; kodeKelas: string; jumlah: number }>();
  for (const s of eligible) {
    const existing = map.get(s.classId);
    if (existing) existing.jumlah++;
    else
      map.set(s.classId, {
        classId: s.classId,
        kodeKelas: s.kodeKelas ?? s.classId,
        jumlah: 1,
      });
  }

  return {
    jumlahSesi,
    total,
    sessionIds: eligible.map((s) => s.id),
    perClass: Array.from(map.values()),
  };
}
