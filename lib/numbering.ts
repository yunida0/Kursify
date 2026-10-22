import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { romanMonth, wibParts } from "@/lib/dates";

type Tx = Prisma.TransactionClient;

/**
 * Mengambil nomor urut berikutnya secara atomik.
 * Counter dibuat dengan INSERT ... ON DUPLICATE KEY (bukan Prisma upsert yang
 * bisa gagal P2002 saat paralel), lalu barisnya di-lock dengan SELECT ... FOR UPDATE.
 */
export async function nextCounter(
  tx: Tx,
  key: string,
  tahun: number,
  bulan = 0,
): Promise<number> {
  await tx.$executeRaw`
    INSERT INTO \`counters\` (\`id\`, \`key\`, \`tahun\`, \`bulan\`, \`nilaiTerakhir\`, \`updatedAt\`)
    VALUES (${randomUUID()}, ${key}, ${tahun}, ${bulan}, 0, NOW(3))
    ON DUPLICATE KEY UPDATE \`nilaiTerakhir\` = \`nilaiTerakhir\`
  `;

  const rows = await tx.$queryRaw<Array<{ nilaiTerakhir: number | bigint }>>`
    SELECT \`nilaiTerakhir\` FROM \`counters\`
    WHERE \`key\` = ${key} AND \`tahun\` = ${tahun} AND \`bulan\` = ${bulan}
    FOR UPDATE
  `;

  const berikutnya = Number(rows[0]?.nilaiTerakhir ?? 0) + 1;

  await tx.counter.update({
    where: { key_tahun_bulan: { key, tahun, bulan } },
    data: { nilaiTerakhir: berikutnya },
  });

  return berikutnya;
}

export function formatStudentCode(prefix: string, year: number, urut: number): string {
  return `${prefix}-${year}-${String(urut).padStart(4, "0")}`;
}

export function formatInvoiceNo(year: number, month: number, urut: number): string {
  return `INV/${year}/${String(month).padStart(2, "0")}/${String(urut).padStart(4, "0")}`;
}

export function formatReceiptNo(year: number, month: number, urut: number): string {
  return `KWT/${year}/${String(month).padStart(2, "0")}/${String(urut).padStart(4, "0")}`;
}

export function formatSlipNo(year: number, month: number, urut: number): string {
  return `SLIP/${year}/${String(month).padStart(2, "0")}/${String(urut).padStart(3, "0")}`;
}

export function formatTutorCode(urut: number): string {
  return `TTR-${String(urut).padStart(3, "0")}`;
}

export function formatCertificateNo(
  kodeLembaga: string,
  nomor: number,
  tanggal: Date,
): string {
  const p = wibParts(tanggal);
  return `${nomor}/${kodeLembaga}/${romanMonth(tanggal)}/${p.year}`;
}

export async function nextStudentCode(
  tx: Tx,
  prefix: string,
  tanggal: Date = new Date(),
): Promise<string> {
  const p = wibParts(tanggal);
  const urut = await nextCounter(tx, "student", p.year);
  return formatStudentCode(prefix, p.year, urut);
}

export async function nextInvoiceNumber(tx: Tx, tanggal: Date = new Date()): Promise<string> {
  const p = wibParts(tanggal);
  const urut = await nextCounter(tx, "invoice", p.year, p.month);
  return formatInvoiceNo(p.year, p.month, urut);
}

export async function nextReceiptNumber(tx: Tx, tanggal: Date = new Date()): Promise<string> {
  const p = wibParts(tanggal);
  const urut = await nextCounter(tx, "receipt", p.year, p.month);
  return formatReceiptNo(p.year, p.month, urut);
}

export async function nextSlipNumber(tx: Tx, tanggal: Date = new Date()): Promise<string> {
  const p = wibParts(tanggal);
  const urut = await nextCounter(tx, "slip", p.year, p.month);
  return formatSlipNo(p.year, p.month, urut);
}

export async function nextTutorCode(tx: Tx): Promise<string> {
  const urut = await nextCounter(tx, "tutor", 0);
  return formatTutorCode(urut);
}

export async function nextCertificateNumber(
  tx: Tx,
  kodeLembaga: string,
  tanggal: Date = new Date(),
): Promise<string> {
  const p = wibParts(tanggal);
  const urut = await nextCounter(tx, "certificate", p.year);
  return formatCertificateNo(kodeLembaga, urut, tanggal);
}
