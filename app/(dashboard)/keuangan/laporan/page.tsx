import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Download,
  FileSpreadsheet,
  FileText,
  Landmark,
  PieChart,
  Wallet,
} from "lucide-react";
import { requireRole } from "@/lib/guard";
import { formatDate, monthKey, monthLabel, periodOptions } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import { criticalStudents, financialReport, honorReport } from "@/lib/services/reports";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { SearchFilters, FilterField } from "@/components/data-table/filters";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { invoiceTypeLabel } from "@/lib/services/invoices";

export const metadata = { title: "Laporan Keuangan" };
export const dynamic = "force-dynamic";

export default async function LaporanKeuanganPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("keuangan", "owner");
  const params = await searchParams;
  const periode = typeof params.periode === "string" && /^\d{4}-\d{2}$/.test(params.periode)
    ? params.periode
    : monthKey();

  const [financial, honor, critical] = await Promise.all([
    financialReport({ periode }),
    honorReport({ periode }),
    criticalStudents(30),
  ]);

  const net = financial.totalMasuk - financial.totalKeluar;
  const honorTotal = honor.reduce((sum, row) => sum + row.total, 0);
  const criticalTotal = critical.reduce((sum, row) => sum + row.totalTunggakan, 0);

  const query = (report: string, format: string) =>
    `/api/export/${report}?format=${format}&periode=${periode}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Keuangan"
        description={`Ringkasan pemasukan, pengeluaran, honor tutor, dan siswa kritis — ${monthLabel(periode)}`}
      >
        <ExportButtons query={query} />
      </PageHeader>

      <SearchFilters action="/keuangan/laporan">
        <FilterField label="Periode laporan">
          <Select name="periode" defaultValue={periode}>
            {periodOptions(24).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FilterField>
        <Button type="submit" variant="outline">
          Tampilkan
        </Button>
      </SearchFilters>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Pemasukan"
          value={formatRupiah(financial.totalMasuk)}
          hint={`${financial.incomes.length} jenis pendapatan`}
          tone="success"
          icon={<ArrowDownLeft className="h-5 w-5" />}
        />
        <SummaryCard
          label="Pengeluaran"
          value={formatRupiah(financial.totalKeluar)}
          hint={`${financial.expenses.length} kategori biaya`}
          tone="danger"
          icon={<ArrowUpRight className="h-5 w-5" />}
        />
        <SummaryCard
          label="Laba / Rugi Bersih"
          value={formatRupiah(net)}
          hint={net >= 0 ? "Surplus bulan ini" : "Defisit bulan ini"}
          tone={net >= 0 ? "success" : "danger"}
          icon={<PieChart className="h-5 w-5" />}
        />
        <SummaryCard
          label="Saldo Kas Akhir"
          value={formatRupiah(financial.saldoAkhir)}
          hint={`Awal ${formatRupiah(financial.initial.total)}`}
          icon={<Wallet className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-primary" /> Saldo per Akun
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70">
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-semibold">Akun</th>
                    <th className="px-3 py-3 text-right font-semibold">Awal</th>
                    <th className="px-3 py-3 text-right font-semibold">Masuk</th>
                    <th className="px-3 py-3 text-right font-semibold">Keluar</th>
                    <th className="px-3 py-3 text-right font-semibold">Akhir</th>
                  </tr>
                </thead>
                <tbody>
                  {financial.accounts.map((account) => (
                    <tr key={account.akun} className="border-b last:border-0">
                      <td className="px-5 py-3 font-medium">
                        {account.akun === "kas_tunai" ? "Kas Tunai" : "Rekening Bank"}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-600">
                        {formatRupiah(account.awal)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-emerald-700">
                        {formatRupiah(account.masuk)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-red-600">
                        {formatRupiah(account.keluar)}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">
                        {formatRupiah(account.akhir)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50">
                  <tr>
                    <td className="px-5 py-3 font-semibold">Total</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">
                      {formatRupiah(financial.initial.total)}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-emerald-700">
                      {formatRupiah(financial.totalMasuk)}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-red-600">
                      {formatRupiah(financial.totalKeluar)}
                    </td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums">
                      {formatRupiah(financial.saldoAkhir)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowDownLeft className="h-4 w-4 text-emerald-600" /> Rincian Pemasukan
              </CardTitle>
            </CardHeader>
            <CardContent>
              {financial.incomes.length === 0 ? (
                <EmptyState title="Belum ada pemasukan" className="py-6" />
              ) : (
                <div className="space-y-2">
                  {financial.incomes.map((income) => (
                    <div key={income.jenis} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-600">{invoiceTypeLabel(income.jenis)}</span>
                      <span className="font-semibold tabular-nums">{formatRupiah(income.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-red-500" /> Rincian Pengeluaran
              </CardTitle>
            </CardHeader>
            <CardContent>
              {financial.expenses.length === 0 ? (
                <EmptyState title="Belum ada pengeluaran" className="py-6" />
              ) : (
                <div className="space-y-2">
                  {financial.expenses.map((expense) => (
                    <div key={expense.kategori} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-600">{expense.kategori}</span>
                      <span className="font-semibold tabular-nums">{formatRupiah(expense.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-primary" /> Rekap Honor Tutor
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{honor.length} tutor</span>
            <ExportLink href={query("honor", "pdf")} label="PDF" />
            <ExportLink href={query("honor", "xlsx")} label="XLSX" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {honor.length === 0 ? (
            <EmptyState
              title="Belum ada sesi honor"
              description={`Tidak ada sesi selesai pada ${monthLabel(periode)}.`}
              className="m-5"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70">
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-semibold">Tutor</th>
                    <th className="px-3 py-3 font-semibold">Skema</th>
                    <th className="px-3 py-3 text-right font-semibold">Tarif</th>
                    <th className="px-3 py-3 text-right font-semibold">Sesi</th>
                    <th className="px-3 py-3 font-semibold">Kelas</th>
                    <th className="px-3 py-3 text-right font-semibold">Total Honor</th>
                  </tr>
                </thead>
                <tbody>
                  {honor.map((row) => (
                    <tr key={row.tutorId} className="border-b last:border-0">
                      <td className="px-5 py-3">
                        <p className="font-medium">{row.nama}</p>
                        <p className="text-xs text-muted-foreground">{row.tutorCode}</p>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">
                        {row.skema === "bulanan_tetap" ? "Bulanan tetap" : "Per pertemuan"}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-600">
                        {formatRupiah(row.tarif)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{row.jumlahSesi}</td>
                      <td className="max-w-[260px] px-3 py-3 text-xs text-slate-600">
                        {row.perClass.map((c) => `${c.kodeKelas} (${c.jumlah})`).join(", ") || "-"}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">
                        {formatRupiah(row.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50">
                  <tr>
                    <td colSpan={5} className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Total honor
                    </td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums">{formatRupiah(honorTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" /> Siswa Kritis (&gt; 30 hari menunggak)
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {critical.length} siswa · {formatRupiah(criticalTotal)}
            </span>
            <ExportLink href={query("kritis", "pdf")} label="PDF" />
            <ExportLink href={query("kritis", "xlsx")} label="XLSX" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {critical.length === 0 ? (
            <EmptyState
              title="Tidak ada siswa kritis"
              description="Tidak ada tunggakan lebih dari 30 hari."
              className="m-5"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70">
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-semibold">Siswa</th>
                    <th className="px-3 py-3 font-semibold">WhatsApp</th>
                    <th className="px-3 py-3 text-right font-semibold">Tagihan</th>
                    <th className="px-3 py-3 text-right font-semibold">Tunggakan</th>
                    <th className="px-3 py-3 text-right font-semibold">Hari Terlambat</th>
                    <th className="px-3 py-3 font-semibold">Jatuh Tempo Tertua</th>
                    <th className="px-3 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {critical.map((row) => (
                    <tr key={row.studentId} className="border-b last:border-0">
                      <td className="px-5 py-3">
                        <p className="font-medium">{row.nama}</p>
                        <p className="text-xs text-muted-foreground">{row.studentCode}</p>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">{row.noWa}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{row.jumlahTagihan}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-red-600">
                        {formatRupiah(row.totalTunggakan)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{row.hariTerlambat} hari</td>
                      <td className="px-3 py-3 text-xs text-slate-600">{formatDate(row.jatuhTempoTertua)}</td>
                      <td className="px-3 py-3 text-right">
                        <Link
                          href={`/keuangan/tagihan?q=${encodeURIComponent(row.nama)}&status=menunggak`}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          Tindak lanjut
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        <BadgeCheck className="h-4 w-4 text-emerald-600" />
        <p>
          Laporan dihitung dari pembayaran valid dan pengeluaran berstatus dibayar. Ekspor keuangan
          mengikuti periode {monthLabel(periode)}.
        </p>
      </div>
    </div>
  );
}

function ExportButtons({ query }: { query: (report: string, format: string) => string }) {
  return (
    <>
      <a
        href={query("keuangan", "pdf")}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
      >
        <FileText className="h-4 w-4" /> PDF
      </a>
      <a
        href={query("keuangan", "xlsx")}
        className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        <FileSpreadsheet className="h-4 w-4" /> Excel
      </a>
    </>
  );
}

function ExportLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex h-7 items-center gap-1 rounded-md border bg-white px-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
    >
      <Download className="h-3 w-3" /> {label}
    </a>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "success" | "danger";
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <span
          className={
            tone === "danger" ? "text-red-500" : tone === "success" ? "text-emerald-600" : "text-primary"
          }
        >
          {icon}
        </span>
      </div>
      <p
        className={`mt-1 text-lg font-bold tabular-nums ${
          tone === "success" ? "text-emerald-700" : tone === "danger" ? "text-red-600" : "text-slate-900"
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
