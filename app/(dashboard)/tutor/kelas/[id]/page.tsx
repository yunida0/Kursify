import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  MapPin,
  Users,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { formatDate, formatDayName, formatTime } from "@/lib/dates";
import { attendancePercentage } from "@/lib/rules/attendance";
import { averageScore, gradeForAverage } from "@/lib/rules/grading";
import { requireTutorProfile } from "@/lib/tutor";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Detail Kelas" };
export const dynamic = "force-dynamic";

export default async function TutorClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireRole("tutor");
  const tutor = await requireTutorProfile(actor);
  const { id } = await params;

  const kelas = await prisma.courseClass.findUnique({
    where: { id },
    include: {
      program: { include: { materials: { orderBy: { urutan: "asc" } } } },
      room: true,
      tutor: true,
      schedules: { orderBy: [{ hari: "asc" }, { jamMulai: "asc" }] },
      enrollments: {
        orderBy: { student: { nama: "asc" } },
        include: { student: true, grades: true, certificate: true },
      },
      sessions: {
        include: {
          room: true,
          attendances: { select: { studentId: true, status: true } },
          tutorAttendance: true,
        },
        orderBy: [{ tanggal: "desc" }, { jamMulai: "asc" }],
      },
    },
  });
  if (!kelas) notFound();
  if (kelas.tutorId !== tutor.id) notFound();

  const activeEnrollments = kelas.enrollments.filter((e) => e.status === "aktif");
  const completedSessions = kelas.sessions.filter((s) => s.status === "selesai");
  const totalSelesai = completedSessions.length;

  const hadirMap = new Map<string, number>();
  for (const session of completedSessions) {
    for (const a of session.attendances) {
      if (a.status === "hadir") hadirMap.set(a.studentId, (hadirMap.get(a.studentId) ?? 0) + 1);
    }
  }

  const averageAttendance =
    activeEnrollments.length === 0
      ? 0
      : Math.round(
          (activeEnrollments.reduce(
            (sum, en) => sum + attendancePercentage(hadirMap.get(en.studentId) ?? 0, totalSelesai),
            0,
          ) /
            activeEnrollments.length) *
            100,
        ) / 100;

  return (
    <div className="space-y-6">
      <PageHeader
        title={kelas.kodeKelas}
        description={`${kelas.program.nama} · ${kelas.room.nama} · ${formatDate(kelas.tanggalMulai)} – ${formatDate(kelas.tanggalSelesai)}`}
      >
        <Link
          href="/tutor/kelas"
          className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>
        <Link
          href={`/tutor/nilai/${kelas.id}`}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <GraduationCap className="h-4 w-4" /> Input Nilai
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Info label="Siswa Aktif" value={`${activeEnrollments.length} siswa`} hint={`Kuota ${kelas.kuota}`} />
        <Info label="Sesi Selesai" value={`${totalSelesai} sesi`} hint={`dari ${kelas.sessions.length} sesi`} />
        <Info label="Rata-rata Kehadiran" value={`${averageAttendance.toLocaleString("id-ID")}%`} hint="Seluruh siswa aktif" tone={averageAttendance >= 75 ? "success" : "danger"} />
        <Info
          label="Jadwal"
          value={kelas.schedules.length > 0 ? `${kelas.schedules.length} jadwal` : "Belum diatur"}
          hint={
            kelas.schedules.length > 0
              ? kelas.schedules.map((s) => `${formatDayName(s.hari)} ${s.jamMulai}`).join(" · ")
              : "-"
          }
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Siswa & Kehadiran
          </CardTitle>
          <span className="text-xs text-muted-foreground">{kelas.enrollments.length} enrollment</span>
        </CardHeader>
        <CardContent className="p-0">
          {kelas.enrollments.length === 0 ? (
            <EmptyState title="Belum ada siswa" description="Siswa yang terdaftar akan tampil di sini." className="m-5" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70">
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-semibold">Siswa</th>
                    <th className="px-3 py-3 font-semibold">Kontak</th>
                    <th className="px-3 py-3 text-right font-semibold">Hadir</th>
                    <th className="px-3 py-3 text-right font-semibold">Rata-rata Nilai</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold">Sertifikat</th>
                  </tr>
                </thead>
                <tbody>
                  {kelas.enrollments.map((enrollment) => {
                    const hadir = hadirMap.get(enrollment.studentId) ?? 0;
                    const persen = attendancePercentage(hadir, totalSelesai);
                    const avg = averageScore(enrollment.grades.map((g) => g.nilai));
                    const { huruf } = gradeForAverage(avg);
                    return (
                      <tr key={enrollment.id} className="border-b align-top last:border-0">
                        <td className="px-5 py-3">
                          <p className="font-medium">{enrollment.student.nama}</p>
                          <p className="text-xs text-muted-foreground">{enrollment.student.studentCode ?? "-"}</p>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600">
                          {enrollment.student.noWa}
                          <p className="text-[10px] text-muted-foreground">{enrollment.student.email ?? "-"}</p>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <p className={`font-semibold tabular-nums ${persen < 75 ? "text-red-600" : "text-emerald-700"}`}>
                            {persen.toLocaleString("id-ID")}%
                          </p>
                          <p className="text-[10px] text-muted-foreground">{hadir}/{totalSelesai} sesi</p>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {enrollment.grades.length === 0 ? (
                            <span className="text-xs text-muted-foreground">Belum ada</span>
                          ) : (
                            <>
                              <p className="font-semibold">{avg.toLocaleString("id-ID")}</p>
                              <p className="text-[10px] text-muted-foreground">{huruf}</p>
                            </>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge status={enrollment.status} />
                        </td>
                        <td className="px-3 py-3">
                          {enrollment.certificate ? (
                            <a
                              href={`/api/pdf/sertifikat/${enrollment.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold text-primary hover:underline"
                            >
                              {enrollment.certificate.certificateNo}
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">Belum terbit</span>
                          )}
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

      {kelas.program.materials.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary" /> Materi Penilaian
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {kelas.program.materials.map((material) => (
                <span key={material.id} className="rounded-full border bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                  {material.urutan}. {material.nama}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" /> Riwayat Sesi
          </CardTitle>
          <span className="text-xs text-muted-foreground">{kelas.sessions.length} sesi</span>
        </CardHeader>
        <CardContent className="p-0">
          {kelas.sessions.length === 0 ? (
            <EmptyState title="Belum ada sesi" className="m-5" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70">
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-semibold">Tanggal</th>
                    <th className="px-3 py-3 font-semibold">Jam</th>
                    <th className="px-3 py-3 font-semibold">Ruangan</th>
                    <th className="px-3 py-3 font-semibold">Kehadiran</th>
                    <th className="px-3 py-3 font-semibold">Materi</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {kelas.sessions.map((session) => {
                    const hadir = session.attendances.filter((a) => a.status === "hadir").length;
                    return (
                      <tr key={session.id} className="border-b last:border-0">
                        <td className="whitespace-nowrap px-5 py-3 text-slate-600">{formatDate(session.tanggal)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">
                          {formatTime(session.jamMulai)}–{formatTime(session.jamSelesai)}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-slate-400" /> {session.room.nama}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600">
                          {session.attendances.length > 0 ? `${hadir}/${session.attendances.length} hadir` : "-"}
                          {session.tutorAttendance ? (
                            <p className="text-[10px] text-muted-foreground">Tutor: {session.tutorAttendance.status}</p>
                          ) : null}
                        </td>
                        <td className="max-w-[240px] px-3 py-3 text-xs text-slate-600">{session.materi ?? "-"}</td>
                        <td className="px-3 py-3">
                          <StatusBadge status={session.status} />
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Link
                            href={`/tutor/sesi/${session.id}`}
                            className="inline-flex h-8 items-center gap-1 rounded-md border bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <ClipboardCheck className="h-3 w-3" /> Absensi
                          </Link>
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

      <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Kehadiran dihitung dari sesi berstatus selesai. Nilai dapat diinput pada halaman Nilai setelah
          final test dilaksanakan. Sertifikat diterbitkan Admin setelah seluruh syarat terpenuhi.
        </p>
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
  hint: string;
  tone?: "success" | "danger";
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-lg font-bold ${
          tone === "danger" ? "text-red-600" : tone === "success" ? "text-emerald-700" : "text-slate-900"
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
