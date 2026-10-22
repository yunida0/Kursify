import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  ClipboardCheck,
  GraduationCap,
  ReceiptText,
  Users,
  Wallet,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { formatDate, monthKey, monthLabel } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import { StatCard } from "@/components/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { monthlyStats, recentLedger } from "@/lib/services/reports";

export const metadata = { title: "Dashboard Owner" };
export const dynamic = "force-dynamic";

export default async function OwnerDashboardPage() {
  await requireRole("owner");
  const periode = monthKey();
  const [stats, ledger, pendingExpenses, pendingPayrolls] = await Promise.all([
    monthlyStats(periode),
    recentLedger(8),
    prisma.expense.findMany({
      where: { status: "diajukan" },
      include: { category: true },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    prisma.tutorPayroll.findMany({
      where: { status: { in: ["draft", "direview", "disetujui"] } },
      include: { tutor: true },
      orderBy: { periode: "desc" },
      take: 4,
    }),
  ]);

  const [expenseCount, payrollCount, partialInvoices] = await Promise.all([
    prisma.expense.count({ where: { status: "diajukan" } }),
    prisma.tutorPayroll.count({ where: { status: { in: ["draft", "direview", "disetujui"] } } }),
    prisma.invoice.count({ where: { status: { in: ["belum_dibayar", "dibayar_sebagian", "menunggak"] } } }),
  ]);

  const maxIncome = Math.max(1, ...stats.incomeBreakdown.map((i) => i.total));
  const maxExpense = Math.max(1, ...stats.expenseBreakdown.map((e) => e.total));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Owner"
        description={`Ringkasan operasional dan keuangan — ${monthLabel(periode)}`}
      >
        <Link
          href="/owner/persetujuan"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <ClipboardCheck className="h-4 w-4" /> Persetujuan
          {expenseCount + payrollCount > 0 ? (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
              {expenseCount + payrollCount}
            </span>
          ) : null}
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Siswa Aktif"
          value={stats.activeStudents}
          hint={`${stats.pendingStudents} pendaftar menunggu verifikasi`}
          icon={<Users className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="Pemasukan Bulan Ini"
          value={formatRupiah(stats.pemasukan)}
          hint={`${partialInvoices} tagihan belum lunas`}
          icon={<ArrowDownLeft className="h-5 w-5" />}
          tone="info"
        />
        <StatCard
          label="Pengeluaran Bulan Ini"
          value={formatRupiah(stats.pengeluaran)}
          hint={`${expenseCount} pengeluaran menunggu persetujuan`}
          icon={<ArrowUpRight className="h-5 w-5" />}
          tone="warning"
        />
        <StatCard
          label="Saldo Kas"
          value={formatRupiah(stats.saldo)}
          hint={`Tunai ${formatRupiah(stats.saldoPerAkun[0]?.akhir ?? 0)} · Bank ${formatRupiah(stats.saldoPerAkun[1]?.akhir ?? 0)}`}
          icon={<Wallet className="h-5 w-5" />}
          tone={stats.saldo >= 0 ? "success" : "danger"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Perlu Perhatian</CardTitle>
            <span className="text-xs text-muted-foreground">
              {formatRupiah(stats.tunggakan)} tunggakan
            </span>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniLink
                href="/owner/persetujuan"
                icon={<ClipboardCheck className="h-4 w-4" />}
                label="Pengeluaran diajukan"
                value={expenseCount}
                tone="amber"
              />
              <MiniLink
                href="/owner/persetujuan"
                icon={<Banknote className="h-4 w-4" />}
                label="Honor belum dibayar"
                value={payrollCount}
                tone="emerald"
              />
              <MiniLink
                href="/keuangan/tagihan?status=menunggak"
                icon={<AlertTriangle className="h-4 w-4" />}
                label="Tagihan bermasalah"
                value={partialInvoices}
                tone="red"
              />
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Pengeluaran menunggu persetujuan
              </p>
              {pendingExpenses.length === 0 ? (
                <EmptyState title="Tidak ada pengeluaran menunggu" description="Semua pengeluaran sudah ditindaklanjuti." className="py-6" />
              ) : (
                <div className="divide-y rounded-lg border">
                  {pendingExpenses.map((expense) => (
                    <div key={expense.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{expense.keterangan}</p>
                        <p className="text-xs text-muted-foreground">
                          {expense.category.nama} · {formatDate(expense.tanggal)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums">{formatRupiah(expense.nominal)}</p>
                        <StatusBadge status={expense.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Rekap honor terbaru
              </p>
              {pendingPayrolls.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada rekap honor.</p>
              ) : (
                <div className="divide-y rounded-lg border">
                  {pendingPayrolls.map((payroll) => (
                    <div key={payroll.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div>
                        <p className="text-sm font-medium">{payroll.tutor.nama}</p>
                        <p className="text-xs text-muted-foreground">
                          {monthLabel(payroll.periode)} · {payroll.jumlahSesi} sesi
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums">
                          {formatRupiah(payroll.total)}
                        </span>
                        <StatusBadge status={payroll.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Arus Kas {monthLabel(periode)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-emerald-700">Pemasukan</span>
                <span className="font-bold tabular-nums">{formatRupiah(stats.pemasukan)}</span>
              </div>
              {stats.incomeBreakdown.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada pemasukan bulan ini.</p>
              ) : (
                stats.incomeBreakdown.map((item) => (
                  <div key={item.jenis} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="capitalize text-slate-600">
                        {item.jenis === "spp" ? "SPP" : item.jenis}
                      </span>
                      <span className="tabular-nums text-slate-700">{formatRupiah(item.total)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.round((item.total / maxIncome) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-amber-700">Pengeluaran</span>
                <span className="font-bold tabular-nums">{formatRupiah(stats.pengeluaran)}</span>
              </div>
              {stats.expenseBreakdown.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada pengeluaran bulan ini.</p>
              ) : (
                stats.expenseBreakdown.map((item) => (
                  <div key={item.kategori} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="truncate text-slate-600">{item.kategori}</span>
                      <span className="tabular-nums text-slate-700">{formatRupiah(item.total)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-amber-500"
                        style={{ width: `${Math.round((item.total / maxExpense) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
            <Link
              href="/keuangan/laporan"
              className="flex items-center justify-center rounded-lg border py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Lihat laporan keuangan
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Buku Kas Terakhir</CardTitle>
            <Link href="/keuangan/buku-kas" className="text-xs font-semibold text-primary hover:underline">
              Semua transaksi
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {ledger.length === 0 ? (
              <EmptyState title="Belum ada transaksi" className="m-4" />
            ) : (
              <div className="divide-y">
                {ledger.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 px-5 py-3">
                    <span
                      className={
                        entry.tipe === "masuk"
                          ? "flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"
                          : "flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-amber-600"
                      }
                    >
                      {entry.tipe === "masuk" ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{entry.keterangan}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(entry.tanggal)} · {entry.akun === "kas_tunai" ? "Kas Tunai" : "Rekening Bank"}
                      </p>
                    </div>
                    <span
                      className={
                        entry.tipe === "masuk"
                          ? "text-sm font-semibold tabular-nums text-emerald-700"
                          : "text-sm font-semibold tabular-nums text-red-600"
                      }
                    >
                      {entry.tipe === "masuk" ? "+" : "−"}
                      {formatRupiah(entry.nominal)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Akses Cepat</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {[
              { href: "/owner/potongan", label: "Potongan & Denda", icon: ReceiptText },
              { href: "/owner/tarif-honor", label: "Tarif Honor", icon: Banknote },
              { href: "/admin/siswa", label: "Data Siswa", icon: GraduationCap },
              { href: "/admin/laporan", label: "Laporan Absensi", icon: ClipboardCheck },
              { href: "/owner/pengguna", label: "Pengguna", icon: Users },
              { href: "/owner/audit-log", label: "Audit Log", icon: ClipboardCheck },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col gap-2 rounded-xl border p-3 text-xs font-medium text-slate-600 transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <item.icon className="h-4 w-4 text-primary" />
                {item.label}
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MiniLink({
  href,
  icon,
  label,
  value,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "amber" | "emerald" | "red";
}) {
  const toneClass = {
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
  }[tone];
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-slate-50"
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneClass}`}>{icon}</span>
      <div>
        <p className="text-lg font-bold leading-none tabular-nums">{value}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
      </div>
    </Link>
  );
}
