import type { Prisma } from "@prisma/client";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  CalendarRange,
  Search,
  Wallet,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import {
  addDays,
  dateInputValue,
  dateOnly,
  formatDate,
  monthKey,
  monthRange,
  todayDateOnly,
} from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/data-table/pagination";
import { SearchFilters, FilterField } from "@/components/data-table/filters";

export const metadata = { title: "Buku Kas" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

function accountLabel(akun: string) {
  return akun === "kas_tunai" ? "Kas Tunai" : "Rekening Bank";
}

export default async function BukuKasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("keuangan", "owner");
  const params = await searchParams;

  const now = todayDateOnly();
  const { start: monthStart } = monthRange(monthKey());
  const fromParam = typeof params.from === "string" ? params.from : dateInputValue(monthStart);
  const toParam = typeof params.to === "string" ? params.to : dateInputValue(now);
  const from = dateOnly(fromParam);
  const to = dateOnly(toParam);
  const endExclusive = addDays(to, 1);

  const akun = typeof params.akun === "string" ? params.akun : "";
  const tipe = typeof params.tipe === "string" ? params.tipe : "";
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : 1) || 1);

  const where: Prisma.CashLedgerWhereInput = {
    tanggal: { gte: from, lt: endExclusive },
    ...(akun ? { akun } : {}),
    ...(tipe ? { tipe } : {}),
    ...(q ? { keterangan: { contains: q } } : {}),
  };

  const [entries, total, allPeriod, beforeGroups, periodGroups, cashBalances] = await Promise.all([
    prisma.cashLedger.findMany({
      where,
      orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.cashLedger.count({ where }),
    prisma.cashLedger.findMany({
      where: { tanggal: { gte: from, lt: endExclusive } },
      select: { id: true, tipe: true, akun: true, nominal: true, tanggal: true, createdAt: true },
      orderBy: [{ tanggal: "asc" }, { createdAt: "asc" }],
    }),
    prisma.cashLedger.groupBy({
      by: ["akun", "tipe"],
      where: { tanggal: { lt: from } },
      _sum: { nominal: true },
    }),
    prisma.cashLedger.groupBy({
      by: ["akun", "tipe"],
      where: { tanggal: { gte: from, lt: endExclusive } },
      _sum: { nominal: true },
    }),
    prisma.cashLedger.groupBy({
      by: ["akun", "tipe"],
      _sum: { nominal: true },
    }),
  ]);

  const opening: Record<string, number> = { kas_tunai: 0, rekening_bank: 0 };
  for (const row of beforeGroups) {
    opening[row.akun] = (opening[row.akun] ?? 0) + (row.tipe === "masuk" ? row._sum.nominal ?? 0 : -(row._sum.nominal ?? 0));
  }
  const movement: Record<string, { masuk: number; keluar: number }> = {
    kas_tunai: { masuk: 0, keluar: 0 },
    rekening_bank: { masuk: 0, keluar: 0 },
  };
  for (const row of periodGroups) {
    const target = movement[row.akun] ?? { masuk: 0, keluar: 0 };
    if (row.tipe === "masuk") target.masuk += row._sum.nominal ?? 0;
    else target.keluar += row._sum.nominal ?? 0;
    movement[row.akun] = target;
  }

  const allBalances: Record<string, number> = { kas_tunai: 0, rekening_bank: 0 };
  for (const row of cashBalances) {
    allBalances[row.akun] = (allBalances[row.akun] ?? 0) + (row.tipe === "masuk" ? row._sum.nominal ?? 0 : -(row._sum.nominal ?? 0));
  }

  const openingTotal = (opening.kas_tunai ?? 0) + (opening.rekening_bank ?? 0);
  const masukTotal = movement.kas_tunai.masuk + movement.rekening_bank.masuk;
  const keluarTotal = movement.kas_tunai.keluar + movement.rekening_bank.keluar;
  const closingTotal = openingTotal + masukTotal - keluarTotal;

  // Saldo berjalan per akun dihitung kronologis dari saldo awal periode.
  const running = new Map<string, number>();
  const cursor: Record<string, number> = { ...opening };
  for (const row of allPeriod) {
    cursor[row.akun] = (cursor[row.akun] ?? 0) + (row.tipe === "masuk" ? row.nominal : -row.nominal);
    running.set(row.id, cursor[row.akun]);
  }

  const exportQuery = new URLSearchParams({ format: "xlsx", periode: fromParam.slice(0, 7) });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Buku Kas"
        description="Semua uang masuk dan keluar dari kas tunai dan rekening bank, termasuk pembalik void."
      >
        <a
          href={`/api/export/keuangan?${exportQuery.toString()}`}
          className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <BookOpen className="h-4 w-4" /> Ekspor Laporan
        </a>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="Saldo Awal" value={formatRupiah(openingTotal)} hint={formatDate(from)} />
        <Summary
          label="Uang Masuk"
          value={formatRupiah(masukTotal)}
          hint={`Tunai ${formatRupiah(movement.kas_tunai.masuk)} · Bank ${formatRupiah(movement.rekening_bank.masuk)}`}
          tone="success"
        />
        <Summary
          label="Uang Keluar"
          value={formatRupiah(keluarTotal)}
          hint={`Tunai ${formatRupiah(movement.kas_tunai.keluar)} · Bank ${formatRupiah(movement.rekening_bank.keluar)}`}
          tone="danger"
        />
        <Summary label="Saldo Akhir" value={formatRupiah(closingTotal)} hint={`Per ${formatDate(to)}`} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(["kas_tunai", "rekening_bank"] as const).map((key) => {
          const awal = opening[key] ?? 0;
          const akhir = awal + movement[key].masuk - movement[key].keluar;
          return (
            <div key={key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {accountLabel(key)}
                </p>
                <p className="mt-1 text-lg font-bold tabular-nums">{formatRupiah(akhir)}</p>
                <p className="text-xs text-muted-foreground">
                  Awal {formatRupiah(awal)} · Masuk {formatRupiah(movement[key].masuk)} · Keluar{" "}
                  {formatRupiah(movement[key].keluar)}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Wallet className="h-5 w-5" />
              </div>
            </div>
          );
        })}
      </div>

      <SearchFilters action="/keuangan/buku-kas">
        <FilterField label="Dari tanggal">
          <Input type="date" name="from" defaultValue={fromParam} />
        </FilterField>
        <FilterField label="Sampai tanggal">
          <Input type="date" name="to" defaultValue={toParam} />
        </FilterField>
        <FilterField label="Akun">
          <Select name="akun" defaultValue={akun}>
            <option value="">Semua akun</option>
            <option value="kas_tunai">Kas Tunai</option>
            <option value="rekening_bank">Rekening Bank</option>
          </Select>
        </FilterField>
        <FilterField label="Tipe">
          <Select name="tipe" defaultValue={tipe}>
            <option value="">Masuk & keluar</option>
            <option value="masuk">Masuk</option>
            <option value="keluar">Keluar</option>
          </Select>
        </FilterField>
        <FilterField label="Cari keterangan" className="sm:max-w-xs">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={q} placeholder="Keterangan transaksi" className="pl-9" />
          </div>
        </FilterField>
        <Button type="submit" variant="outline">
          Terapkan
        </Button>
      </SearchFilters>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-primary" /> Mutasi Kas
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {total} entri · {formatDate(from)} – {formatDate(to)}
          </span>
        </CardHeader>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <EmptyState
              title="Tidak ada mutasi"
              description="Ubah rentang tanggal atau filter untuk melihat transaksi lain."
              className="m-5"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70">
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-semibold">Tanggal</th>
                    <th className="px-3 py-3 font-semibold">Keterangan</th>
                    <th className="px-3 py-3 font-semibold">Akun</th>
                    <th className="px-3 py-3 font-semibold">Sumber</th>
                    <th className="px-3 py-3 text-right font-semibold">Masuk</th>
                    <th className="px-3 py-3 text-right font-semibold">Keluar</th>
                    <th className="px-3 py-3 text-right font-semibold">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b last:border-0">
                      <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                        {formatDate(entry.tanggal)}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-slate-900">{entry.keterangan}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {entry.isReversal ? "Pembalik void · " : ""}
                          {entry.sumberType}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">
                        {accountLabel(entry.akun)}
                      </td>
                      <td className="px-3 py-3 text-xs capitalize text-slate-600">{entry.sumberType}</td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums text-emerald-700">
                        {entry.tipe === "masuk" ? formatRupiah(entry.nominal) : "-"}
                      </td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums text-red-600">
                        {entry.tipe === "keluar" ? formatRupiah(entry.nominal) : "-"}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">
                        {formatRupiah(running.get(entry.id) ?? allBalances[entry.akun] ?? 0)}
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
              basePath="/keuangan/buku-kas"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        <BookOpen className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Buku kas bersifat append-only. Void pembayaran tidak menghapus entri lama; sistem menambahkan
          entri pembalik sehingga saldo tetap dapat diaudit. Saldo akhir gabungan saat ini{" "}
          <span className="font-semibold text-slate-900">
            {formatRupiah((allBalances.kas_tunai ?? 0) + (allBalances.rekening_bank ?? 0))}
          </span>
          .
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
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {tone === "success" ? (
          <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
        ) : tone === "danger" ? (
          <ArrowUpRight className="h-4 w-4 text-red-500" />
        ) : (
          <Wallet className="h-4 w-4 text-slate-400" />
        )}
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
