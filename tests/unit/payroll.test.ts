import { describe, expect, it } from "vitest";
import {
  calculatePayroll,
  eligibleSessionsForTutor,
  feeSchemeForPeriod,
  type PayrollSessionLite,
} from "@/lib/rules/payroll";

const baseSession: PayrollSessionLite = {
  id: "s1",
  classId: "c1",
  kodeKelas: "ENG-A1",
  tutorId: "t1",
  status: "selesai",
  tutorAttendanceStatus: "hadir",
};

describe("payroll rules", () => {
  it("memilih tarif terbaru yang berlaku pada periode", () => {
    const schemes = [
      { skema: "per_sesi", tarif: 50_000, berlakuMulai: "2026-01-01" },
      { skema: "per_sesi", tarif: 60_000, berlakuMulai: "2026-06-01" },
      { skema: "per_sesi", tarif: 75_000, berlakuMulai: "2026-12-01" },
    ];
    expect(feeSchemeForPeriod(schemes, "2026-05")?.tarif).toBe(50_000);
    expect(feeSchemeForPeriod(schemes, "2026-06")?.tarif).toBe(60_000);
    expect(feeSchemeForPeriod(schemes, "2026-11")?.tarif).toBe(60_000);
    expect(feeSchemeForPeriod(schemes, "2025-12")).toBeNull();
  });

  it("hanya menghitung sesi selesai dengan tutor hadir atau pengganti", () => {
    const sessions: PayrollSessionLite[] = [
      baseSession,
      { ...baseSession, id: "s2", tutorAttendanceStatus: "tidak_hadir" },
      { ...baseSession, id: "s3", status: "terjadwal" },
      { ...baseSession, id: "s4", status: "dibatalkan" },
      { ...baseSession, id: "s5", tutorId: "t9", penggantiTutorId: "t1", tutorAttendanceStatus: null },
    ];
    const eligible = eligibleSessionsForTutor("t1", sessions);
    expect(eligible.map((s) => s.id)).toEqual(["s1", "s5"]);
  });

  it("menghitung honor per sesi dan mengelompokkan per kelas", () => {
    const result = calculatePayroll({
      tutorId: "t1",
      skema: "per_sesi",
      tarif: 50_000,
      sessions: [
        baseSession,
        { ...baseSession, id: "s2", classId: "c2", kodeKelas: "MATH-A1" },
        { ...baseSession, id: "s3" },
      ],
    });
    expect(result.jumlahSesi).toBe(3);
    expect(result.total).toBe(150_000);
    expect(result.perClass).toEqual([
      { classId: "c1", kodeKelas: "ENG-A1", jumlah: 2 },
      { classId: "c2", kodeKelas: "MATH-A1", jumlah: 1 },
    ]);
  });

  it("skema bulanan tetap dibayar penuh walau sesi sedikit", () => {
    const result = calculatePayroll({
      tutorId: "t1",
      skema: "bulanan_tetap",
      tarif: 1_000_000,
      sessions: [baseSession],
    });
    expect(result.jumlahSesi).toBe(1);
    expect(result.total).toBe(1_000_000);
  });

  it("tidak menghitung sesi tutor lain tanpa penugasan pengganti", () => {
    const result = calculatePayroll({
      tutorId: "t2",
      skema: "per_sesi",
      tarif: 50_000,
      sessions: [baseSession],
    });
    expect(result.jumlahSesi).toBe(0);
    expect(result.total).toBe(0);
  });
});
