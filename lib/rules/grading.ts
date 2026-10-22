export const PREDIKAT = [
  { huruf: "A", min: 90, predikat: "Sangat Memuaskan" },
  { huruf: "B", min: 80, predikat: "Memuaskan" },
  { huruf: "C", min: 70, predikat: "Cukup" },
  { huruf: "D", min: 40, predikat: "Kurang" },
  { huruf: "E", min: 0, predikat: "Tidak Lulus" },
] as const;

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Rata-rata tanpa pembulatan ke bilangan bulat: 91,75 tetap 91,75. */
export function averageScore(values: number[]): number {
  if (values.length === 0) return 0;
  return round2(values.reduce((a, b) => a + b, 0) / values.length);
}

export function gradeForAverage(average: number): { huruf: string; predikat: string } {
  for (const p of PREDIKAT) {
    if (average >= p.min) return { huruf: p.huruf, predikat: p.predikat };
  }
  return { huruf: "E", predikat: "Tidak Lulus" };
}

export function isPassing(average: number, minLulus = 70): boolean {
  return average >= minLulus;
}

export function canIssueCertificate(input: {
  jumlahNilai: number;
  jumlahMateri: number;
  rataRata: number;
  kehadiranPersen: number;
  statusSiswa: string;
  minLulus?: number;
  minKehadiran?: number;
}): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (input.jumlahMateri <= 0) reasons.push("Program belum memiliki materi penilaian.");
  if (input.jumlahNilai < input.jumlahMateri)
    reasons.push("Masih ada nilai materi yang belum diinput.");
  if (!isPassing(input.rataRata, input.minLulus ?? 70))
    reasons.push(`Nilai rata-rata belum mencapai batas lulus (${input.minLulus ?? 70}).`);
  if (input.kehadiranPersen < (input.minKehadiran ?? 75))
    reasons.push(`Kehadiran ${input.kehadiranPersen}% di bawah syarat ${input.minKehadiran ?? 75}%.`);
  if (input.statusSiswa === "ditangguhkan")
    reasons.push("Siswa sedang ditangguhkan karena tunggakan.");

  return { eligible: reasons.length === 0, reasons };
}

/** Format nilai 2 desimal dengan koma Indonesia. */
export function formatNilai(value: number): string {
  return round2(value).toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
