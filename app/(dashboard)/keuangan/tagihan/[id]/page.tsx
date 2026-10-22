import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgePercent,
  CalendarClock,
  CreditCard,
  FileText,
  Gavel,
  ReceiptText,
  UserRound,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import { canAcceptPayment, paymentProgress, summarizePayments } from "@/lib/rules/invoice";
import { invoiceTypeLabel } from "@/lib/services/invoices";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { PaymentForm } from "@/features/pembayaran/payment-form";
import { voidPaymentAction } from "@/features/pembayaran/actions";
import { ReasonDialog } from "@/components/forms/reason-dialog";
import { DiscountDialog } from "@/features/tagihan/discount-dialog";
import { LateFeeDialog } from "@/features/tagihan/late-fee-dialog";

export const metadata = { title: "Detail Tagihan" };
export const dynamic = "force-dynamic";

export default async function TagihanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireRole("keuangan", "owner");
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      student: { include: { program: true } },
      enrollment: { include: { class: { include: { program: true } } } },
      payments: { include: { receipt: true }, orderBy: { tanggal: "asc" } },
      discounts: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!invoice) notFound();

  const { paid, validCount } = summarizePayments(invoice.payments);
  const sisa = Math.max(0, invoice.total - paid);
  const check = canAcceptPayment({
    total: invoice.total,
    paid,
    validCount,
    amount: sisa,
  });

  let disabledReason: string | undefined;
  if (invoice.status === "void") disabledReason = "Tagihan sudah dibatalkan (void).";
  else if (invoice.total <= 0) disabledReason = "Tagihan ini tidak memerlukan pembayaran.";
  else if (sisa <= 0 || invoice.status === "lunas") disabledReason = "Tagihan sudah lunas.";
  else if (validCount >= 2) disabledReason = check.error ?? "Batas maksimal pembayaran valid tercapai.";
  else if (invoice.student.status === "nonaktif") disabledReason = "Siswa sudah nonaktif.";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Tagihan ${invoice.invoiceNo}`}
        description={`${invoice.student.nama} · ${invoiceTypeLabel(invoice.jenis)}${invoice.periode ? ` ${invoice.periode}` : ""}`}
      >
        <Link
          href="/keuangan/tagihan"
          className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>
        {invoice.status !== "void" && sisa > 0 ? (
          <a
            href={`#pembayaran`}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
          >
            <CreditCard className="h-4 w-4" /> Catat Pembayaran
          </a>
        ) : null}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Info label="Total Tagihan" value={formatRupiah(invoice.total)} hint={<StatusBadge status={invoice.status} />} />
        <Info label="Sudah Dibayar" value={formatRupiah(paid)} hint={`${validCount} pembayaran valid`} tone="success" />
        <Info label="Sisa" value={formatRupiah(sisa)} hint={`${paymentProgress(invoice.total, paid)}% terbayar`} tone={sisa > 0 ? "danger" : "success"} />
        <Info
          label="Jatuh Tempo"
          value={formatDate(invoice.jatuhTempo)}
          hint={invoice.menunggakSejak ? `Menunggak sejak ${formatDate(invoice.menunggakSejak)}` : "Belum menunggak"}
          tone={invoice.menunggakSejak ? "danger" : undefined}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ReceiptText className="h-4 w-4 text-primary" /> Rincian Tagihan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-slate-50 p-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserRound className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/siswa/${invoice.studentId}`} className="font-semibold hover:text-primary">
                    {invoice.student.nama}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {invoice.student.studentCode ?? "Belum diaktivasi"} · {invoice.student.program?.nama ?? "Tanpa program"} · {invoice.student.noWa}
                  </p>
                </div>
                <StatusBadge status={invoice.student.status} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Row label="Jenis" value={invoiceTypeLabel(invoice.jenis)} />
                <Row label="Periode" value={invoice.periode ?? "-"} />
                <Row label="Nominal" value={formatRupiah(invoice.nominal)} />
                <Row label="Potongan" value={formatRupiah(invoice.potongan)} />
                <Row label="Denda" value={formatRupiah(invoice.denda)} />
                <Row
                  label="Kelas"
                  value={invoice.enrollment ? `${invoice.enrollment.class.kodeKelas} · ${invoice.enrollment.class.program.nama}` : "Tanpa enrollment"}
                />
                <Row label="Dibuat" value={formatDateTime(invoice.createdAt)} />
                <Row label="Diperbarui" value={formatDateTime(invoice.updatedAt)} />
              </div>

              {invoice.catatan ? (
                <div className="rounded-lg border border-dashed p-3 text-sm text-slate-600">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Catatan</p>
                  {invoice.catatan}
                </div>
              ) : null}

              {invoice.discounts.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Riwayat Potongan</p>
                  <div className="divide-y rounded-lg border">
                    {invoice.discounts.map((discount) => (
                      <div key={discount.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <div>
                          <p className="font-medium capitalize">{discount.jenis}</p>
                          <p className="text-xs text-muted-foreground">{discount.alasan}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold tabular-nums">{formatRupiah(discount.nominal)}</p>
                          <p className="text-[10px] text-muted-foreground">{formatDate(discount.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ReceiptText className="h-4 w-4 text-primary" /> Riwayat Pembayaran
              </CardTitle>
              <Badge variant="outline">{invoice.payments.length} transaksi</Badge>
            </CardHeader>
            <CardContent className="p-0">
              {invoice.payments.length === 0 ? (
                <EmptyState title="Belum ada pembayaran" description="Pembayaran pertama dapat dicatat melalui formulir di samping." className="m-5" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/70">
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-5 py-3 font-semibold">Tanggal</th>
                        <th className="px-3 py-3 font-semibold">Kuitansi</th>
                        <th className="px-3 py-3 font-semibold">Metode</th>
                        <th className="px-3 py-3 font-semibold">Referensi / Bukti</th>
                        <th className="px-3 py-3 text-right font-semibold">Nominal</th>
                        <th className="px-3 py-3 font-semibold">Status</th>
                        <th className="px-3 py-3 text-right font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.payments.map((payment) => (
                        <tr key={payment.id} className="border-b align-top last:border-0">
                          <td className="whitespace-nowrap px-5 py-3 text-slate-600">{formatDate(payment.tanggal)}</td>
                          <td className="px-3 py-3">
                            {payment.receipt ? (
                              <a
                                href={`/api/pdf/kuitansi/${payment.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-primary hover:underline"
                              >
                                {payment.receipt.receiptNo}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-3 py-3 capitalize text-slate-600">{payment.metode}</td>
                          <td className="px-3 py-3 text-xs text-slate-600">
                            <p>{payment.noReferensi ?? "-"}</p>
                            {payment.buktiPath ? (
                              <a
                                href={`/api/files/${payment.buktiPath}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                              >
                                <FileText className="h-3 w-3" /> Bukti
                              </a>
                            ) : null}
                          </td>
                          <td className={`px-3 py-3 text-right font-semibold tabular-nums ${payment.status === "void" ? "text-slate-400 line-through" : ""}`}>
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
                                  Cetak
                                </a>
                              ) : null}
                              {payment.status === "valid" ? (
                                <ReasonDialog
                                  action={voidPaymentAction}
                                  fields={{ paymentId: payment.id }}
                                  triggerLabel="Void"
                                  title="Void Pembayaran"
                                  description="Kuitansi tetap tersimpan dengan tanda VOID, saldo tagihan dihitung ulang, dan entri pembalik dibuat di buku kas."
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
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card id="pembayaran">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" /> Catat Pembayaran
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PaymentForm
                invoiceId={invoice.id}
                invoiceNo={invoice.invoiceNo}
                sisa={sisa}
                jumlahPembayaran={validCount}
                disabledReason={disabledReason}
              />
            </CardContent>
          </Card>

          {actor.role === "owner" ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BadgePercent className="h-4 w-4 text-amber-600" /> Kebijakan Owner
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <DiscountDialog
                    invoiceId={invoice.id}
                    nominal={invoice.nominal}
                    potongan={invoice.potongan}
                  />
                  <LateFeeDialog invoiceId={invoice.id} denda={invoice.denda} />
                </div>
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Gavel className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Potongan dan penyesuaian denda hanya dapat dilakukan Owner dan tercatat pada audit log.
                </p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" /> Informasi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p>Maksimal 2 pembayaran valid per tagihan. Untuk mengubah pembayaran, void transaksi lama terlebih dahulu.</p>
              <p>Pembayaran non-tunai wajib memiliki nomor referensi atau bukti transfer.</p>
              <p>Status tagihan menunggak dan denda diproses otomatis oleh job harian.</p>
              {invoice.status === "void" ? (
                <p className="font-semibold text-red-600">Tagihan ini berstatus void dan tidak dapat dibayar.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
  tone?: "success" | "danger";
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-bold ${tone === "danger" ? "text-red-600" : tone === "success" ? "text-emerald-700" : "text-slate-900"}`}>
        {value}
      </p>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b pb-2 last:border-0 last:pb-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="max-w-[240px] text-right text-sm">{value}</span>
    </div>
  );
}
