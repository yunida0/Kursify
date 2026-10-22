import { describe, expect, it } from "vitest";
import {
  dateOnly,
  diffCalendarDays,
  formatDate,
  monthKey,
  monthLabel,
  monthRange,
  previousMonthKey,
  todayDateOnly,
} from "@/lib/dates";
import { formatRupiah, parseRupiah } from "@/lib/money";

describe("date helpers (Asia/Jakarta)", () => {
  it("menormalisasi tanggal menjadi UTC tengah malam", () => {
    expect(dateOnly("2026-10-22").toISOString()).toBe("2026-10-22T00:00:00.000Z");
    expect(dateOnly(new Date("2026-10-22T23:59:00.000Z")).toISOString()).toBe(
      "2026-10-22T00:00:00.000Z",
    );
  });

  it("menggunakan tanggal WIB untuk hari ini", () => {
    // 17:30 UTC = 00:30 WIB tanggal berikutnya
    expect(todayDateOnly(new Date("2026-10-22T17:30:00.000Z")).toISOString()).toBe(
      "2026-10-23T00:00:00.000Z",
    );
  });

  it("menampilkan tanggal dan bulan dalam bahasa Indonesia", () => {
    expect(formatDate("2026-01-01T00:00:00.000Z")).toBe("01 Jan 2026");
    expect(monthLabel("2026-10")).toBe("Oktober 2026");
    expect(monthKey(new Date("2026-10-31T18:00:00.000Z"))).toBe("2026-11");
  });

  it("membuat rentang bulan eksklusif", () => {
    const { start, endExclusive } = monthRange("2026-02");
    expect(start.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(endExclusive.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("menghitung selisih hari kalender", () => {
    expect(
      diffCalendarDays(new Date("2026-10-22T00:00:00.000Z"), new Date("2026-10-20T00:00:00.000Z")),
    ).toBe(2);
  });

  it("mendapatkan periode bulan sebelumnya melewati batas tahun", () => {
    expect(previousMonthKey(new Date("2026-01-15T00:00:00.000Z"))).toBe("2025-12");
  });
});

describe("money helpers", () => {
  it("memformat rupiah tanpa desimal", () => {
    expect(formatRupiah(1_250_000)).toMatch(/1\.250\.000/);
    expect(formatRupiah(0)).toMatch(/0/);
  });

  it("mem-parsing input rupiah pengguna", () => {
    expect(parseRupiah("Rp 1.250.000")).toBe(1_250_000);
    expect(parseRupiah("1250000")).toBe(1_250_000);
    expect(parseRupiah("")).toBe(0);
  });
});
