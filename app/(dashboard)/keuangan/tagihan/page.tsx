import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { CalendarPlus, Plus, ReceiptText, Search } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { formatDate, monthKey, todayDateOnly } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import { invoiceTypeLabel, outstandingSummary } from "@/lib/services/invoices";
import { summarizePayments } from "@/lib/rules/invoice";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/data-table/pagination";
import { SearchFilters, FilterField } from "@/components/data-table/filters";
import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { generateSppAction } from "@/features/tagihan/actions";

export const metadata = { title: "Tagihan" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

export default async function TagihanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("keuangan", "owner");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = typeof params.status === "string" ? params.status : "";
  const jenis = typeof params.jenis === "string" ? params.jenis : "";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : 1) || 1);
  const today = todayDateOnly();

  const where: Prisma.InvoiceWhereInput = {
    ...(status ? { status } : {}),
    ...(jenis ? { jenis } : {}),
    ...(q
      ? {
          OR: [
            { invoiceNo: { contains: q } },
            { student: { nama: { contains: q } } },
            { student: { studentCode: { contains: q } } },
          ],
        }
      : {}),
  };

  const [invoices, total, summary] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        student: true,
        payments: { where: { status: "valid" }, select: { nominal: true, status: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.invoice.count({ where }),
    outstandingSummary(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Tagihan" description="Terbitkan, pantau, dan tindak lanjuti tagihan siswa.">
        <Link
          href="/keuangan/tagihan/baru"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Buat Tagihan
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <Summary label="Total belum lunas" value={formatRupiah(summary.total)} hint={`${summary.count} tagihan`} />
        <Summary label="Menunggak" value={formatRupiah(summary.menunggak)} hint="Perlu penagihan" danger={summary.menunggak > 0} />
        <Summary label="Tagihan tampil" value={String(total)} hint="Sesuai filter aktif" />
      </div>

      <details className="rounded-xl border bg-white p-4">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
          <CalendarPlus className="h-4 w-4 text-primary" /> Generate tagihan SPP massal
        </summary>
        <div className="mt-4 max-w-md border-t pt-4">
          <ActionForm action={generateSppAction} submitLabel="Generate SPP" variant="outline" size="sm">
            <Field
              label="Periode"
              htmlFor="sppPeriode"
              required
              hint="Tagihan hanya dibuat untuk siswa aktif di kelas dengan skema SPP dan tidak akan duplikat."
            >
              <Input id="sppPeriode" name="periode" type="month" required defaultValue={monthKey()} />
            </Field>
          </ActionForm>
        </div>
      </details>

      <SearchFilters action="/keuangan/tagihan">
        <FilterField label="Cari tagihan" className="sm:max-w-xs">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={q} placeholder="Nomor tagihan, nama, nomor induk" className="pl-9" />
          </div>
        </FilterField>
        <FilterField label="Status">
          <Select name="status" defaultValue={status}>
            <option value="">Semua status</option>
            <option value="belum_dibayar">Belum dibayar</option>
            <option value="dibayar_sebagian">Dibayar sebagian</option>
            <option value="menunggak">Menunggak</option>
            <option value="lunas">Lunas</option>
            <option value="void">Void</option>
          </Select>
        </FilterField>
        <FilterField label="Jenis">
          <Select name="jenis" defaultValue={jenis}>
            <option value="">Semua jenis</option>
            <option value="pendaftaran">Pendaftaran</option>
            <option value="spp">SPP bulanan</option>
            <option value="paket">Paket pertemuan</option>
            <option value="lain">Lain-lain</option>
          </Select>
        </FilterField>
        <Button type="submit" variant="outline">
          Terapkan
        </Button>
      </SearchFilters>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-primary" /> Daftar Tagihan
          </CardTitle>
          <span className="text-xs text-muted-foreground">{total} tagihan</span>
        </CardHeader>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <EmptyState
              title="Tagihan tidak ditemukan"
              description="Ubah filter atau terbitkan tagihan baru."
              className="m-5"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70">
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-semibold">Tagihan</th>
                    <th className="px-3 py-3 font-semibold">Siswa</th>
                    <th className="px-3 py-3 font-semibold">Jatuh Tempo</th>
                    <th className="px-3 py-3 text-right font-semibold">Total</th>
                    <th className="px-3 py-3 text-right font-semibold">Dibayar</th>
                    <th className="px-3 py-3 text-right font-semibold">Sisa</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => {
                    const { paid } = summarizePayments(invoice.payments);
                    const sisa = Math.max(0, invoice.total - paid);
                    const overdue =
                      invoice.jatuhTempo < today && !["lunas", "void"].includes(invoice.status);
                    return (
                      <tr key={invoice.id} className="border-b align-top last:border-0">
                        <td className="px-5 py-3">
                          <Link
                            href={`/keuangan/tagihan/${invoice.id}`}
                            className="font-semibold text-primary hover:underline"
                          >
                            {invoice.invoiceNo}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {invoiceTypeLabel(invoice.jenis)}
                            {invoice.periode ? ` · ${invoice.periode}` : ""}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-medium">{invoice.student.nama}</p>
                          <p className="text-xs text-muted-foreground">
                            {invoice.student.studentCode ?? "Belum diaktivasi"}
                          </p>
                        </td>
                        <td className={`whitespace-nowrap px-3 py-3 text-xs ${overdue ? "font-semibold text-red-600" : "text-slate-600"}`}>
                          {formatDate(invoice.jatuhTempo)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatRupiah(invoice.total)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-emerald-700">
                          {formatRupiah(paid)}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums">
                          {sisa > 0 ? formatRupiah(sisa) : "-"}
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge status={invoice.status} />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Link
                              href={`/keuangan/tagihan/${invoice.id}`}
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
              basePath="/keuangan/tagihan"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Summary({ label, value, hint, danger }: { label: string; value: string; hint: string; danger?: boolean }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-bold ${danger ? "text-red-600" : "text-slate-900"}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
