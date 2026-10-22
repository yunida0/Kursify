import Link from "next/link";
import type { Prisma } from "@prisma/client";
import {
  Banknote,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Search,
  ShieldCheck,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { monthLabel, periodOptions, previousMonthKey } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import { getSettings } from "@/lib/services/settings";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Pagination } from "@/components/data-table/pagination";
import { SearchFilters, FilterField } from "@/components/data-table/filters";
import { ActionForm } from "@/components/forms/action-form";
import { InlineAction } from "@/components/forms/inline-action";
import { generatePayrollAction, payPayrollAction, reviewPayrollAction } from "@/features/honor/actions";

export const metadata = { title: "Honor Tutor" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

export default async function HonorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("keuangan", "owner");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = typeof params.status === "string" ? params.status : "";
  const periode = typeof params.periode === "string" ? params.periode : "";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : 1) || 1);

  const settings = await getSettings();
  const where: Prisma.TutorPayrollWhereInput = {
    ...(status ? { status } : {}),
    ...(periode ? { periode } : {}),
    ...(q
      ? {
          tutor: {
            OR: [
              { nama: { contains: q } },
              { tutorCode: { contains: q } },
              { noWa: { contains: q } },
            ],
          },
        }
      : {}),
  };

  const [payrolls, total, summary, unpaidCount, periods] = await Promise.all([
    prisma.tutorPayroll.findMany({
      where,
      include: { tutor: true, expenses: { select: { status: true, id: true } } },
      orderBy: [{ periode: "desc" }, { tutor: { nama: "asc" } }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.tutorPayroll.count({ where }),
    prisma.tutorPayroll.groupBy({
      by: ["status"],
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.tutorPayroll.count({ where: { status: { in: ["draft", "direview", "disetujui"] } } }),
    prisma.tutorPayroll.findMany({
      distinct: ["periode"],
      select: { periode: true },
      orderBy: { periode: "desc" },
      take: 18,
    }),
  ]);

  const sumFor = (list: string[]) =>
    summary
      .filter((row) => list.includes(row.status))
      .reduce((acc, row) => acc + (row._sum.total ?? 0), 0);
  const countFor = (list: string[]) =>
    summary.filter((row) => list.includes(row.status)).reduce((acc, row) => acc + row._count._all, 0);

  const draftTotal = sumFor(["draft"]);
  const reviewTotal = sumFor(["direview"]);
  const approvedTotal = sumFor(["disetujui"]);
  const paidTotal = sumFor(["dibayar"]);

  const periodeChoices = periods.map((p) => p.periode);
  if (!periodeChoices.includes(previousMonthKey())) periodeChoices.unshift(previousMonthKey());
  if (periode && !periodeChoices.includes(periode)) periodeChoices.unshift(periode);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Honor Tutor"
        description="Buat rekap bulanan, review sesi mengajar, lalu bayarkan honor dan terbitkan slip."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Summary
          label="Draft"
          value={formatRupiah(draftTotal)}
          hint={`${countFor(["draft"])} rekap menunggu review`}
          icon={<Clock3 className="h-4 w-4 text-slate-500" />}
        />
        <Summary
          label="Direview"
          value={formatRupiah(reviewTotal)}
          hint={`${countFor(["direview"])} siap dibayar / disetujui`}
          icon={<CheckCircle2 className="h-4 w-4 text-sky-600" />}
        />
        <Summary
          label="Disetujui Owner"
          value={formatRupiah(approvedTotal)}
          hint={`${countFor(["disetujui"])} rekap menunggu pembayaran`}
          icon={<ShieldCheck className="h-4 w-4 text-indigo-600" />}
        />
        <Summary
          label="Sudah Dibayar"
          value={formatRupiah(paidTotal)}
          hint={`${countFor(["dibayar"])} slip terbit`}
          icon={<Banknote className="h-4 w-4 text-emerald-600" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" /> Cari Rekap Honor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SearchFilters action="/keuangan/honor">
              <FilterField label="Cari tutor" className="sm:max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input name="q" defaultValue={q} placeholder="Nama, kode tutor, atau WhatsApp" className="pl-9" />
                </div>
              </FilterField>
              <FilterField label="Periode">
                <Select name="periode" defaultValue={periode}>
                  <option value="">Semua periode</option>
                  {periodeChoices.map((value) => (
                    <option key={value} value={value}>
                      {monthLabel(value)}
                    </option>
                  ))}
                </Select>
              </FilterField>
              <FilterField label="Status">
                <Select name="status" defaultValue={status}>
                  <option value="">Semua status</option>
                  <option value="draft">Draft</option>
                  <option value="direview">Direview</option>
                  <option value="disetujui">Disetujui</option>
                  <option value="dibayar">Dibayar</option>
                </Select>
              </FilterField>
              <Button type="submit" variant="outline">
                Terapkan
              </Button>
            </SearchFilters>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarPlus className="h-4 w-4 text-emerald-600" /> Buat Rekap Bulanan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              Rekap dibuat dari sesi berstatus selesai yang telah diabsen. Draft yang sudah ada akan
              diperbarui selama belum direview.
            </p>
            <ActionForm
              action={generatePayrollAction}
              submitLabel="Buat / Perbarui Draft"
              pendingLabel="Menghitung honor..."
              resetOnSuccess
              className="space-y-3"
            >
              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-600">Periode</span>
                <Select name="periode" defaultValue={previousMonthKey()} required>
                  {periodOptions(18).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-primary" /> Daftar Rekap Honor
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {total} rekap · {unpaidCount} belum dibayar
          </span>
        </CardHeader>
        <CardContent className="p-0">
          {payrolls.length === 0 ? (
            <EmptyState
              title="Belum ada rekap honor"
              description="Gunakan formulir di atas untuk membuat draft honor dari sesi yang sudah selesai."
              className="m-5"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70">
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-semibold">Tutor</th>
                    <th className="px-3 py-3 font-semibold">Periode</th>
                    <th className="px-3 py-3 font-semibold">Skema</th>
                    <th className="px-3 py-3 text-right font-semibold">Sesi</th>
                    <th className="px-3 py-3 text-right font-semibold">Total</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {payrolls.map((payroll) => {
                    const needOwner = payroll.total > settings.batasPersetujuan;
                    const canPay =
                      ["direview", "disetujui"].includes(payroll.status) &&
                      (!needOwner || payroll.status === "disetujui");
                    return (
                      <tr key={payroll.id} className="border-b align-top last:border-0">
                        <td className="px-5 py-3">
                          <Link
                            href={`/keuangan/honor/${payroll.id}`}
                            className="font-semibold text-slate-900 hover:text-primary"
                          >
                            {payroll.tutor.nama}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {payroll.tutor.tutorCode} · {payroll.tutor.noWa}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                          {monthLabel(payroll.periode)}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600">
                          {payroll.skema === "bulanan_tetap" ? "Bulanan tetap" : "Per pertemuan"}
                          <p className="text-[10px] text-muted-foreground">{formatRupiah(payroll.tarif)}</p>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{payroll.jumlahSesi}</td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums">
                          {formatRupiah(payroll.total)}
                          {needOwner ? (
                            <p className="text-[10px] font-medium text-amber-700">Perlu persetujuan Owner</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge status={payroll.status} />
                          {payroll.slipNo ? (
                            <p className="mt-1 text-[10px] text-muted-foreground">{payroll.slipNo}</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            {payroll.status === "draft" ? (
                              <InlineAction
                                action={reviewPayrollAction}
                                fields={{ payrollId: payroll.id }}
                                label="Review"
                                variant="outline"
                              />
                            ) : null}
                            {canPay ? (
                              <InlineAction
                                action={payPayrollAction}
                                fields={{ payrollId: payroll.id }}
                                label="Bayar"
                                variant="success"
                                confirmText={`Bayarkan honor ${payroll.tutor.nama} periode ${monthLabel(payroll.periode)} sebesar ${formatRupiah(payroll.total)}? Absensi periode ini akan dikunci.`}
                              />
                            ) : null}
                            {payroll.status === "dibayar" ? (
                              <a
                                href={`/api/pdf/slip/${payroll.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-8 items-center rounded-md border bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Slip
                              </a>
                            ) : null}
                            <Link
                              href={`/keuangan/honor/${payroll.id}`}
                              className="inline-flex h-8 items-center rounded-md border bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Detail
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-4">
            <Pagination
              page={page}
              totalPages={Math.ceil(total / PAGE_SIZE)}
              totalItems={total}
              pageSize={PAGE_SIZE}
              searchParams={params}
              basePath="/keuangan/honor"
            />
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
        <p className="font-semibold">Alur honor</p>
        <p className="mt-1 text-xs text-sky-800">
          Draft → Direview (Staf Keuangan) → Disetujui (Owner, bila di atas batas{" "}
          {formatRupiah(settings.batasPersetujuan)}) → Dibayar. Pembayaran menerbitkan slip PDF,
          mencatat pengeluaran ke buku kas, dan mengunci absensi sesi terkait.
        </p>
      </div>
    </div>
  );
}

function Summary({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
