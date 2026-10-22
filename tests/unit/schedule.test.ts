import { describe, expect, it } from "vitest";
import {
  findConflicts,
  generateSessionDates,
  jsDayToHari,
  sessionsOverlap,
  timesOverlap,
  toMinutes,
  type ScheduleLite,
} from "@/lib/rules/schedule";

describe("schedule rules", () => {
  it("mengubah jam menjadi menit", () => {
    expect(toMinutes("08:30")).toBe(510);
    expect(toMinutes("00:00")).toBe(0);
  });

  it("mendeteksi tumpang tindih waktu, bukan sekadar bersentuhan", () => {
    expect(timesOverlap("08:00", "10:00", "09:00", "11:00")).toBe(true);
    expect(timesOverlap("08:00", "10:00", "10:00", "12:00")).toBe(false);
    expect(timesOverlap("08:00", "10:00", "07:00", "08:00")).toBe(false);
    expect(timesOverlap("08:00", "10:00", "08:30", "09:30")).toBe(true);
  });

  it("memetakan hari JS ke hari Kursify (Senin=1, Minggu=7)", () => {
    expect(jsDayToHari(0)).toBe(7);
    expect(jsDayToHari(1)).toBe(1);
    expect(jsDayToHari(6)).toBe(6);
  });

  it("membuat tanggal sesi sesuai jadwal mingguan di rentang kelas", () => {
    const dates = generateSessionDates({
      tanggalMulai: new Date("2026-10-01T00:00:00.000Z"),
      tanggalSelesai: new Date("2026-10-15T00:00:00.000Z"),
      schedules: [{ hari: 4 }],
    });
    expect(dates.map((d) => d.toISOString().slice(0, 10))).toEqual([
      "2026-10-01",
      "2026-10-08",
      "2026-10-15",
    ]);
  });

  it("menemukan bentrok ruangan dan tutor", () => {
    const existing: ScheduleLite[] = [
      { id: "a", hari: 1, jamMulai: "08:00", jamSelesai: "10:00", roomId: "r1", tutorId: "t1", kodeKelas: "ENG-A1" },
      { id: "b", hari: 1, jamMulai: "09:00", jamSelesai: "11:00", roomId: "r2", tutorId: "t2", kodeKelas: "MATH-A1" },
    ];
    const candidate: ScheduleLite = {
      hari: 1,
      jamMulai: "09:30",
      jamSelesai: "10:30",
      roomId: "r1",
      tutorId: "t2",
    };
    const conflicts = findConflicts(candidate, existing);
    expect(conflicts.map((c) => c.type).sort()).toEqual(["ruangan", "tutor"]);
  });

  it("mengabaikan jadwal itu sendiri saat edit", () => {
    const existing: ScheduleLite[] = [
      { id: "a", hari: 2, jamMulai: "08:00", jamSelesai: "10:00", roomId: "r1", tutorId: "t1" },
    ];
    expect(findConflicts({ id: "a", hari: 2, jamMulai: "08:00", jamSelesai: "10:00", roomId: "r1", tutorId: "t1" }, existing)).toEqual([]);
  });

  it("membandingkan dua sesi pada tanggal dan jam yang sama", () => {
    const a = { tanggal: new Date("2026-10-22T00:00:00.000Z"), jamMulai: "08:00", jamSelesai: "10:00" };
    expect(sessionsOverlap(a, { ...a, jamMulai: "09:00", jamSelesai: "11:00" })).toBe(true);
    expect(sessionsOverlap(a, { ...a, tanggal: new Date("2026-10-23T00:00:00.000Z") })).toBe(false);
  });
});
