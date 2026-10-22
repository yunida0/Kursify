import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Plus, Search, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { formatDate, monthKey, monthLabel, monthRange } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import { getSettings } from "@/lib/services/settings";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/data-table/pagination";
import { SearchFilters, FilterField } from "@/components/data-table/filters";
import { InlineAction } from "@/components/forms/inline-action";
import { ReasonDialog } from "@/components/forms/reason-dialog";
import {
  approveExpenseAction,
  payExpenseAction,
  rejectExpenseAction,
  voidExpenseAction,
} from "@/features/pengeluaran/actions";

export const metadata = { title: "Pengeluaran" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

export default async function PengeluaranPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireRole("keuangan", "owner");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = typeof params.status === "string" ? params.status : "";
  const categoryId = typeof params.categoryId === "string" ? params.categoryId : "";
  const periode = typeof params.periode === "string" ? params.periode : "";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : 1) || 1);

  const { start, endExclusive } = monthRange(periode || monthKey());
  const where: Prisma.ExpenseWhereInput = {
    ...(status ? { status } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(periode ? { tanggal: { gte: start, lt: endExclusive } } : {}),
    ...(q
      ? {
          OR: [
            { keterangan: { contains: q } },
            { penerima: { contains: q } },
            { category: { nama: { contains: q } } },
          ],
        }
      : {}),
  };

  const [expenses, total, grouped, categories, settings, monthPaid] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: { category: true, tutorPayroll: { include: { tutor: true } } },
      orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.expense.count({ where }),
    prisma.expense.groupBy({
      by: ["status"],
      _sum: { nominal: true },
      _count: { _all: true },
    }),
    prisma.expenseCategory.findMany({ orderBy: { nama: "asc" } }),
    getSettings(),
    prisma.expense.aggregate({
      where: { status: "dibayar", tanggal: { gte: start, lt: endExclusive } },
      _sum: { nominal: true },
    }),
  ]);

  const statusTotal = (key: string) => {
    const row = grouped.find((item) => item.status === key);
    return { sum: row?._sum.nominal ?? 0, count: row?._count._all ?? 0 };
  };
  const diajukan = statusTotal("diajukan");
  const disetujui = statusTotal("disetujui");

  return (
    <div className="space-y-6">
      <PageHeader title="Pengeluaran" description="Catat, setujui, dan bayar pengeluaran operasional lembaga.">
        <Link
          href="/keuangan/pengeluaran/baru"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Catat Pengeluaran
        </Link>
        <Link
          href="/keuangan/pengeluaran-rutin"
          className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Pengeluaran Rutin
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="Menunggu persetujuan" value={formatRupiah(diajukan.sum)} hint={`${diajukan.count} pengajuan`} tone={diajukan.count > 0 ? "warning" : undefined} />
        <Summary label="Siap dibayar" value={formatRupiah(disetujui.sum)} hint={`${disetujui.count} disetujui`} />
        <Summary label="Dibayar bulan ini" value={formatRupiah(monthPaid._sum.nominal ?? 0)} hint={monthLabel(periode || monthKey())} tone="success" />
        <Summary label="Batas persetujuan" value={formatRupiah(settings.batasPersetujuan)} hint="Di atas batas wajib disetujui Owner" />
      </div>

      <SearchFilters action="/keuangan/pengeluaran">
        <FilterField label="Cari pengeluaran" className="sm:max-w-xs">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={q} placeholder="Keterangan, penerima, kategori" className="pl-9" />
          </div>
        </FilterField>
        <FilterField label="Status">
          <Select name="status" defaultValue={status}>
            <option value="">Semua status</option>
            <option value="diajukan">Diajukan</option>
            <option value="disetujui">Disetujui</option>
            <option value="dibayar">Dibayar</option>
            <option value="ditolak">Ditolak</option>
            <option value="dibatalkan">Dibatalkan</option>
          </Select>
        </FilterField>
        <FilterField label="Kategori">
          <Select name="categoryId" defaultValue={categoryId}>
            <option value="">Semua kategori</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.nama}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Periode">
          <Input name="periode" type="month" defaultValue={periode} />
        </FilterField>
        <Button type="submit" variant="outline">
          Terapkan
        </Button>
      </SearchFilters>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" /> Daftar Pengeluaran
          </CardTitle>
          <span className="text-xs text-muted-foreground">{total} data</span>
        </CardHeader>
        <CardContent className="p-0">
          {expenses.length === 0 ? (
            <EmptyState
              title="Pengeluaran tidak ditemukan"
              description="Ubah filter atau catat pengeluaran baru."
              className="m-5"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70">
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-semibold">Tanggal</th>
                    <th className="px-3 py-3 font-semibold">Keterangan</th>
                    <th className="px-3 py-3 font-semibold">Kategori</th>
                    <th className="px-3 py-3 font-semibold">Sumber Dana</th>
                    <th className="px-3 py-3 text-right font-semibold">Nominal</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => {
                    const canPay =
                      ["diajukan", "disetujui"].includes(expense.status) &&
                      (expense.status === "disetujui" || expense.nominal <= settings.batasPersetujuan);
                    const cannotPayReason =
                      expense.status === "diajukan" && expense.nominal > settings.batasPersetujuan;
                    return (
                      <tr key={expense.id} className="border-b align-top last:border-0">
                        <td className="whitespace-nowrap px-5 py-3 text-slate-600">{formatDate(expense.tanggal)}</td>
                        <td className="px-3 py-3">
                          <p className="font-medium text-slate-900">{expense.keterangan}</p>
                          <p className="text-xs text-muted-foreground">
                            Penerima: {expense.penerima}
                            {expense.tutorPayroll ? ` · Honor ${expense.tutorPayroll.tutor.nama}` : ""}
                          </p>
                          {expense.buktiPath ? (
                            <a
                              href={`/api/files/${expense.buktiPath}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold text-primary hover:underline"
                            >
                              Lihat bukti
                            </a>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-slate-600">{expense.category.nama}</td>
                        <td className="px-3 py-3 text-slate-600">
                          {expense.sumberDana === "kas_tunai" ? "Kas Tunai" : "Rekening Bank"}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums">
                          {formatRupiah(expense.nominal)}
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge status={expense.status} />
                          {expense.status === "dibayar" && expense.paidAt ? (
                            <p className="mt-1 text-[10px] text-muted-foreground">{formatDate(expense.paidAt)}</p>
                          ) : null}
                          {expense.status === "dibatalkan" && expense.voidReason ? (
                            <p className="mt-1 max-w-[180px] text-[10px] text-muted-foreground">{expense.voidReason}</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            {actor.role === "owner" && expense.status === "diajukan" ? (
                              <>
                                <InlineAction
                                  action={approveExpenseAction}
                                  fields={{ expenseId: expense.id }}
                                  label="Setujui"
                                  variant="success"
                                />
                                <ReasonDialog
                                  action={rejectExpenseAction}
                                  fields={{ expenseId: expense.id }}
                                  triggerLabel="Tolak"
                                  title="Tolak Pengeluaran"
                                  description="Pengeluaran yang ditolak tidak dapat diproses ke pembayaran."
                                  submitLabel="Tolak"
                                />
                              </>
                            ) : null}
                            {canPay ? (
                              <InlineAction
                                action={payExpenseAction}
                                fields={{ expenseId: expense.id }}
                                label="Bayar"
                                variant="success"
                                confirmText={`Bayar pengeluaran ${expense.keterangan} sebesar ${formatRupiah(expense.nominal)}?`}
                              />
                            ) : null}
                            {cannotPayReason ? (
                              <span className="text-[10px] font-medium text-amber-700">Menunggu Owner</span>
                            ) : null}
                            {!["dibayar", "dibatalkan", "ditolak"].includes(expense.status) ? (
                              <ReasonDialog
                                action={voidExpenseAction}
                                fields={{ expenseId: expense.id }}
                                triggerLabel="Batalkan"
                                title="Batalkan Pengeluaran"
                                description="Pengeluaran yang sudah dibayar akan dibuatkan entri pembalik di buku kas."
                                submitLabel="Batalkan"
                              />
                            ) : null}
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
              basePath="/keuangan/pengeluaran"
            />
          </div>
        </CardContent>
      </Card>
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
  tone?: "success" | "warning";
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-bold ${tone === "success" ? "text-emerald-700" : tone === "warning" ? "text-amber-700" : "text-slate-900"}`}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
