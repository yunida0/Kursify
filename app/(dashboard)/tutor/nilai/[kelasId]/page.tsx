import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  GraduationCap,
  Info as InfoIcon,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { dateInputValue, todayDateOnly } from "@/lib/dates";
import { buildCertificateEligibility } from "@/lib/services/grades";
import { requireTutorProfile } from "@/lib/tutor";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { GradeForm } from "@/features/nilai/grade-form";

export const metadata = { title: "Input Nilai" };
export const dynamic = "force-dynamic";

export default async function TutorGradesPage({
  params,
}: {
  params: Promise<{ kelasId: string }>;
}) {
  const actor = await requireRole("tutor");
  const tutor = await requireTutorProfile(actor);
  const { kelasId } = await params;

  const kelas = await prisma.courseClass.findUnique({
    where: { id: kelasId },
    include: {
      program: { include: { materials: { orderBy: { urutan: "asc" } } } },
      room: true,
      enrollments: {
        where: { status: "aktif" },
        orderBy: { student: { nama: "asc" } },
        include: {
          student: true,
          grades: true,
          certificate: true,
        },
      },
    },
  });
  if (!kelas) notFound();
  if (kelas.tutorId !== tutor.id) notFound();

  const eligibility = await buildCertificateEligibility(kelas.id);
  const eligibleCount = eligibility.filter((row) => row.eligible).length;
  const certificateCount = eligibility.filter((row) => row.certificateId).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Nilai ${kelas.kodeKelas}`}
        description={`${kelas.program.nama} · ${kelas.enrollments.length} siswa aktif · ${kelas.program.materials.length} materi penilaian`}
      >
        <Link
          href={`/tutor/kelas/${kelas.id}`}
          className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" /> Detail Kelas
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="Siswa Aktif" value={String(kelas.enrollments.length)} hint="Peserta kelas" icon={<Users className="h-4 w-4 text-primary" />} />
        <Summary label="Materi" value={String(kelas.program.materials.length)} hint="Komponen nilai" icon={<GraduationCap className="h-4 w-4 text-primary" />} />
        <Summary
          label="Memenuhi Syarat"
          value={String(eligibleCount)}
          hint="Nilai & kehadiran cukup"
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          tone="success"
        />
        <Summary
          label="Sertifikat Terbit"
          value={String(certificateCount)}
          hint="Diterbitkan Admin"
          icon={<ShieldCheck className="h-4 w-4 text-indigo-600" />}
        />
      </div>

      {kelas.program.materials.length === 0 ? (
        <EmptyState
          title="Program belum memiliki materi"
          description="Admin perlu menambahkan materi penilaian pada program sebelum nilai dapat diinput."
          className="rounded-xl border bg-white py-16"
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary" /> Formulir Nilai Final Test
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GradeForm
              classId={kelas.id}
              materials={kelas.program.materials.map((m) => ({ id: m.id, nama: m.nama }))}
              enrollments={kelas.enrollments.map((en) => ({
                enrollmentId: en.id,
                nama: en.student.nama,
                studentCode: en.student.studentCode,
                grades: Object.fromEntries(en.grades.map((g) => [g.materialId, g.nilai])),
              }))}
              tanggalTest={dateInputValue(todayDateOnly())}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-indigo-600" /> Kelayakan Sertifikat
          </CardTitle>
          <span className="text-xs text-muted-foreground">{eligibleCount} dari {eligibility.length} siswa</span>
        </CardHeader>
        <CardContent className="p-0">
          {eligibility.length === 0 ? (
            <EmptyState title="Belum ada siswa" className="m-5" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70">
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-semibold">Siswa</th>
                    <th className="px-3 py-3 text-right font-semibold">Nilai</th>
                    <th className="px-3 py-3 text-right font-semibold">Rata-rata</th>
                    <th className="px-3 py-3 font-semibold">Huruf</th>
                    <th className="px-3 py-3 text-right font-semibold">Kehadiran</th>
                    <th className="px-3 py-3 font-semibold">Kelayakan</th>
                    <th className="px-3 py-3 font-semibold">Sertifikat</th>
                  </tr>
                </thead>
                <tbody>
                  {eligibility.map((row) => (
                    <tr key={row.enrollmentId} className="border-b align-top last:border-0">
                      <td className="px-5 py-3">
                        <p className="font-medium">{row.nama}</p>
                        <p className="text-xs text-muted-foreground">{row.studentCode ?? "-"}</p>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {row.jumlahNilai}/{row.jumlahMateri}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">
                        {row.rataRata.toLocaleString("id-ID")}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={row.rataRata >= 75 ? "success" : "destructive"}>{row.huruf}</Badge>
                        <p className="mt-1 text-[10px] text-muted-foreground">{row.predikat}</p>
                      </td>
                      <td className={`px-3 py-3 text-right tabular-nums ${row.kehadiranPersen < 75 ? "text-red-600" : "text-slate-700"}`}>
                        {row.kehadiranPersen.toLocaleString("id-ID")}%
                      </td>
                      <td className="max-w-[240px] px-3 py-3">
                        {row.eligible ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Memenuhi syarat
                          </span>
                        ) : (
                          <div className="text-xs text-red-600">
                            <span className="inline-flex items-center gap-1 font-semibold">
                              <XCircle className="h-3.5 w-3.5" /> Belum memenuhi
                            </span>
                            <ul className="mt-1 list-disc pl-4 text-[10px] text-muted-foreground">
                              {row.reasons.map((reason) => (
                                <li key={reason}>{reason}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {row.certificateId ? (
                          <a
                            href={`/api/pdf/sertifikat/${row.enrollmentId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-primary hover:underline"
                          >
                            Unduh PDF
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">Belum terbit</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-900">
        <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Nilai yang sudah memiliki sertifikat tidak dapat diubah. Kelayakan dihitung dari kelengkapan
          nilai, rata-rata minimal, kehadiran minimal, dan status siswa sesuai pengaturan lembaga.
        </p>
      </div>
    </div>
  );
}

function Summary({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone?: "success";
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className={`mt-1 text-lg font-bold tabular-nums ${tone === "success" ? "text-emerald-700" : "text-slate-900"}`}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
