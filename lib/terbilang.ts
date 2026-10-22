const SATUAN = [
  "",
  "satu",
  "dua",
  "tiga",
  "empat",
  "lima",
  "enam",
  "tujuh",
  "delapan",
  "sembilan",
  "sepuluh",
  "sebelas",
];

function terbilangRatusan(n: number): string {
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${terbilangRatusan(n - 10)} belas`;
  if (n < 100) {
    const sisa = n % 10;
    return `${terbilangRatusan(Math.floor(n / 10))} puluh${sisa ? ` ${terbilangRatusan(sisa)}` : ""}`;
  }
  if (n < 200) return `seratus${n % 100 ? ` ${terbilangRatusan(n % 100)}` : ""}`;
  if (n < 1000) {
    const sisa = n % 100;
    return `${terbilangRatusan(Math.floor(n / 100))} ratus${sisa ? ` ${terbilangRatusan(sisa)}` : ""}`;
  }
  if (n < 2000) return `seribu${n % 1000 ? ` ${terbilangRatusan(n % 1000)}` : ""}`;
  if (n < 1_000_000) {
    const sisa = n % 1000;
    return `${terbilangRatusan(Math.floor(n / 1000))} ribu${sisa ? ` ${terbilangRatusan(sisa)}` : ""}`;
  }
  if (n < 1_000_000_000) {
    const sisa = n % 1_000_000;
    return `${terbilangRatusan(Math.floor(n / 1_000_000))} juta${sisa ? ` ${terbilangRatusan(sisa)}` : ""}`;
  }
  if (n < 1_000_000_000_000) {
    const sisa = n % 1_000_000_000;
    return `${terbilangRatusan(Math.floor(n / 1_000_000_000))} miliar${sisa ? ` ${terbilangRatusan(sisa)}` : ""}`;
  }
  const sisa = n % 1_000_000_000_000;
  return `${terbilangRatusan(Math.floor(n / 1_000_000_000_000))} triliun${sisa ? ` ${terbilangRatusan(sisa)}` : ""}`;
}

/** Terbilang rupiah, contoh: 1250000 -> "satu juta dua ratus lima puluh ribu rupiah" */
export function terbilang(nominal: number): string {
  const n = Math.round(Math.abs(Number(nominal) || 0));
  if (n === 0) return "nol rupiah";
  const kata = terbilangRatusan(n).replace(/\s+/g, " ").trim();
  return `${kata} rupiah`;
}

export function terbilangAngka(nominal: number): string {
  const n = Math.round(Math.abs(Number(nominal) || 0));
  if (n === 0) return "nol";
  return terbilangRatusan(n).replace(/\s+/g, " ").trim();
}
