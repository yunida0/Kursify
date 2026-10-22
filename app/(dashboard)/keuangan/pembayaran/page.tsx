import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ArrowDownLeft, CreditCard, ReceiptText, Search, XCircle } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { formatDate, monthKey, monthRange, todayDateOnly } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
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
import { ReasonDialog } from "@/components/forms/reason-dialog";
import { voidPaymentAction } from "@/features/pembayaran/actions";

export const metadata = { title: "Terima Pembayaran" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

export default async function PembayaranPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("keuangan", "owner");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = typeof params.status === "string" ? params.status : "";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : 1) || 1);

  const today = todayDateOnly();
  const { start, endExclusive } = monthRange(monthKey());

  const paymentWhere: Prisma.PaymentWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { invoice: { invoiceNo: { contains: q } } },
            { invoice: { student: { nama: { contains: q } } } },
            { invoice: { student: { studentCode: { contains: q } } } },
            { receipt: { receiptNo: { contains: q } } },
          ],
        }
      : {}),
  };

  const [invoices, payments, paymentTotal, monthPayments, voidCount] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        status: { in: ["belum_dibayar", "dibayar_sebagian", "menunggak"] },
        ...(q
          ? {
              OR: [
                { invoiceNo: { contains: q } },
                { student: { nama: { contains: q } } },
                { student: { studentCode: { contains: q } } },
                { student: { noWa: { contains: q } } },
              ],
            }
          : {}),
      },
      include: {
        student: true,
        payments: { where: { status: "valid" }, select: { nominal: true, status: true } },
      },
      orderBy: [{ jatuhTempo: "asc" }],
      take: 10,
    }),
    prisma.payment.findMany({
      where: paymentWhere,
      include: {
        invoice: { include: { student: true } },
        receipt: true,
      },
      orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.payment.count({ where: paymentWhere }),
    prisma.payment.findMany({
      where: { status: "valid", tanggal: { gte: start, lt: endExclusive } },
      select: { nominal: true, tanggal: true },
    }),
    prisma.payment.count({ where: { status: "void", tanggal: { gte: start, lt: endExclusive } } }),
  ]);

  const monthTotal = monthPayments.reduce((sum, payment) => sum + payment.nominal, 0);
  const todayTotal = monthPayments
    .filter((payment) => payment.tanggal.getTime() === today.getTime())
    .reduce((sum, payment) => sum + payment.nominal, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Terima Pembayaran"
        description="Cari siswa atau tagihan, lalu catat pembayaran dan terbitkan kuitansi."
      >
        <Link
          href="/keuangan/tagihan"
          className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ReceiptText className="h-4 w-4" /> Daftar Tagihan
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <Summary label="Diterima bulan ini" value={formatRupiah(monthTotal)} hint={`${monthPayments.length} pembayaran valid`} tone="success" />
        <Summary label="Diterima hari ini" value={formatRupiah(todayTotal)} hint={formatDate(today)} />
        <Summary label="Pembayaran void" value={String(voidCount)} hint="Bulan ini" tone={voidCount > 0 ? "danger" : undefined} />
      </div>

      <SearchFilters action="/keuangan/pembayaran">
        <FilterField label="Cari siswa / tagihan / kuitansi" className="sm:max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Nama, nomor induk, nomor tagihan, nomor kuitansi, WhatsApp"
              className="pl-9"
            />
          </div>
        </FilterField>
        <FilterField label="Status pembayaran">
          <Select name="status" defaultValue={status}>
            <option value="">Semua status</option>
            <option value="valid">Valid</option>
            <option value="void">Void</option>
          </Select>
        </FilterField>
        <Button type="submit" variant="outline">
          Cari
        </Button>
      </SearchFilters>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            {q ? "Tagihan yang Cocok" : "Tagihan Belum Lunas"}
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {q ? `${invoices.length} hasil teratas` : "Diurutkan berdasarkan jatuh tempo"}
          </span>
        </CardHeader>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <EmptyState
              title={q ? "Tagihan tidak ditemukan" : "Tidak ada tagihan belum lunas"}
              description={q ? "Periksa ejaan nama, nomor induk, atau nomor tagihan." : "Semua tagihan sudah lunas."}
              className="m-5"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70">
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-semibold">Siswa</th>
                    <th className="px-3 py-3 font-semibold">Tagihan</th>
                    <th className="px-3 py-3 font-semibold">Jatuh Tempo</th>
                    <th className="px-3 py-3 text-right font-semibold">Sisa</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => {
                    const { paid } = summarizePayments(invoice.payments);
                    const sisa = Math.max(0, invoice.total - paid);
                    const overdue = invoice.jatuhTempo < today;
                    return (
                      <tr key={invoice.id} className="border-b last:border-0">
                        <td className="px-5 py-3">
                          <p className="font-medium">{invoice.student.nama}</p>
                          <p className="text-xs text-muted-foreground">
                            {invoice.student.studentCode ?? "-"} · {invoice.student.noWa}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-medium text-primary">{invoice.invoiceNo}</p>
                          <p className="text-xs capitalize text-muted-foreground">
                            {invoice.jenis} {invoice.periode ? `· ${invoice.periode}` : ""}
                          </p>
                        </td>
                        <td className={`whitespace-nowrap px-3 py-3 text-xs ${overdue ? "font-semibold text-red-600" : "text-slate-600"}`}>
                          {formatDate(invoice.jatuhTempo)}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatRupiah(sisa)}</td>
                        <td className="px-3 py-3">
                          <StatusBadge status={invoice.status} />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end">
                            <Link
                              href={`/keuangan/tagihan/${invoice.id}#pembayaran`}
                              className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-semibold text-white hover:bg-primary/90"
                            >
                              <ArrowDownLeft className="h-3.5 w-3.5" /> Bayar
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-primary" /> Riwayat Pembayaran
          </CardTitle>
          <span className="text-xs text-muted-foreground">{paymentTotal} pembayaran</span>
        </CardHeader>
        <CardContent className="p-0">
          {payments.length === 0 ? (
            <EmptyState title="Belum ada pembayaran" description="Pembayaran yang dicatat akan tampil di sini." className="m-5" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70">
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-semibold">Tanggal</th>
                    <th className="px-3 py-3 font-semibold">Siswa</th>
                    <th className="px-3 py-3 font-semibold">Tagihan / Kuitansi</th>
                    <th className="px-3 py-3 font-semibold">Metode</th>
                    <th className="px-3 py-3 text-right font-semibold">Nominal</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b align-top last:border-0">
                      <td className="whitespace-nowrap px-5 py-3 text-slate-600">{formatDate(payment.tanggal)}</td>
                      <td className="px-3 py-3">
                        <p className="font-medium">{payment.invoice.student.nama}</p>
                        <p className="text-xs text-muted-foreground">{payment.invoice.student.studentCode ?? "-"}</p>
                      </td>
                      <td className="px-3 py-3">
                        <Link href={`/keuangan/tagihan/${payment.invoiceId}`} className="font-medium text-primary hover:underline">
                          {payment.invoice.invoiceNo}
                        </Link>
                        <p className="text-xs text-muted-foreground">{payment.receipt?.receiptNo ?? "Tanpa kuitansi"}</p>
                      </td>
                      <td className="px-3 py-3 capitalize text-slate-600">
                        {payment.metode}
                        {payment.noReferensi ? (
                          <p className="text-[10px] text-muted-foreground">{payment.noReferensi}</p>
                        ) : null}
                      </td>
                      <td className={`px-3 py-3 text-right font-semibold tabular-nums ${payment.status === "void" ? "text-slate-400 line-through" : "text-emerald-700"}`}>
                        {formatRupiah(payment.nominal)}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={payment.status} />
                        {payment.status === "void" && payment.voidReason ? (
                          <p className="mt-1 max-w-[180px] text-[10px] text-muted-foreground">{payment.voidReason}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          {payment.receipt ? (
                            <a
                              href={`/api/pdf/kuitansi/${payment.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-8 items-center rounded-md border bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Kuitansi
                            </a>
                          ) : null}
                          {payment.status === "valid" ? (
                            <ReasonDialog
                              action={voidPaymentAction}
                              fields={{ paymentId: payment.id }}
                              triggerLabel="Void"
                              title="Void Pembayaran"
                              description="Kuitansi tetap tersimpan dengan tanda VOID, status tagihan dihitung ulang, dan entri pembalik dibuat di buku kas."
                              submitLabel="Void Pembayaran"
                            />
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
              totalPages={Math.ceil(paymentTotal / PAGE_SIZE)}
              totalItems={paymentTotal}
              pageSize={PAGE_SIZE}
              searchParams={params}
              basePath="/keuangan/pembayaran"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Void pembayaran tidak menghapus data. Kuitansi lama ditandai VOID dan entri pembalik masuk ke buku kas.
          Gunakan hanya untuk kesalahan pencatatan.
        </p>
      </div>
    </div>
  );
}

function Summary({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "success" | "danger";
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-bold ${tone === "success" ? "text-emerald-700" : tone === "danger" ? "text-red-600" : "text-slate-900"}`}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
