import Link from "next/link";
import { Award, CheckCircle2, FileCheck2, XCircle } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { formatDate } from "@/lib/dates";
import { buildCertificateEligibility, type EligibilityRow } from "@/lib/services/grades";
import { getSettings } from "@/lib/services/settings";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { InlineAction } from "@/components/forms/inline-action";
import { issueCertificateAction } from "@/features/nilai/actions";

export const metadata = { title: "Sertifikat" };
export const dynamic = "force-dynamic";

export default async function SertifikatPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("admin", "owner");
  const params = await searchParams;
  const classId = typeof params.classId === "string" ? params.classId : "";

  const [classes, settings, certificates] = await Promise.all([
    prisma.courseClass.findMany({
      where: {
        ...(classId ? { id: classId } : {}),
        enrollments: { some: {} },
      },
      include: { program: { include: { materials: { orderBy: { urutan: "asc" } } } }, tutor: true },
      orderBy: { kodeKelas: "asc" },
    }),
    getSettings(),
    prisma.certificate.findMany({
      include: {
        enrollment: {
          include: {
            student: true,
            class: { include: { program: true } },
          },
        },
      },
      orderBy: { issuedAt: "desc" },
      take: 50,
    }),
  ]);

  const eligibilityByClass = await Promise.all(
    classes.map(async (kelas) => ({
      kelas,
      rows: await buildCertificateEligibility(kelas.id),
    })),
  );

  const allRows: { kelasKode: string; program: string; row: EligibilityRow }[] = eligibilityByClass.flatMap(
    ({ kelas, rows }) =>
      rows.map((row) => ({ kelasKode: kelas.kodeKelas, program: kelas.program.nama, row })),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sertifikat"
        description={`Kelulusan minimal ${settings.minLulus}, kehadiran minimal ${settings.minKehadiran}%, dan siswa tidak ditangguhkan.`}
      />

      <form method="get" action="/admin/sertifikat" className="flex flex-wrap items-end gap-2 rounded-xl border bg-white p-3">
        <label className="min-w-[220px] flex-1 space-y-1">
          <span className="text-xs font-medium text-slate-600">Filter Kelas</span>
          <Select name="classId" defaultValue={classId}>
            <option value="">Semua kelas</option>
            {classes.map((kelas) => (
              <option key={kelas.id} value={kelas.id}>
                {kelas.kodeKelas} · {kelas.program.nama}
              </option>
            ))}
          </Select>
        </label>
        <Button type="submit" variant="outline">
          Terapkan
        </Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Siswa dievaluasi" value={String(allRows.length)} />
        <Stat label="Layak disertifikasi" value={String(allRows.filter(({ row }) => row.eligible && !row.certificateId).length)} />
        <Stat label="Sertifikat terbit" value={String(certificates.length)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-primary" /> Daftar Kelayakan
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {allRows.length === 0 ? (
            <EmptyState title="Belum ada siswa untuk dievaluasi" description="Nilai dan absensi diperlukan sebelum sertifikat dapat diterbitkan." className="m-5" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70">
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-semibold">Siswa</th>
                    <th className="px-3 py-3 font-semibold">Kelas</th>
                    <th className="px-3 py-3 text-center font-semibold">Nilai</th>
                    <th className="px-3 py-3 text-center font-semibold">Rata-rata</th>
                    <th className="px-3 py-3 text-center font-semibold">Kehadiran</th>
                    <th className="px-3 py-3 font-semibold">Kelayakan</th>
                    <th className="px-3 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {allRows.map(({ kelasKode, program, row }) => (
                    <tr key={row.enrollmentId} className="border-b align-top last:border-0">
                      <td className="px-5 py-3">
                        <p className="font-medium">{row.nama}</p>
                        <p className="text-xs text-muted-foreground">{row.studentCode ?? "-"}</p>
                        <StatusBadge status={row.statusSiswa} className="mt-1" />
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium">{kelasKode}</p>
                        <p className="text-xs text-muted-foreground">{program}</p>
                      </td>
                      <td className="px-3 py-3 text-center text-xs">
                        {row.jumlahNilai}/{row.jumlahMateri}
                      </td>
                      <td className="px-3 py-3 text-center font-semibold tabular-nums">
                        {row.jumlahNilai > 0 ? row.rataRata.toLocaleString("id-ID") : "-"}
                        {row.jumlahNilai > 0 ? <p className="text-xs font-normal text-muted-foreground">{row.huruf} · {row.predikat}</p> : null}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={row.kehadiranPersen < settings.minKehadiran ? "font-semibold text-red-600" : "font-semibold text-emerald-600"}>
                          {row.kehadiranPersen.toLocaleString("id-ID")}%
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {row.certificateId ? (
                          <Badge variant="success">
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Terbit
                          </Badge>
                        ) : row.eligible ? (
                          <Badge variant="info">Layak</Badge>
                        ) : (
                          <div className="space-y-1">
                            <Badge variant="destructive">
                              <XCircle className="mr-1 h-3 w-3" /> Belum layak
                            </Badge>
                            <ul className="text-[10px] leading-tight text-red-600">
                              {row.reasons.map((reason) => (
                                <li key={reason}>{reason}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          {row.certificateId ? (
                            <>
                              <a
                                href={`/api/pdf/sertifikat/${row.enrollmentId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-8 items-center gap-1 rounded-md border bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Cetak
                              </a>
                              <a
                                href={`/api/pdf/penilaian/${row.enrollmentId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-8 items-center gap-1 rounded-md border bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Nilai
                              </a>
                            </>
                          ) : row.eligible ? (
                            <InlineAction
                              action={issueCertificateAction}
                              fields={{ enrollmentId: row.enrollmentId }}
                              label="Terbitkan"
                              variant="success"
                              confirmText={`Terbitkan sertifikat untuk ${row.nama}?`}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">Belum dapat diterbitkan</span>
                          )}
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
            <Award className="h-4 w-4 text-primary" /> Sertifikat Terbit
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {certificates.length === 0 ? (
            <EmptyState title="Belum ada sertifikat" className="m-5" />
          ) : (
            <div className="divide-y">
              {certificates.map((certificate) => (
                <div key={certificate.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{certificate.enrollment.student.nama}</p>
                    <p className="text-xs text-muted-foreground">
                      {certificate.certificateNo} · {certificate.enrollment.class.program.nama} ·{" "}
                      {formatDate(certificate.issuedAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{certificate.rataRata.toLocaleString("id-ID")} / {certificate.huruf}</p>
                    <p className="text-[10px] text-muted-foreground">{certificate.predikat}</p>
                  </div>
                  <Link
                    href={`/verifikasi/${certificate.verifyToken}`}
                    target="_blank"
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Verifikasi
                  </Link>
                  <a
                    href={`/api/pdf/sertifikat/${certificate.enrollmentId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    PDF
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
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
