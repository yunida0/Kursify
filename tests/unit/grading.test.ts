import { describe, expect, it } from "vitest";
import {
  averageScore,
  canIssueCertificate,
  formatNilai,
  gradeForAverage,
  isPassing,
  round2,
} from "@/lib/rules/grading";

describe("grading rules", () => {
  it("menghitung rata-rata dua desimal tanpa pembulatan ke bilangan bulat", () => {
    expect(averageScore([93, 92, 92, 90])).toBe(91.75);
    expect(averageScore([])).toBe(0);
    expect(round2(66.666)).toBe(66.67);
  });

  it("memetakan nilai ke huruf dan predikat", () => {
    expect(gradeForAverage(90)).toEqual({ huruf: "A", predikat: "Sangat Memuaskan" });
    expect(gradeForAverage(89.99)).toEqual({ huruf: "B", predikat: "Memuaskan" });
    expect(gradeForAverage(80)).toEqual({ huruf: "B", predikat: "Memuaskan" });
    expect(gradeForAverage(70)).toEqual({ huruf: "C", predikat: "Cukup" });
    expect(gradeForAverage(40)).toEqual({ huruf: "D", predikat: "Kurang" });
    expect(gradeForAverage(39.99)).toEqual({ huruf: "E", predikat: "Tidak Lulus" });
  });

  it("menilai kelulusan dengan batas minimal", () => {
    expect(isPassing(70)).toBe(true);
    expect(isPassing(69.99)).toBe(false);
    expect(isPassing(65, 60)).toBe(true);
  });

  it("menyatakan layak bila nilai lengkap, lulus, hadir cukup, dan siswa aktif", () => {
    const result = canIssueCertificate({
      jumlahNilai: 4,
      jumlahMateri: 4,
      rataRata: 91.75,
      kehadiranPersen: 87.5,
      statusSiswa: "aktif",
    });
    expect(result).toEqual({ eligible: true, reasons: [] });
  });

  it("menolak sertifikat bila syarat belum terpenuhi", () => {
    const result = canIssueCertificate({
      jumlahNilai: 2,
      jumlahMateri: 4,
      rataRata: 65,
      kehadiranPersen: 60,
      statusSiswa: "ditangguhkan",
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toHaveLength(4);
    expect(result.reasons.join(" ")).toContain("nilai materi");
    expect(result.reasons.join(" ")).toContain("batas lulus");
    expect(result.reasons.join(" ")).toContain("Kehadiran");
    expect(result.reasons.join(" ")).toContain("ditangguhkan");
  });

  it("memformat nilai dengan koma Indonesia", () => {
    expect(formatNilai(91.75)).toBe("91,75");
    expect(formatNilai(90)).toBe("90,00");
  });
});
