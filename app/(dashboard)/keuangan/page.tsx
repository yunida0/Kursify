import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  CreditCard,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { addDays, formatDate, monthKey, monthLabel, todayDateOnly } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { cashBalances, monthlyStats } from "@/lib/services/reports";
import { invoiceTypeLabel, outstandingSummary } from "@/lib/services/invoices";
import { summarizePayments } from "@/lib/rules/invoice";

export const metadata = { title: "Dashboard Keuangan" };
export const dynamic = "force-dynamic";

export default async function KeuanganDashboardPage() {
  await requireRole("keuangan", "owner");
  const today = todayDateOnly();
  const soon = addDays(today, 7);
  const periode = monthKey();

  const [
    stats,
    balances,
    outstanding,
    dueInvoices,
    dueCount,
    pendingExpenseCount,
    pendingExpenses,
    payrolls,
    recentPayments,
  ] = await Promise.all([
    monthlyStats(periode),
    cashBalances(),
    outstandingSummary(),
    prisma.invoice.findMany({
      where: {
        status: { in: ["belum_dibayar", "dibayar_sebagian", "menunggak"] },
        jatuhTempo: { lte: soon },
      },
      include: {
        student: true,
        payments: { where: { status: "valid" }, select: { nominal: true, status: true } },
      },
      orderBy: [{ jatuhTempo: "asc" }, { createdAt: "asc" }],
      take: 7,
    }),
    prisma.invoice.count({
      where: {
        status: { in: ["belum_dibayar", "dibayar_sebagian", "menunggak"] },
        jatuhTempo: { lte: soon },
      },
    }),
    prisma.expense.count({ where: { status: { in: ["diajukan", "disetujui"] } } }),
    prisma.expense.findMany({
      where: { status: { in: ["diajukan", "disetujui"] } },
      include: { category: true },
      orderBy: { tanggal: "asc" },
      take: 5,
    }),
    prisma.tutorPayroll.findMany({
      where: { status: { in: ["draft", "direview", "disetujui"] } },
      include: { tutor: true },
      orderBy: [{ periode: "desc" }, { tutor: { nama: "asc" } }],
      take: 5,
    }),
    prisma.payment.findMany({
      where: { status: "valid" },
      include: {
        invoice: { include: { student: true } },
        receipt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const payrollTotal = payrolls.reduce((sum, payroll) => sum + payroll.total, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Keuangan"
        description={`Tagihan, kas, dan pengeluaran — ${monthLabel(periode)}`}
      >
        <Link
          href="/keuangan/tagihan/baru"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <ReceiptText className="h-4 w-4" /> Buat Tagihan
        </Link>
        <Link
          href="/keuangan/pembayaran"
          className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <CreditCard className="h-4 w-4" /> Terima Pembayaran
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pemasukan Bulan Ini"
          value={formatRupiah(stats.pemasukan)}
          hint={`${stats.activeStudents} siswa aktif`}
          icon={<ArrowDownLeft className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="Pengeluaran Bulan Ini"
          value={formatRupiah(stats.pengeluaran)}
          hint={`${pendingExpenseCount} pengeluaran perlu diproses`}
          icon={<ArrowUpRight className="h-5 w-5" />}
          tone="warning"
        />
        <StatCard
          label="Tunggakan"
          value={formatRupiah(outstanding.total)}
          hint={`${outstanding.count} tagihan belum lunas · ${formatRupiah(outstanding.menunggak)} menunggak`}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone={outstanding.total > 0 ? "danger" : "success"}
        />
        <StatCard
          label="Saldo Kas"
          value={formatRupiah(balances.total)}
          hint={`Tunai ${formatRupiah(balances.kas_tunai)} · Bank ${formatRupiah(balances.rekening_bank)}`}
          icon={<Wallet className="h-5 w-5" />}
          tone={balances.total >= 0 ? "success" : "danger"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" /> Tagihan Jatuh Tempo & Menunggak
            </CardTitle>
            <Link href="/keuangan/tagihan" className="text-xs font-semibold text-primary hover:underline">
              Semua tagihan
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {dueInvoices.length === 0 ? (
              <EmptyState
                title="Tidak ada tagihan mendesak"
                description="Tagihan yang jatuh tempo dalam 7 hari atau sudah menunggak akan tampil di sini."
                className="m-5"
              />
            ) : (
              <div className="divide-y">
                {dueInvoices.map((invoice) => {
                  const { paid } = summarizePayments(invoice.payments);
                  const sisa = Math.max(0, invoice.total - paid);
                  const overdue = invoice.jatuhTempo < today;
                  return (
                    <div key={invoice.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/keuangan/tagihan/${invoice.id}`}
                          className="font-semibold hover:text-primary"
                        >
                          {invoice.student.nama}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {invoice.invoiceNo} · {invoiceTypeLabel(invoice.jenis)}
                          {invoice.periode ? ` ${invoice.periode}` : ""} · tempo{" "}
                          <span className={overdue ? "font-semibold text-red-600" : ""}>
                            {formatDate(invoice.jatuhTempo)}
                          </span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold tabular-nums">{formatRupiah(sisa)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          dari {formatRupiah(invoice.total)}
                        </p>
                      </div>
                      <StatusBadge status={invoice.status} />
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex items-center justify-between border-t bg-slate-50/60 px-5 py-2.5 text-xs text-muted-foreground">
              <span>{dueCount} tagihan dalam 7 hari ke depan / menunggak</span>
              <Link href="/keuangan/tagihan?status=menunggak" className="font-semibold text-primary hover:underline">
                Tindak lanjuti
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saldo per Akun</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border bg-emerald-50/50 p-3">
              <p className="text-xs font-medium text-emerald-700">Kas Tunai</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-emerald-800">
                {formatRupiah(balances.kas_tunai)}
              </p>
            </div>
            <div className="rounded-xl border bg-sky-50/50 p-3">
              <p className="text-xs font-medium text-sky-700">Rekening Bank</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-sky-800">
                {formatRupiah(balances.rekening_bank)}
              </p>
            </div>
            <div className="rounded-xl border bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-600">Saldo Akhir Gabungan</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{formatRupiah(balances.total)}</p>
            </div>
            <Link
              href="/keuangan/buku-kas"
              className="flex items-center justify-center rounded-lg border py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Buka buku kas
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-emerald-600" /> Honor Belum Dibayar
            </CardTitle>
            <Link href="/keuangan/honor" className="text-xs font-semibold text-primary hover:underline">
              Kelola
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {payrolls.length === 0 ? (
              <EmptyState title="Semua honor sudah dibayar" className="m-4" />
            ) : (
              <>
                <div className="divide-y">
                  {payrolls.map((payroll) => (
                    <Link
                      key={payroll.id}
                      href={`/keuangan/honor/${payroll.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{payroll.tutor.nama}</p>
                        <p className="text-xs text-muted-foreground">
                          {monthLabel(payroll.periode)} · {payroll.jumlahSesi} sesi
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums">{formatRupiah(payroll.total)}</p>
                        <StatusBadge status={payroll.status} />
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="border-t bg-slate-50/60 px-5 py-2.5 text-xs font-semibold text-slate-600">
                  Total {formatRupiah(payrollTotal)}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-amber-600" /> Pengeluaran Perlu Diproses
            </CardTitle>
            <Link href="/keuangan/pengeluaran" className="text-xs font-semibold text-primary hover:underline">
              Kelola
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {pendingExpenses.length === 0 ? (
              <EmptyState title="Tidak ada pengeluaran tertunda" className="m-4" />
            ) : (
              <div className="divide-y">
                {pendingExpenses.map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" /> Pembayaran Terakhir
            </CardTitle>
            <Link href="/keuangan/pembayaran" className="text-xs font-semibold text-primary hover:underline">
              Semua
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentPayments.length === 0 ? (
              <EmptyState title="Belum ada pembayaran" className="m-4" />
            ) : (
              <div className="divide-y">
                {recentPayments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{payment.invoice.student.nama}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(payment.tanggal)} · {payment.metode}
                        {payment.receipt ? ` · ${payment.receipt.receiptNo}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums text-emerald-700">
                        +{formatRupiah(payment.nominal)}
                      </p>
                      {payment.receipt ? (
                        <a
                          href={`/api/pdf/kuitansi/${payment.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] font-semibold text-primary hover:underline"
                        >
                          Kuitansi
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
