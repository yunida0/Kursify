import Link from "next/link";
import { BadgePercent, Search } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { formatDate } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/data-table/pagination";
import { SearchFilters, FilterField } from "@/components/data-table/filters";
import { DiscountDialog } from "@/features/tagihan/discount-dialog";
import { LateFeeDialog } from "@/features/tagihan/late-fee-dialog";

export const metadata = { title: "Potongan & Denda" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function PotonganPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("owner");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = typeof params.status === "string" ? params.status : "";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : 1) || 1);

  const where = {
    status: status ? status : { not: "void" },
    ...(q
      ? {
          OR: [
            { invoiceNo: { contains: q } },
            { student: { nama: { contains: q } } },
            { student: { studentCode: { contains: q } } },
          ],
        }
      : {}),
  } as const;

  const [invoices, total, totals, discounts] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        student: { select: { nama: true, studentCode: true } },
        discounts: { orderBy: { createdAt: "desc" } },
      },
      orderBy: [{ updatedAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.invoice.count({ where }),
    prisma.invoice.aggregate({
      where: { status: { not: "void" } },
      _sum: { potongan: true, denda: true },
    }),
    prisma.discount.findMany({
      include: { invoice: { include: { student: { select: { nama: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Potongan, Beasiswa & Denda"
        description="Kelola keringanan tagihan dan penyesuaian denda. Semua perubahan tercatat pada audit log."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Summary label="Total Potongan Aktif" value={formatRupiah(totals._sum.potongan ?? 0)} />
        <Summary label="Total Denda Aktif" value={formatRupiah(totals._sum.denda ?? 0)} />
        <Summary label="Tagihan Ditampilkan" value={`${total} tagihan`} />
      </div>

      <SearchFilters action="/owner/potongan">
        <FilterField label="Cari tagihan / siswa">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={q} placeholder="No. tagihan, nama, atau kode siswa" className="pl-9" />
          </div>
        </FilterField>
        <FilterField label="Status">
          <Select name="status" defaultValue={status}>
            <option value="">Semua status aktif</option>
            <option value="belum_dibayar">Belum dibayar</option>
            <option value="dibayar_sebagian">Dibayar sebagian</option>
            <option value="menunggak">Menunggak</option>
            <option value="lunas">Lunas</option>
          </Select>
        </FilterField>
        <Button type="submit" variant="outline">
          Terapkan Filter
        </Button>
      </SearchFilters>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BadgePercent className="h-4 w-4 text-primary" /> Daftar Tagihan
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <EmptyState title="Tidak ada tagihan" description="Ubah filter atau tunggu tagihan terbit." className="m-5" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70">
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-semibold">Tagihan</th>
                    <th className="px-3 py-3 font-semibold">Siswa</th>
                    <th className="px-3 py-3 text-right font-semibold">Nominal</th>
                    <th className="px-3 py-3 text-right font-semibold">Potongan</th>
                    <th className="px-3 py-3 text-right font-semibold">Denda</th>
                    <th className="px-3 py-3 text-right font-semibold">Total</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b last:border-0">
                      <td className="px-5 py-3">
                        <Link href={`/keuangan/tagihan/${invoice.id}`} className="font-medium text-primary hover:underline">
                          {invoice.invoiceNo}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {invoice.jenis === "spp" ? "SPP" : invoice.jenis} · jatuh tempo {formatDate(invoice.jatuhTempo)}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium">{invoice.student.nama}</p>
                        <p className="text-xs text-muted-foreground">{invoice.student.studentCode ?? "-"}</p>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatRupiah(invoice.nominal)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-emerald-700">
                        {formatRupiah(invoice.potongan)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-red-600">
                        {formatRupiah(invoice.denda)}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">
                        {formatRupiah(invoice.total)}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={invoice.status} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          <DiscountDialog
                            invoiceId={invoice.id}
                            nominal={invoice.nominal}
                            potongan={invoice.potongan}
                          />
                          {invoice.denda > 0 ? (
                            <LateFeeDialog invoiceId={invoice.id} denda={invoice.denda} />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
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
              basePath="/owner/potongan"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Potongan Terbaru</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {discounts.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">Belum ada potongan.</p>
          ) : (
            <div className="divide-y">
              {discounts.map((discount) => (
                <div key={discount.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {discount.invoice.student.nama} · {discount.invoice.invoiceNo}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {discount.jenis} · {discount.alasan} · {formatDate(discount.createdAt)}
                    </p>
                  </div>
                  <span className="font-semibold text-emerald-700">{formatRupiah(discount.nominal)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}
