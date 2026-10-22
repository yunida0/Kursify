import ExcelJS from "exceljs";
import { renderToBuffer } from "@react-pdf/renderer";
import { formatDate, monthLabel } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import { LaporanDocument } from "@/lib/pdf/documents";
import { getSettings } from "@/lib/services/settings";
import {
  attendanceReport,
  criticalStudents,
  financialReport,
  honorReport,
  programPopularity,
  type ReportFilter,
} from "@/lib/services/reports";

export type ExportReport = "absensi" | "honor" | "program" | "kritis" | "keuangan";
export type ExportFormat = "pdf" | "xlsx";

export interface ExportParams extends ReportFilter {
  format: ExportFormat;
}

interface Bundle {
  title: string;
  subtitle: string;
  headers: string[];
  widths: string[];
  rows: (string | number)[][];
  summary: { label: string; value: string }[];
  sheetName: string;
  filename: string;
  numericColumns?: number[];
}

function buildBundle(
  report: ExportReport,
  filter: ReportFilter,
  minKehadiran: number,
): Promise<Bundle> {
  const periode = filter.periode ?? new Date().toISOString().slice(0, 7);
  const periodeLabel = monthLabel(periode);

  switch (report) {
    case "absensi":
      return attendanceReport(filter, minKehadiran).then(({ rows }) => {
        const low = rows.filter((r) => r.diBawahMinimum).length;
        return {
          title: "Rekap Absensi Siswa",
          subtitle: `Periode ${periodeLabel}`,
          headers: ["Kode", "Nama Siswa", "Kelas", "Program", "Hadir", "Izin", "Sakit", "Alpa", "Total", "Kehadiran"],
          widths: ["9%", "20%", "10%", "15%", "6%", "5%", "5%", "5%", "6%", "14%"],
          rows: rows.map((r) => [
            r.studentCode,
            r.nama,
            r.kelas,
            r.program,
            r.hadir,
            r.izin,
            r.sakit,
            r.alpa,
            r.total,
            `${r.persen.toLocaleString("id-ID")}%`,
          ]),
          summary: [
            { label: "Jumlah baris", value: String(rows.length) },
            { label: `Siswa di bawah ${minKehadiran}%`, value: String(low) },
          ],
          sheetName: "Rekap Absensi",
          filename: `Laporan-Absensi-${periode}`,
        };
      });

    case "honor":
      return honorReport(filter).then((rows) => ({
        title: "Laporan Absensi & Honor Tutor",
        subtitle: `Periode ${periodeLabel}`,
        headers: ["Kode", "Tutor", "Skema", "Tarif", "Sesi", "Total Honor", "Kelas"],
        widths: ["9%", "20%", "11%", "13%", "7%", "15%", "25%"],
        rows: rows.map((r) => [
          r.tutorCode,
          r.nama,
          r.skema === "bulanan_tetap" ? "Bulanan tetap" : "Per pertemuan",
          formatRupiah(r.tarif),
          r.jumlahSesi,
          formatRupiah(r.total),
          r.perClass.map((c) => `${c.kodeKelas} (${c.jumlah})`).join(", "),
        ]),
        summary: [
          { label: "Total sesi", value: String(rows.reduce((s, r) => s + r.jumlahSesi, 0)) },
          { label: "Total honor", value: formatRupiah(rows.reduce((s, r) => s + r.total, 0)) },
        ],
        sheetName: "Honor Tutor",
        filename: `Laporan-Honor-${periode}`,
      }));

    case "program":
      return programPopularity().then((rows) => ({
        title: "Laporan Program Terpopuler",
        subtitle: `Per ${formatDate(new Date())}`,
        headers: ["Kode", "Program", "Level", "Siswa Aktif", "Kelas", "Kuota", "Keterisian"],
        widths: ["10%", "28%", "12%", "12%", "8%", "12%", "18%"],
        rows: rows.map((r) => [
          r.kode,
          r.nama,
          r.level ?? "-",
          r.jumlahSiswa,
          r.jumlahKelas,
          r.totalKuota,
          `${r.persentase.toLocaleString("id-ID")}%`,
        ]),
        summary: [
          { label: "Total program", value: String(rows.length) },
          { label: "Total siswa aktif", value: String(rows.reduce((s, r) => s + r.jumlahSiswa, 0)) },
        ],
        sheetName: "Program",
        filename: "Laporan-Program-Terpopuler",
      }));

    case "kritis":
      return criticalStudents(30).then((rows) => ({
        title: "Laporan Siswa Kritis",
        subtitle: "Tunggakan lebih dari 30 hari",
        headers: ["Kode", "Nama", "WhatsApp", "Tagihan", "Tunggakan", "Hari Terlambat"],
        widths: ["14%", "25%", "16%", "10%", "18%", "17%"],
        rows: rows.map((r) => [
          r.studentCode,
          r.nama,
          r.noWa,
          r.jumlahTagihan,
          formatRupiah(r.totalTunggakan),
          r.hariTerlambat,
        ]),
        summary: [
          { label: "Jumlah siswa", value: String(rows.length) },
          { label: "Total tunggakan", value: formatRupiah(rows.reduce((s, r) => s + r.totalTunggakan, 0)) },
        ],
        sheetName: "Siswa Kritis",
        filename: "Laporan-Siswa-Kritis",
      }));

    case "keuangan":
      return financialReport(filter).then((data) => {
        const rows: (string | number)[][] = [];
        for (const i of data.incomes) rows.push(["Pemasukan", i.jenis, formatRupiah(i.total)]);
        rows.push(["Pemasukan", "TOTAL PEMASUKAN", formatRupiah(data.totalMasuk)]);
        for (const e of data.expenses) rows.push(["Pengeluaran", e.kategori, formatRupiah(e.total)]);
        rows.push(["Pengeluaran", "TOTAL PENGELUARAN", formatRupiah(data.totalKeluar)]);
        for (const a of data.accounts) {
          rows.push([
            "Saldo",
            `${a.akun === "kas_tunai" ? "Kas Tunai" : "Rekening Bank"} — awal / masuk / keluar`,
            `${formatRupiah(a.awal)} / ${formatRupiah(a.masuk)} / ${formatRupiah(a.keluar)}`,
          ]);
          rows.push(["Saldo", `Saldo akhir ${a.akun === "kas_tunai" ? "Kas Tunai" : "Rekening Bank"}`, formatRupiah(a.akhir)]);
        }
        return {
          title: "Laporan Keuangan",
          subtitle: `Periode ${periodeLabel}`,
          headers: ["Kelompok", "Uraian", "Nominal"],
          widths: ["18%", "54%", "28%"],
          rows,
          summary: [
            { label: "Total pemasukan", value: formatRupiah(data.totalMasuk) },
            { label: "Total pengeluaran", value: formatRupiah(data.totalKeluar) },
            { label: "Saldo akhir", value: formatRupiah(data.saldoAkhir) },
          ],
          sheetName: "Laporan Keuangan",
          filename: `Laporan-Keuangan-${periode}`,
        };
      });
  }
}

