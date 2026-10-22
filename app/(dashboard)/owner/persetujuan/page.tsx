import Link from "next/link";
import { Banknote, ExternalLink, ReceiptText } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { formatDate, monthLabel } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { InlineAction } from "@/components/forms/inline-action";
import { ReasonDialog } from "@/components/forms/reason-dialog";
import { approveExpenseAction, rejectExpenseAction } from "@/features/pengeluaran/actions";
import { approvePayrollAction } from "@/features/honor/actions";
import { getSettings } from "@/lib/services/settings";

export const metadata = { title: "Persetujuan" };
export const dynamic = "force-dynamic";

export default async function PersetujuanPage() {
  await requireRole("owner");
  const settings = await getSettings();
  const [expenses, payrolls] = await Promise.all([
    prisma.expense.findMany({
      where: { status: "diajukan" },
      include: { category: true, tutorPayroll: { include: { tutor: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.tutorPayroll.findMany({
      where: { status: { in: ["draft", "direview", "disetujui"] } },
      include: { tutor: true },
      orderBy: [{ periode: "desc" }, { tutor: { nama: "asc" } }],
    }),
  ]);

  const totalExpense = expenses.reduce((sum, e) => sum + e.nominal, 0);
  const totalPayroll = payrolls.reduce((sum, p) => sum + p.total, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Persetujuan Owner"
        description={`Pengeluaran di atas ${formatRupiah(settings.batasPersetujuan)} dan honor tutor memerlukan persetujuan Anda.`}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Pengeluaran menunggu" value={`${expenses.length} pengajuan`} hint={formatRupiah(totalExpense)} />
        <SummaryCard label="Honor belum dibayar" value={`${payrolls.length} rekap`} hint={formatRupiah(totalPayroll)} />
        <SummaryCard
          label="Batas persetujuan"
          value={formatRupiah(settings.batasPersetujuan)}
          hint="Nominal di atas batas wajib disetujui Owner"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-amber-600" /> Pengeluaran Menunggu Persetujuan
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {expenses.length === 0 ? (
            <EmptyState
              title="Tidak ada pengeluaran menunggu"
              description="Semua pengajuan pengeluaran telah diproses."
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
                    <th className="px-3 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr key={expense.id} className="border-b last:border-0">
                      <td className="whitespace-nowrap px-5 py-3 text-slate-600">{formatDate(expense.tanggal)}</td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-slate-900">{expense.keterangan}</p>
                        <p className="text-xs text-muted-foreground">Penerima: {expense.penerima}</p>
                        {expense.tutorPayroll ? (
                          <p className="text-xs text-emerald-700">
                            Terkait honor {expense.tutorPayroll.tutor.nama} · {monthLabel(expense.tutorPayroll.periode)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-slate-600">{expense.category.nama}</td>
                      <td className="px-3 py-3 text-slate-600">
                        {expense.sumberDana === "kas_tunai" ? "Kas Tunai" : "Rekening Bank"}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatRupiah(expense.nominal)}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
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
                            submitLabel="Tolak Pengeluaran"
                          />
                        </div>
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
            <Banknote className="h-4 w-4 text-emerald-600" /> Rekap Honor Tutor
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {payrolls.length === 0 ? (
            <EmptyState title="Belum ada rekap honor" className="m-5" />
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
                  {payrolls.map((payroll) => (
                    <tr key={payroll.id} className="border-b last:border-0">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900">{payroll.tutor.nama}</p>
                        <p className="text-xs text-muted-foreground">{payroll.tutor.tutorCode}</p>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{monthLabel(payroll.periode)}</td>
                      <td className="px-3 py-3 text-slate-600">
                        {payroll.skema === "bulanan_tetap" ? "Bulanan tetap" : "Per pertemuan"}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{payroll.jumlahSesi}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatRupiah(payroll.total)}</td>
                      <td className="px-3 py-3">
                        <StatusBadge status={payroll.status} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          {["draft", "direview"].includes(payroll.status) ? (
                            <InlineAction
                              action={approvePayrollAction}
                              fields={{ payrollId: payroll.id }}
                              label="Setujui"
                              variant="success"
                              confirmText={`Setujui honor ${payroll.tutor.nama} sebesar ${formatRupiah(payroll.total)}?`}
                            />
                          ) : null}
                          <Link
                            href={`/keuangan/honor/${payroll.id}`}
                            className="inline-flex h-8 items-center gap-1 rounded-md border bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Detail <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
