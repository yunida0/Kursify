import { describe, expect, it } from "vitest";
import {
  ATTENDANCE_EDIT_WINDOW_MS,
  attendancePercentage,
  canEditAttendance,
  canRecordForSession,
  isAttendanceBelowMinimum,
  packageBalanceDelta,
  trailingAbsences,
} from "@/lib/rules/attendance";

const now = new Date("2026-10-22T10:00:00.000Z");
const endsAt = new Date(now.getTime() - 60 * 60 * 1000);

describe("attendance rules", () => {
  it("tutor dapat mengisi dalam 24 jam setelah sesi", () => {
    expect(canEditAttendance({ endsAt, now, role: "tutor", locked: false })).toMatchObject({
      allowed: true,
      requiresReason: false,
    });
  });

  it("tutor ditolak setelah 24 jam", () => {
    const late = new Date(now.getTime() + ATTENDANCE_EDIT_WINDOW_MS + 1);
    expect(canEditAttendance({ endsAt, now: late, role: "tutor", locked: false }).allowed).toBe(false);
  });

  it("admin/owner wajib alasan di luar 24 jam", () => {
    const late = new Date(now.getTime() + ATTENDANCE_EDIT_WINDOW_MS + 1);
    expect(canEditAttendance({ endsAt, now: late, role: "admin", locked: false })).toMatchObject({
      allowed: true,
      requiresReason: true,
    });
    expect(canEditAttendance({ endsAt, now: late, role: "owner", locked: false })).toMatchObject({
      allowed: true,
      requiresReason: true,
    });
  });

  it("sesi terkunci hanya dapat diubah owner", () => {
    expect(canEditAttendance({ endsAt, now, role: "admin", locked: true }).allowed).toBe(false);
    expect(canEditAttendance({ endsAt, now, role: "tutor", locked: true }).allowed).toBe(false);
    expect(canEditAttendance({ endsAt, now, role: "owner", locked: true })).toMatchObject({
      allowed: true,
      requiresReason: true,
    });
  });

  it("hadir dan alpa mengurangi saldo paket", () => {
    expect(packageBalanceDelta("hadir")).toBe(-1);
    expect(packageBalanceDelta("alpa")).toBe(-1);
    expect(packageBalanceDelta("izin")).toBe(0);
    expect(packageBalanceDelta("sakit")).toBe(0);
  });

  it("menghitung alpa berturut-turut di akhir riwayat", () => {
    expect(trailingAbsences(["hadir", "alpa", "alpa", "alpa"])).toBe(3);
    expect(trailingAbsences(["alpa", "hadir", "alpa"])).toBe(1);
    expect(trailingAbsences(["hadir", "izin"])).toBe(0);
  });

  it("menghitung persentase kehadiran dari sesi selesai", () => {
    expect(attendancePercentage(3, 4)).toBe(75);
    expect(attendancePercentage(0, 0)).toBe(0);
    expect(attendancePercentage(2, 3)).toBe(66.67);
    expect(isAttendanceBelowMinimum(74.99)).toBe(true);
    expect(isAttendanceBelowMinimum(75)).toBe(false);
  });

  it("validasi sesi hanya pada hari pelaksanaan", () => {
    const sessionDate = new Date("2026-10-22T00:00:00.000Z");
    expect(
      canRecordForSession({ status: "terjadwal", sessionDate, today: sessionDate }).ok,
    ).toBe(true);
    expect(
      canRecordForSession({
        status: "terjadwal",
        sessionDate,
        today: new Date("2026-10-23T00:00:00.000Z"),
      }).ok,
    ).toBe(false);
    expect(
      canRecordForSession({
        status: "selesai",
        sessionDate,
        today: sessionDate,
      }).ok,
    ).toBe(false);
  });
});
