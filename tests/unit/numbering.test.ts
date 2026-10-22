import { describe, expect, it } from "vitest";
import {
  formatCertificateNo,
  formatInvoiceNo,
  formatReceiptNo,
  formatSlipNo,
  formatStudentCode,
  formatTutorCode,
} from "@/lib/numbering";
import { terbilang, terbilangAngka } from "@/lib/terbilang";

describe("numbering formatters", () => {
  it("membuat nomor induk siswa KSF-YYYY-NNNN", () => {
    expect(formatStudentCode("KSF", 2026, 1)).toBe("KSF-2026-0001");
    expect(formatStudentCode("KSF", 2026, 1234)).toBe("KSF-2026-1234");
  });

  it("membuat nomor tagihan, kuitansi, slip, dan tutor", () => {
    expect(formatInvoiceNo(2026, 10, 1)).toBe("INV/2026/10/0001");
    expect(formatReceiptNo(2026, 9, 12)).toBe("KWT/2026/09/0012");
    expect(formatSlipNo(2026, 10, 1)).toBe("SLIP/2026/10/001");
    expect(formatTutorCode(7)).toBe("TTR-007");
  });

  it("membuat nomor sertifikat dengan bulan romawi dan kode lembaga", () => {
    expect(formatCertificateNo("LKP.NC", 1, new Date("2026-10-22T00:00:00.000Z"))).toBe(
      "1/LKP.NC/X/2026",
    );
    expect(formatCertificateNo("LKP.NC", 12, new Date("2026-01-05T00:00:00.000Z"))).toBe(
      "12/LKP.NC/I/2026",
    );
  });
});

describe("terbilang", () => {
  it("mengubah nominal rupiah menjadi kata", () => {
    expect(terbilang(0)).toBe("nol rupiah");
    expect(terbilang(1_000)).toBe("seribu rupiah");
    expect(terbilang(1_250_000)).toBe("satu juta dua ratus lima puluh ribu rupiah");
    expect(terbilang(300_000)).toBe("tiga ratus ribu rupiah");
  });

  it("menangani angka negatif dan pembulatan", () => {
    expect(terbilang(-1_000)).toBe("seribu rupiah");
    expect(terbilang(1_000.4)).toBe("seribu rupiah");
    expect(terbilangAngka(91)).toBe("sembilan puluh satu");
  });

  it("mendukung nominal besar", () => {
    expect(terbilang(1_000_000_000)).toBe("satu miliar rupiah");
  });
});
