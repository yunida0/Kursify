import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck, LockKeyhole, XCircle } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import {
  dateInputValue,
  formatDate,
  formatDateTime,
  formatTime,
  sessionEndDateTime,
} from "@/lib/dates";
import { ATTENDANCE_EDIT_WINDOW_MS } from "@/lib/rules/attendance";
import { suggestedReplacementDate } from "@/lib/services/sessions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ActionForm } from "@/components/forms/action-form";
import { AttendanceForm } from "@/features/absensi/attendance-form";
import {
  cancelSessionAction,
  createReplacementAction,
} from "@/features/absensi/actions";

export const metadata = { title: "Detail Sesi" };
export const dynamic = "force-dynamic";

export default async function SesiDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireRole("admin", "owner");
  const { id } = await params;

  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      tutor: true,
      penggantiTutor: true,
      room: true,
      tutorAttendance: true,
      replaces: true,
      replacedBy: true,
      attendances: { include: { student: true }, orderBy: { student: { nama: "asc" } } },
      payrollItems: { include: { tutorPayroll: true } },
      class: {
        include: {
          program: true,
          enrollments: {
            where: { status: "aktif" },
            include: {
              student: {
                include: {
                  invoices: {
                    where: { status: { in: ["belum_dibayar", "dibayar_sebagian", "menunggak"] } },
                    include: { payments: { where: { status: "valid" }, select: { nominal: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!session) notFound();

  const endsAt = sessionEndDateTime({ tanggal: session.tanggal, jamSelesai: session.jamSelesai });
  const outsideWindow = Date.now() > endsAt.getTime() + ATTENDANCE_EDIT_WINDOW_MS;
  const attendanceByStudent = new Map(session.attendances.map((a) => [a.studentId, a.status]));
  const students = session.class.enrollments.map((enrollment) => {
    const tunggakan = enrollment.student.invoices.reduce(
      (sum, invoice) =>
        sum +
        Math.max(0, invoice.total - invoice.payments.reduce((s, payment) => s + payment.nominal, 0)),
      0,
    );
    return {
      id: enrollment.studentId,
      nama: enrollment.student.nama,
      studentCode: enrollment.student.studentCode,
      qrToken: enrollment.student.qrToken,
      status: (attendanceByStudent.get(enrollment.studentId) ?? "hadir") as
        | "hadir"
        | "izin"
        | "sakit"
        | "alpa",
      tunggakan,
    };
  });

  const canEdit =
    session.status !== "dibatalkan" &&
    !(session.locked && actor.role !== "owner") &&
    (actor.role === "owner" || actor.role === "admin");

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${session.class.kodeKelas} · ${formatDate(session.tanggal)}`}
        description={`${session.class.program.nama} · ${session.tutor.nama} · ${session.room.nama}`}
      >
        <Link
          href={`/admin/kelas/${session.classId}`}
          className="inline-flex h-10 items-center rounded-lg border bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Detail Kelas
        </Link>
        <Link
          href="/admin/sesi"
          className="inline-flex h-10 items-center rounded-lg border bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Kembali
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Info label="Jadwal" value={`${formatTime(session.jamMulai)}–${formatTime(session.jamSelesai)}`} hint={formatDate(session.tanggal)} />
        <Info label="Status Sesi" value={session.status.replaceAll("_", " ")} hint={`${students.length} siswa aktif`} />
        <Info
          label="Absensi Tutor"
          value={session.tutorAttendance?.status.replaceAll("_", " ") ?? "Belum diisi"}
          hint={session.tutorAttendance?.checkInAt ? formatDateTime(session.tutorAttendance.checkInAt) : "-"}
        />
        <Info
          label="Terkunci"
          value={session.locked ? "Ya — honor dibayar" : "Tidak"}
          hint={session.payrollItems[0]?.tutorPayroll.slipNo ?? "Belum ada slip"}
        />
      </div>

      {session.status === "dibatalkan" ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="flex items-center gap-2 font-semibold">
            <XCircle className="h-4 w-4" /> Sesi dibatalkan
          </p>
          <p className="mt-1">{session.alasanBatal}</p>
          {session.replacedBy ? (
            <Link href={`/admin/sesi/${session.replacedBy.id}`} className="mt-2 inline-block font-semibold text-red-900 underline">
              Lihat sesi pengganti: {formatDate(session.replacedBy.tanggal)}
            </Link>
          ) : (
            <div className="mt-4 max-w-xl">
              <p className="mb-2 font-semibold">Buat Sesi Pengganti</p>
              <ActionForm action={createReplacementAction} submitLabel="Buat Sesi Pengganti" variant="outline" size="sm">
                <input type="hidden" name="sessionId" value={session.id} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Tanggal" htmlFor="replacementDate">
                    <Input
                      id="replacementDate"
                      name="tanggal"
                      type="date"
                      required
                      defaultValue={dateInputValue(suggestedReplacementDate(session.tanggal))}
                    />
                  </Field>
                  <Field label="Jam Mulai" htmlFor="jamMulai">
                    <Input id="jamMulai" name="jamMulai" type="time" required defaultValue={session.jamMulai} />
                  </Field>
                  <Field label="Jam Selesai" htmlFor="jamSelesai">
                    <Input id="jamSelesai" name="jamSelesai" type="time" required defaultValue={session.jamSelesai} />
                  </Field>
                </div>
                <Field label="Alasan / Catatan" htmlFor="alasan">
                  <Input id="alasan" name="alasan" required minLength={5} defaultValue="Sesi pengganti" />
                </Field>
              </ActionForm>
            </div>
          )}
        </div>
      ) : null}

      {session.locked && actor.role !== "owner" ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Absensi terkunci</p>
            <p>Honor periode ini sudah dibayar. Hanya Owner yang dapat mengubah absensi dengan alasan.</p>
          </div>
        </div>
      ) : null}

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary" /> Koreksi Absensi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AttendanceForm
              sessionId={session.id}
              students={students}
              canEdit
              requireReason={outsideWindow || session.locked}
              materi={session.materi}
              tutorStatus={
                (session.tutorAttendance?.status as "hadir" | "digantikan" | "tidak_hadir") ?? "hadir"
              }
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Aksi ini memakai server action absensi yang sama. Sebagai Admin/Owner, koreksi di luar 24 jam wajib
              menyertakan alasan dan akan tercatat di audit log.
            </p>
          </CardContent>
        </Card>
      ) : session.status !== "dibatalkan" ? (
        <Card>
          <CardHeader>
            <CardTitle>Rekap Absensi Sesi</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {students.map((student) => (
                <div key={student.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <div>
                    <p className="font-medium">{student.nama}</p>
                    <p className="text-xs text-muted-foreground">{student.studentCode ?? "-"}</p>
                  </div>
                  <StatusBadge status={student.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {session.status === "terjadwal" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" /> Batalkan Sesi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={cancelSessionAction} submitLabel="Batalkan Sesi" variant="destructive">
              <input type="hidden" name="sessionId" value={session.id} />
              <Field label="Alasan Pembatalan" htmlFor="reason" required>
                <Textarea
                  id="reason"
                  name="reason"
                  rows={2}
                  required
                  minLength={5}
                  placeholder="Contoh: tutor sakit, ruangan dipakai kegiatan lembaga"
                />
              </Field>
              <p className="text-xs text-muted-foreground">
                Setelah dibatalkan, buat sesi pengganti agar pertemuan tetap terhitung.
              </p>
            </ActionForm>
          </CardContent>
        </Card>
      ) : null}

      {session.replaces ? (
        <p className="text-xs text-muted-foreground">
          Sesi ini menggantikan sesi{" "}
          <Link href={`/admin/sesi/${session.replaces.id}`} className="font-semibold text-primary hover:underline">
            {formatDate(session.replaces.tanggal)}
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}

function Info({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-bold capitalize text-slate-900">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
