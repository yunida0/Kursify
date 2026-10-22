import {
  Banknote,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  Info as InfoIcon,
  Wallet,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { formatDateTime, monthKey, monthLabel, periodOptions } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import { feeSchemeForPeriod } from "@/lib/rules/payroll";
import { honorReport } from "@/lib/services/reports";
import { requireTutorProfile } from "@/lib/tutor";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { SearchFilters, FilterField } from "@/components/data-table/filters";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Honor Saya" };
export const dynamic = "force-dynamic";

export default async function TutorHonorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireRole("tutor");
  const tutor = await requireTutorProfile(actor);
  const params = await searchParams;
  const periode = typeof params.periode === "string" ? params.periode : "";

  const [payrolls, schemes, currentReport] = await Promise.all([
    prisma.tutorPayroll.findMany({
      where: { tutorId: tutor.id, ...(periode ? { periode } : {}) },
      orderBy: { periode: "desc" },
    }),
    prisma.tutorFeeScheme.findMany({
      where: { tutorId: tutor.id },
      orderBy: { berlakuMulai: "desc" },
    }),
    honorReport({ periode: monthKey() }),
  ]);

  const currentScheme = feeSchemeForPeriod(schemes, monthKey());
  const currentRow = currentReport.find((row) => row.tutorId === tutor.id);
  const currentPayroll = payrolls.find((p) => p.periode === monthKey());
  const paidTotal = payrolls.filter((p) => p.status === "dibayar").reduce((sum, p) => sum + p.total, 0);
  const pending = payrolls.filter((p) => p.status !== "dibayar");
  const pendingTotal = pending.reduce((sum, p) => sum + p.total, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Honor Saya"
        description={`${tutor.nama} · ${tutor.tutorCode} · ${currentScheme ? (currentScheme.skema === "bulanan_tetap" ? "Bulanan tetap" : "Per pertemuan") : "Tarif belum diatur"}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Summary
          label={`Estimasi ${monthLabel(monthKey())}`}
          value={formatRupiah(currentRow?.total ?? 0)}
          hint={currentRow ? `${currentRow.jumlahSesi} sesi selesai` : "Belum ada sesi selesai"}
          icon={<CalendarClock className="h-5 w-5 text-primary" />}
        />
        <Summary
          label="Honor Belum Dibayar"
          value={formatRupiah(pendingTotal)}
          hint={pending.length > 0 ? `${pending.length} periode menunggu` : "Tidak ada tunggakan honor"}
          icon={<Clock3 className="h-5 w-5 text-amber-600" />}
          tone={pendingTotal > 0 ? "warning" : "success"}
        />
        <Summary
          label="Total Diterima"
          value={formatRupiah(paidTotal)}
          hint={`${payrolls.filter((p) => p.status === "dibayar").length} slip dibayar`}
          icon={<Wallet className="h-5 w-5 text-emerald-600" />}
          tone="success"
        />
        <Summary
          label="Tarif Berlaku"
          value={currentScheme ? formatRupiah(currentScheme.tarif) : "-"}
          hint={currentScheme ? `Mulai ${currentScheme.berlakuMulai}` : "Hubungi Admin"}
          icon={<Banknote className="h-5 w-5 text-slate-500" />}
        />
      </div>

      {currentPayroll && currentPayroll.status !== "dibayar" ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Rekap honor {monthLabel(currentPayroll.periode)} sedang diproses (status{" "}
            <span className="font-semibold">{currentPayroll.status}</span>). Slip akan tersedia setelah
            pembayaran diproses Keuangan.
          </p>
        </div>
      ) : null}

      <SearchFilters action="/tutor/honor">
        <FilterField label="Periode">
          <Select name="periode" defaultValue={periode}>
            <option value="">Semua periode</option>
            {periodOptions(18).map((option) => (
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

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-primary" /> Riwayat Honor & Slip
          </CardTitle>
          <span className="text-xs text-muted-foreground">{payrolls.length} rekap</span>
        </CardHeader>
        <CardContent className="p-0">
          {payrolls.length === 0 ? (
            <EmptyState
              title="Belum ada rekap honor"
              description="Rekap honor dibuat setiap awal bulan oleh Staf Keuangan."
              className="m-5"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70">
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-semibold">Periode</th>
                    <th className="px-3 py-3 font-semibold">Skema</th>
                    <th className="px-3 py-3 text-right font-semibold">Tarif</th>
                    <th className="px-3 py-3 text-right font-semibold">Sesi</th>
                    <th className="px-3 py-3 text-right font-semibold">Total</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold">Dibayar</th>
                    <th className="px-3 py-3 text-right font-semibold">Slip</th>
                  </tr>
                </thead>
                <tbody>
                  {payrolls.map((payroll) => (
                    <tr key={payroll.id} className="border-b last:border-0">
                      <td className="px-5 py-3 font-medium">{monthLabel(payroll.periode)}</td>
                      <td className="px-3 py-3 text-xs text-slate-600">
                        {payroll.skema === "bulanan_tetap" ? "Bulanan tetap" : "Per pertemuan"}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-600">
                        {formatRupiah(payroll.tarif)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{payroll.jumlahSesi}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">
                        {formatRupiah(payroll.total)}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={payroll.status} />
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">
                        {payroll.paidAt ? formatDateTime(payroll.paidAt) : "-"}
                        {payroll.slipNo ? <p className="text-[10px] text-muted-foreground">{payroll.slipNo}</p> : null}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {payroll.status === "dibayar" ? (
                          <a
                            href={`/api/pdf/slip/${payroll.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-8 items-center gap-1 rounded-md border bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <FileText className="h-3.5 w-3.5" /> PDF
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">Belum tersedia</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Ketentuan Honor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>Sesi dihitung bila berstatus selesai dan Anda tercatat hadir sebagai tutor utama atau pengganti.</p>
          <p>Honor dibayar setiap awal bulan setelah review Staf Keuangan. Slip PDF dapat diunduh pada tabel di atas.</p>
          <p>Setelah honor dibayar, absensi sesi terkait terkunci. Koreksi hanya dapat dilakukan Admin/Owner.</p>
          {schemes.length > 1 ? (
            <div className="flex flex-wrap gap-2 pt-2">
              {schemes.map((scheme) => (
                <Badge key={scheme.id} variant="outline">
                  {scheme.skema === "bulanan_tetap" ? "Bulanan" : "Per sesi"} {formatRupiah(scheme.tarif)} · mulai {scheme.berlakuMulai}
                </Badge>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Summary({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone?: "success" | "warning";
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p
        className={`mt-1 text-lg font-bold tabular-nums ${
          tone === "warning" ? "text-amber-700" : tone === "success" ? "text-emerald-700" : "text-slate-900"
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
