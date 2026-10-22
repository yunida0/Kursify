import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ClipboardCheck, Plus, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { formatDate, formatDayName, formatTime } from "@/lib/dates";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ActionForm } from "@/components/forms/action-form";
import { InlineAction } from "@/components/forms/inline-action";
import { enrollStudentAction, removeEnrollmentAction } from "@/features/siswa/actions";
import { updateClassAction } from "@/features/master/actions";

export const metadata = { title: "Detail Kelas" };
export const dynamic = "force-dynamic";

export default async function KelasDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin", "owner");
  const { id } = await params;

  const kelas = await prisma.courseClass.findUnique({
    where: { id },
    include: {
      program: { include: { materials: { orderBy: { urutan: "asc" } } } },
      tutor: true,
      room: true,
      schedules: { orderBy: { hari: "asc" } },
      enrollments: {
        include: { student: true, certificate: true },
        orderBy: { createdAt: "asc" },
      },
      sessions: {
        include: {
          room: true,
          tutor: true,
          tutorAttendance: true,
          _count: { select: { attendances: true } },
        },
        orderBy: [{ tanggal: "asc" }, { jamMulai: "asc" }],
      },
    },
  });

  if (!kelas) notFound();

  const [tutors, rooms, candidates] = await Promise.all([
    prisma.tutor.findMany({ where: { status: "aktif" }, orderBy: { nama: "asc" } }),
    prisma.room.findMany({ orderBy: { nama: "asc" } }),
    prisma.student.findMany({
      where: {
        status: "aktif",
        programId: kelas.programId,
        enrollments: { none: { classId: id, status: "aktif" } },
      },
      orderBy: { nama: "asc" },
      select: { id: true, nama: true, studentCode: true },
    }),
  ]);

  const activeEnrollments = kelas.enrollments.filter((enrollment) => enrollment.status === "aktif");
  const completedSessions = kelas.sessions.filter((session) => session.status === "selesai");

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${kelas.kodeKelas} · ${kelas.program.nama}`}
        description={`${kelas.tutor.nama} · ${kelas.room.nama} · ${formatDate(kelas.tanggalMulai)}–${formatDate(kelas.tanggalSelesai)}`}
      >
        <Link
          href="/admin/kelas"
          className="inline-flex h-10 items-center rounded-lg border bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Kembali
        </Link>
        <Link
          href={`/tutor/nilai/${kelas.id}`}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <ClipboardCheck className="h-4 w-4" /> Nilai Kelas
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Siswa Aktif" value={`${activeEnrollments.length}/${kelas.kuota}`} />
        <Stat label="Total Sesi" value={String(kelas.sessions.length)} />
        <Stat label="Sesi Selesai" value={String(completedSessions.length)} />
        <Stat label="Materi Penilaian" value={String(kelas.program.materials.length)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Siswa di Kelas
              </CardTitle>
              <Badge variant={activeEnrollments.length >= kelas.kuota ? "destructive" : "info"}>
                {activeEnrollments.length}/{kelas.kuota} kuota
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              {kelas.enrollments.length === 0 ? (
                <EmptyState title="Belum ada siswa" description="Tempatkan siswa melalui formulir di samping." className="m-5" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/60">
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-5 py-2.5 font-semibold">Siswa</th>
                        <th className="px-3 py-2.5 font-semibold">Masuk</th>
                        <th className="px-3 py-2.5 font-semibold">Saldo</th>
                        <th className="px-3 py-2.5 font-semibold">Status</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kelas.enrollments.map((enrollment) => (
                        <tr key={enrollment.id} className="border-b last:border-0">
                          <td className="px-5 py-3">
                            <Link href={`/admin/siswa/${enrollment.studentId}`} className="font-medium hover:text-primary">
                              {enrollment.student.nama}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {enrollment.student.studentCode ?? "-"}
                            </p>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">
                            {formatDate(enrollment.tanggalMasuk)}
                          </td>
                          <td className="px-3 py-3 text-sm">
                            {enrollment.saldoPertemuan ?? "-"}
                            {enrollment.saldoPertemuan !== null ? " pertemuan" : ""}
                          </td>
                          <td className="px-3 py-3">
                            <StatusBadge status={enrollment.status} />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex justify-end">
                              {enrollment.status === "aktif" ? (
                                <InlineAction
                                  action={removeEnrollmentAction}
                                  fields={{ enrollmentId: enrollment.id, classId: kelas.id }}
                                  label="Keluarkan"
                                  confirmText={`Keluarkan ${enrollment.student.nama} dari kelas ini?`}
                                />
                              ) : enrollment.certificate ? (
                                <a
                                  href={`/api/pdf/sertifikat/${enrollment.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs font-semibold text-primary hover:underline"
                                >
                                  Sertifikat
                                </a>
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

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" /> Sesi Pembelajaran
              </CardTitle>
              <span className="text-xs text-muted-foreground">{kelas.sessions.length} sesi</span>
            </CardHeader>
            <CardContent className="p-0">
              {kelas.sessions.length === 0 ? (
                <EmptyState title="Belum ada sesi" className="m-5" />
              ) : (
                <div className="max-h-[520px] divide-y overflow-y-auto">
                  {kelas.sessions.map((session, index) => (
                    <div key={session.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link href={`/admin/sesi/${session.id}`} className="font-medium hover:text-primary">
                          {formatDate(session.tanggal)}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(session.jamMulai)}–{session.jamSelesai} · {session.room.nama} ·{" "}
                          {session._count.attendances} absensi
                        </p>
                      </div>
                      <StatusBadge status={session.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" /> Tempatkan Siswa
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeEnrollments.length >= kelas.kuota ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                  Kuota kelas sudah penuh ({kelas.kuota} siswa).
                </p>
              ) : candidates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Tidak ada siswa aktif program ini yang belum berada di kelas.
                </p>
              ) : (
                <ActionForm action={enrollStudentAction} submitLabel="Tempatkan" variant="outline" size="sm">
                  <input type="hidden" name="classId" value={kelas.id} />
                  <Field label="Siswa" htmlFor="studentId" required>
                    <Select id="studentId" name="studentId" required defaultValue="">
                      <option value="">Pilih siswa</option>
                      {candidates.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.studentCode ?? "-"} · {student.nama}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </ActionForm>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Jadwal Rutin</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {kelas.schedules.map((schedule) => (
                <div key={schedule.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <span>{formatDayName(schedule.hari)}</span>
                  <span className="text-muted-foreground">
                    {schedule.jamMulai}–{schedule.jamSelesai}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ubah Kelas</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm action={updateClassAction} submitLabel="Simpan Perubahan" variant="outline" size="sm">
                <input type="hidden" name="classId" value={kelas.id} />
                <Field label="Tutor" htmlFor="tutorId">
                  <Select id="tutorId" name="tutorId" defaultValue={kelas.tutorId}>
                    {tutors.map((tutor) => (
                      <option key={tutor.id} value={tutor.id}>
                        {tutor.nama}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Ruangan" htmlFor="roomId">
                  <Select id="roomId" name="roomId" defaultValue={kelas.roomId}>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.nama}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Kuota" htmlFor="kuota">
                    <Input id="kuota" name="kuota" type="number" min={activeEnrollments.length} defaultValue={kelas.kuota} />
                  </Field>
                  <Field label="Jenis" htmlFor="jenis">
                    <Select id="jenis" name="jenis" defaultValue={kelas.jenis}>
                      <option value="reguler">Reguler</option>
                      <option value="privat">Privat</option>
                    </Select>
                  </Field>
                </div>
                <Field label="Status" htmlFor="status">
                  <Select id="status" name="status" defaultValue={kelas.status}>
                    <option value="dibuka">Dibuka</option>
                    <option value="berjalan">Berjalan</option>
                    <option value="selesai">Selesai</option>
                    <option value="ditutup">Ditutup</option>
                  </Select>
                </Field>
                <p className="text-xs text-muted-foreground">
                  Perubahan tutor berlaku untuk sesi terjadwal ke depan.
                </p>
              </ActionForm>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}
