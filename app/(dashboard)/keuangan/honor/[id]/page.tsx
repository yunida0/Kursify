import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  CheckCircle2,
  FileText,
  Lock,
  ReceiptText,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { formatDate, formatDateTime, monthLabel } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import { getSettings } from "@/lib/services/settings";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { InlineAction } from "@/components/forms/inline-action";
import {
  approvePayrollAction,
  payPayrollAction,
  reviewPayrollAction,
} from "@/features/honor/actions";

export const metadata = { title: "Detail Honor" };
export const dynamic = "force-dynamic";

export default async function HonorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireRole("keuangan", "owner");
  const { id } = await params;
  const settings = await getSettings();

  const payroll = await prisma.tutorPayroll.findUnique({
    where: { id },
    include: {
      tutor: { include: { feeSchemes: true } },
      items: {
        include: {
          session: {
            include: {
              class: { include: { program: true } },
              tutorAttendance: true,
            },
          },
        },
        orderBy: { session: { tanggal: "asc" } },
      },
      expenses: { include: { category: true } },
    },
  });
  if (!payroll) notFound();

  const audits = await prisma.auditLog.findMany({
    where: { tableName: "tutor_payrolls", recordId: payroll.id },
    include: { user: { select: { name: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  const expense = payroll.expenses[0];
  const needOwner = payroll.total > settings.batasPersetujuan;
  const canPay =
    ["direview", "disetujui"].includes(payroll.status) && (!needOwner || payroll.status === "disetujui");
  const totalSesi = payroll.items.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Honor ${payroll.tutor.nama}`}
        description={`${monthLabel(payroll.periode)} · ${totalSesi} sesi · ${payroll.tutor.tutorCode}`}
      >
        <Link
          href="/keuangan/honor"
          className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>
        {payroll.status === "dibayar" ? (
          <a
            href={`/api/pdf/slip/${payroll.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
          >
            <FileText className="h-4 w-4" /> Unduh Slip
          </a>
        ) : null}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Info label="Total Honor" value={formatRupiah(payroll.total)} hint={<StatusBadge status={payroll.status} />} />
        <Info
          label="Skema"
          value={payroll.skema === "bulanan_tetap" ? "Bulanan tetap" : "Per pertemuan"}
          hint={`Tarif ${formatRupiah(payroll.tarif)}`}
        />
        <Info
          label="Sesi Diperhitungkan"
          value={`${payroll.jumlahSesi} sesi`}
          hint={`${totalSesi} baris sesi terlampir`}
          tone="success"
        />
        <Info
          label="Batas Persetujuan"
          value={formatRupiah(settings.batasPersetujuan)}
          hint={needOwner ? "Wajib disetujui Owner sebelum dibayar" : "Di bawah batas, dapat langsung dibayar setelah review"}
          tone={needOwner && payroll.status !== "disetujui" ? "danger" : undefined}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" /> Sesi Honor
              </CardTitle>
              <span className="text-xs text-muted-foreground">{totalSesi} sesi</span>
            </CardHeader>
            <CardContent className="p-0">
              {payroll.items.length === 0 ? (
                <EmptyState
                  title="Belum ada sesi terlampir"
                  description="Jalankan ulang pembuatan draft untuk menghitung sesi pada periode ini."
                  className="m-5"
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/70">
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-5 py-3 font-semibold">Tanggal</th>
                        <th className="px-3 py-3 font-semibold">Kelas</th>
                        <th className="px-3 py-3 font-semibold">Jam</th>
                        <th className="px-3 py-3 font-semibold">Materi</th>
                        <th className="px-3 py-3 font-semibold">Kehadiran Tutor</th>
                        <th className="px-3 py-3 text-right font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payroll.items.map((item) => {
                        const session = item.session;
                        return (
                          <tr key={item.id} className="border-b align-top last:border-0">
                            <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                              {formatDate(session.tanggal)}
                            </td>
                            <td className="px-3 py-3">
                              <p className="font-medium">{session.class.kodeKelas}</p>
                              <p className="text-xs text-muted-foreground">{session.class.program.nama}</p>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">
                              {session.jamMulai}–{session.jamSelesai}
                            </td>
                            <td className="px-3 py-3 text-xs text-slate-600">{session.materi ?? "-"}</td>
                            <td className="px-3 py-3">
                              {session.tutorAttendance ? (
                                <StatusBadge status={session.tutorAttendance.status} />
                              ) : (
                                <span className="text-xs text-muted-foreground">Belum diabsen</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-right">
                              <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                                {session.locked ? <Lock className="h-3 w-3" /> : null}
                                {session.status}
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ReceiptText className="h-4 w-4 text-amber-600" /> Pengeluaran Terkait
              </CardTitle>
            </CardHeader>
            <CardContent>
              {expense ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Row label="Kategori" value={expense.category.nama} />
                    <Row label="Status" value={<StatusBadge status={expense.status} />} />
                    <Row label="Nominal" value={formatRupiah(expense.nominal)} />
                    <Row
                      label="Sumber Dana"
                      value={expense.sumberDana === "kas_tunai" ? "Kas Tunai" : "Rekening Bank"}
                    />
                    <Row label="Penerima" value={expense.penerima} />
                    <Row label="Tanggal" value={formatDate(expense.tanggal)} />
                    <Row label="Disetujui" value={expense.approvedAt ? formatDateTime(expense.approvedAt) : "-"} />
                    <Row label="Dibayar" value={expense.paidAt ? formatDateTime(expense.paidAt) : "-"} />
                  </div>
                  <p className="rounded-lg border border-dashed p-3 text-sm text-slate-600">
                    {expense.keterangan}
                  </p>
                  <Link
                    href={`/keuangan/pengeluaran?q=${encodeURIComponent(expense.penerima)}`}
                    className="inline-flex text-xs font-semibold text-primary hover:underline"
                  >
                    Lihat daftar pengeluaran
                  </Link>
                </div>
              ) : (
                <EmptyState
                  title="Belum ada pengeluaran"
                  description="Pengeluaran honor dibuat otomatis saat rekap direview."
                  className="py-6"
                />
              )}
            </CardContent>
          </Card>

          {audits.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-indigo-600" /> Jejak Audit
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {audits.map((audit) => (
                    <div key={audit.id} className="flex items-start justify-between gap-4 px-5 py-3">
                      <div>
                        <p className="text-sm font-medium capitalize text-slate-800">{audit.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {audit.user ? `${audit.user.name} · ${audit.user.role}` : "Sistem"}
                          {audit.reason ? ` — ${audit.reason}` : ""}
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                        {formatDateTime(audit.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="h-4 w-4 text-primary" /> Tutor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-semibold">{payroll.tutor.nama}</p>
              <p className="text-xs text-muted-foreground">
                {payroll.tutor.tutorCode} · {payroll.tutor.noWa}
              </p>
              <p className="text-xs text-muted-foreground">{payroll.tutor.email ?? "Tanpa email"}</p>
              <Link
                href={`/admin/tutor/${payroll.tutorId}`}
                className="inline-flex text-xs font-semibold text-primary hover:underline"
              >
                Buka profil tutor
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Banknote className="h-4 w-4 text-emerald-600" /> Proses Honor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Timeline
                items={[
                  {
                    label: "Draft dibuat",
                    time: payroll.createdAt,
                    done: true,
                  },
                  {
                    label: "Direview Staf Keuangan",
                    time: payroll.reviewedAt,
                    done: Boolean(payroll.reviewedAt),
                  },
                  {
                    label: "Disetujui Owner",
                    time: payroll.approvedAt,
                    done: Boolean(payroll.approvedAt),
                  },
                  {
                    label: "Dibayar & slip terbit",
                    time: payroll.paidAt,
                    done: payroll.status === "dibayar",
                  },
                ]}
              />

              <div className="flex flex-col gap-2 border-t pt-3">
                {payroll.status === "draft" ? (
                  <InlineAction
                    action={reviewPayrollAction}
                    fields={{ payrollId: payroll.id }}
                    label="Review & Ajukan"
                    variant="default"
                    className="w-full [&_button]:w-full"
                  />
                ) : null}
                {actor.role === "owner" && ["draft", "direview"].includes(payroll.status) ? (
                  <InlineAction
                    action={approvePayrollAction}
                    fields={{ payrollId: payroll.id }}
                    label="Setujui Honor"
                    variant="success"
                    confirmText={`Setujui honor ${payroll.tutor.nama} sebesar ${formatRupiah(payroll.total)}?`}
                    className="w-full [&_button]:w-full"
                  />
                ) : null}
                {canPay ? (
                  <InlineAction
                    action={payPayrollAction}
                    fields={{ payrollId: payroll.id }}
                    label="Bayar & Terbitkan Slip"
                    variant="success"
                    confirmText={`Bayarkan ${formatRupiah(payroll.total)} kepada ${payroll.tutor.nama}? Absensi sesi periode ini akan dikunci.`}
                    className="w-full [&_button]:w-full"
                  />
                ) : null}
                {payroll.status === "dibayar" ? (
                  <a
                    href={`/api/pdf/slip/${payroll.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-white hover:bg-primary/90"
                  >
                    <FileText className="h-4 w-4" /> Slip {payroll.slipNo}
                  </a>
                ) : null}
              </div>

              {needOwner && payroll.status !== "disetujui" && payroll.status !== "dibayar" ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                  Nominal melebihi batas {formatRupiah(settings.batasPersetujuan)}. Owner harus menyetujui
                  sebelum pembayaran.
                </p>
              ) : null}
              {payroll.status === "diretur" ? (
                <p className="text-xs text-red-600">Rekap dikembalikan untuk diperbaiki.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" /> Informasi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p>Honor dihitung dari sesi selesai dengan tutor hadir atau tutor pengganti.</p>
              <p>Pembayaran mencatat pengeluaran ke buku kas dan mengunci absensi sesi terkait.</p>
              <p>Slip PDF dapat diunduh tutor pada halaman honor mereka.</p>
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
      <p
        className={`mt-1 text-lg font-bold tabular-nums ${
          tone === "danger" ? "text-red-600" : tone === "success" ? "text-emerald-700" : "text-slate-900"
        }`}
      >
        {value}
      </p>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b pb-2 last:border-0 last:pb-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="max-w-[200px] text-right text-sm">{value}</span>
    </div>
  );
}

function Timeline({
  items,
}: {
  items: { label: string; time: Date | null; done: boolean }[];
}) {
  return (
    <ol className="space-y-3">
      {items.map((item, index) => (
        <li key={item.label} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              className={`mt-1 flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                item.done ? "border-emerald-500 bg-emerald-500" : "border-slate-300 bg-white"
              }`}
            >
              {item.done ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
            </span>
            {index < items.length - 1 ? (
              <span className={`w-px flex-1 ${item.done ? "bg-emerald-200" : "bg-slate-200"}`} />
            ) : null}
          </div>
          <div className="pb-2">
            <p className={`text-sm ${item.done ? "font-medium text-slate-800" : "text-slate-500"}`}>
              {item.label}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {item.time ? formatDateTime(item.time) : "Belum"}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
