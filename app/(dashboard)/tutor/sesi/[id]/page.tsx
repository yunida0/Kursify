import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  LockKeyhole,
  MapPin,
  PlayCircle,
  Users,
  XCircle,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import {
  formatDate,
  formatDateTime,
  formatTime,
  sessionEndDateTime,
  todayDateOnly,
} from "@/lib/dates";
import { ATTENDANCE_EDIT_WINDOW_MS } from "@/lib/rules/attendance";
import { requireTutorProfile } from "@/lib/tutor";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { InlineAction } from "@/components/forms/inline-action";
import { AttendanceForm } from "@/features/absensi/attendance-form";
import { openSessionAction } from "@/features/absensi/actions";

export const metadata = { title: "Isi Absensi" };
export const dynamic = "force-dynamic";

export default async function TutorSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireRole("tutor");
  const tutor = await requireTutorProfile(actor);
  const { id } = await params;

  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      tutor: true,
      penggantiTutor: true,
      room: true,
      tutorAttendance: true,
      attendances: true,
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
  if (session.tutorId !== tutor.id && session.penggantiTutorId !== tutor.id) notFound();

  const endsAt = sessionEndDateTime({ tanggal: session.tanggal, jamSelesai: session.jamSelesai });
  const withinWindow = Date.now() <= endsAt.getTime() + ATTENDANCE_EDIT_WINDOW_MS;
  const isToday = session.tanggal.getTime() === todayDateOnly().getTime();
  const isPrimaryTutor = session.tutorId === tutor.id;
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
    session.status !== "dibatalkan" && !session.locked && withinWindow && session.tanggal.getTime() <= todayDateOnly().getTime();
  const attendanceSummary = {
    hadir: session.attendances.filter((a) => a.status === "hadir").length,
    izin: session.attendances.filter((a) => a.status === "izin").length,
    sakit: session.attendances.filter((a) => a.status === "sakit").length,
    alpa: session.attendances.filter((a) => a.status === "alpa").length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${session.class.kodeKelas} · ${formatDate(session.tanggal)}`}
        description={`${session.class.program.nama} · ${session.jamMulai}–${session.jamSelesai} · ${session.room.nama}`}
      >
        <Link
          href="/tutor"
          className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>
        <Link
          href={`/tutor/kelas/${session.classId}`}
          className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Users className="h-4 w-4" /> Detail Kelas
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Info label="Status Sesi" value={session.status.replaceAll("_", " ")} hint={<StatusBadge status={session.status} />} />
        <Info
          label="Jam Sesi"
          value={`${formatTime(session.jamMulai)}–${formatTime(session.jamSelesai)}`}
          hint={<span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {session.room.nama}</span>}
        />
        <Info
          label="Absensi Tutor"
          value={session.tutorAttendance?.status.replaceAll("_", " ") ?? "Belum check-in"}
          hint={session.tutorAttendance?.checkInAt ? formatDateTime(session.tutorAttendance.checkInAt) : isToday ? "Buka sesi untuk check-in" : "-"}
        />
        <Info
          label="Kehadiran Siswa"
          value={`${attendanceSummary.hadir}/${students.length} hadir`}
          hint={`Izin ${attendanceSummary.izin} · Sakit ${attendanceSummary.sakit} · Alpa ${attendanceSummary.alpa}`}
          tone={attendanceSummary.alpa > 0 ? "danger" : "success"}
        />
      </div>

      {session.status === "dibatalkan" ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Sesi dibatalkan</p>
            <p>{session.alasanBatal ?? "Sesi ini dibatalkan oleh Admin."}</p>
          </div>
        </div>
      ) : null}

      {session.locked ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Absensi terkunci</p>
            <p>
              Honor periode ini sudah dibayar{session.payrollItems[0]?.tutorPayroll.slipNo ? ` (${session.payrollItems[0].tutorPayroll.slipNo})` : ""}.
              Hubungi Admin/Owner untuk koreksi.
            </p>
          </div>
        </div>
      ) : null}

      {!canEdit && session.status !== "dibatalkan" ? (
        <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">
              {session.tanggal.getTime() > todayDateOnly().getTime()
                ? "Sesi belum dilaksanakan"
                : "Batas pengisian absensi sudah lewat"}
            </p>
            <p className="text-xs">
              {session.tanggal.getTime() > todayDateOnly().getTime()
                ? `Absensi dapat diisi pada ${formatDate(session.tanggal)}.`
                : "Tutor dapat mengisi absensi maksimal 24 jam setelah sesi berakhir. Hubungi Admin untuk koreksi."}
            </p>
          </div>
        </div>
      ) : null}

      {isToday && isPrimaryTutor && session.status === "terjadwal" && !session.tutorAttendance ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <PlayCircle className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-slate-900">Buka sesi sekarang</p>
                <p className="text-xs text-muted-foreground">
                  Check-in mencatat waktu kedatangan Anda. Absensi tetap dapat disimpan setelah check-in.
                </p>
              </div>
            </div>
            <InlineAction
              action={openSessionAction}
              fields={{ sessionId: session.id }}
              label="Buka Sesi & Check-in"
              variant="success"
            />
          </CardContent>
        </Card>
      ) : null}

      {session.status !== "dibatalkan" ? (
        canEdit ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-primary" /> Formulir Absensi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AttendanceForm
                sessionId={session.id}
                students={students}
                canEdit
                requireReason={false}
                materi={session.materi}
                tutorStatus={
                  (session.tutorAttendance?.status as "hadir" | "digantikan" | "tidak_hadir") ?? "hadir"
                }
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" /> Rekap Absensi
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {session.attendances.length === 0 ? (
                <EmptyState title="Belum ada absensi tersimpan" className="m-5" />
              ) : (
                <div className="divide-y">
                  {students.map((student) => (
                    <div key={student.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                      <div>
                        <p className="font-medium">{student.nama}</p>
                        <p className="text-xs text-muted-foreground">{student.studentCode ?? "-"}</p>
                      </div>
                      {attendanceByStudent.get(student.id) ? (
                        <StatusBadge status={attendanceByStudent.get(student.id)!} />
                      ) : (
                        <span className="text-xs text-muted-foreground">Belum diisi</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )
      ) : null}

      {session.materi ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" /> Materi / Catatan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700">{session.materi}</p>
          </CardContent>
        </Card>
      ) : null}
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
        className={`mt-1 text-lg font-bold capitalize ${
          tone === "danger" ? "text-red-600" : tone === "success" ? "text-emerald-700" : "text-slate-900"
        }`}
      >
        {value}
      </p>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