async function buildExcel(bundle: Bundle, report: ExportReport, periode: string) {
  const settings = await getSettings();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Kursify";
  wb.created = new Date();

  if (report === "keuangan") {
    const data = await financialReport({ periode });

    const addHeader = (ws: ExcelJS.Worksheet, headers: string[]) => {
      const row = ws.addRow(headers);
      row.font = { bold: true, color: { argb: "FFFFFFFF" } };
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
      row.alignment = { vertical: "middle" };
    };

    const ws = wb.addWorksheet("Ringkasan");
    ws.columns = [{ width: 32 }, { width: 22 }];
    ws.addRow([settings.namaLembaga]).font = { bold: true, size: 14 };
    ws.addRow(["Laporan Keuangan", monthLabel(periode)]);
    ws.addRow([]);
    addHeader(ws, ["Uraian", "Nilai"]);
    const summaryRows = [
      ["Saldo awal kas tunai", data.initial.kas_tunai],
      ["Saldo awal rekening bank", data.initial.rekening_bank],
      ["Total pemasukan", data.totalMasuk],
      ["Total pengeluaran", data.totalKeluar],
      ["Saldo akhir kas tunai", data.accounts[0]?.akhir ?? 0],
      ["Saldo akhir rekening bank", data.accounts[1]?.akhir ?? 0],
      ["SALDO AKHIR", data.saldoAkhir],
    ];
    for (const [label, value] of summaryRows) {
      const row = ws.addRow([label, value]);
      row.getCell(2).numFmt = '"Rp"#,##0';
      if (label === "SALDO AKHIR") row.font = { bold: true };
    }

    const income = wb.addWorksheet("Pemasukan");
    income.columns = [{ width: 30 }, { width: 20 }];
    income.addRow(["Pemasukan per Jenis Tagihan"]).font = { bold: true, size: 13 };
    income.addRow(["Periode", monthLabel(periode)]);
    income.addRow([]);
    addHeader(income, ["Jenis", "Total"]);
    for (const i of data.incomes) {
      const row = income.addRow([i.jenis, i.total]);
      row.getCell(2).numFmt = '"Rp"#,##0';
    }
    const totalIncome = income.addRow(["TOTAL", data.totalMasuk]);
    totalIncome.font = { bold: true };
    totalIncome.getCell(2).numFmt = '"Rp"#,##0';

    const expense = wb.addWorksheet("Pengeluaran");
    expense.columns = [{ width: 30 }, { width: 20 }];
    expense.addRow(["Pengeluaran per Kategori"]).font = { bold: true, size: 13 };
    expense.addRow(["Periode", monthLabel(periode)]);
    expense.addRow([]);
    addHeader(expense, ["Kategori", "Total"]);
    for (const e of data.expenses) {
      const row = expense.addRow([e.kategori, e.total]);
      row.getCell(2).numFmt = '"Rp"#,##0';
    }
    const totalExpense = expense.addRow(["TOTAL", data.totalKeluar]);
    totalExpense.font = { bold: true };
    totalExpense.getCell(2).numFmt = '"Rp"#,##0';

    const accounts = wb.addWorksheet("Saldo Akun");
    accounts.columns = [{ width: 24 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];
    accounts.addRow(["Saldo per Akun"]).font = { bold: true, size: 13 };
    accounts.addRow([]);
    addHeader(accounts, ["Akun", "Saldo Awal", "Masuk", "Keluar", "Saldo Akhir"]);
    for (const a of data.accounts) {
      const row = accounts.addRow([a.akun === "kas_tunai" ? "Kas Tunai" : "Rekening Bank", a.awal, a.masuk, a.keluar, a.akhir]);
      for (let c = 2; c <= 5; c++) row.getCell(c).numFmt = '"Rp"#,##0';
    }

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  const ws = wb.addWorksheet(bundle.sheetName);
  ws.columns = bundle.headers.map((h, i) => ({
    width: h.length + 6 + Math.min(30, i === 1 ? 20 : 6),
  }));
  ws.mergeCells(1, 1, 1, bundle.headers.length);
  const title = ws.getCell(1, 1);
  title.value = settings.namaLembaga;
  title.font = { bold: true, size: 14 };
  ws.mergeCells(2, 1, 2, bundle.headers.length);
  const sub = ws.getCell(2, 1);
  sub.value = `${bundle.title} — ${bundle.subtitle}`;
  sub.font = { size: 11, bold: true, color: { argb: "FF0F766E" } };
  ws.addRow([]);

  const headerRow = ws.addRow(bundle.headers);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
  headerRow.height = 22;

  for (const row of bundle.rows) {
    const added = ws.addRow(row);
    added.alignment = { vertical: "middle" };
  }
  ws.addRow([]);
  for (const s of bundle.summary) {
    const row = ws.addRow([s.label, s.value]);
    row.font = { bold: true };
  }
  ws.addRow([]);
  const footer = ws.addRow([`Dicetak ${formatDate(new Date())} · Kursify`]);
  footer.font = { size: 9, color: { argb: "FF64748B" } };

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function buildReportExport(
  report: ExportReport,
  filter: ReportFilter,
  format: ExportFormat,
): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  const settings = await getSettings();
  const periode = filter.periode ?? new Date().toISOString().slice(0, 7);
  const bundle = await buildBundle(report, filter, settings.minKehadiran);

  if (format === "xlsx") {
    const buffer = await buildExcel(bundle, report, periode);
    return {
      buffer,
      filename: `${bundle.filename}.xlsx`,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  const buffer = await renderToBuffer(
    <LaporanDocument
      settings={settings}
      title={bundle.title}
      subtitle={bundle.subtitle}
      headers={bundle.headers}
      widths={bundle.widths}
      rows={bundle.rows}
      summary={bundle.summary}
    />,
  );
  return { buffer, filename: `${bundle.filename}.pdf`, contentType: "application/pdf" };
}
