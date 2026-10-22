/* eslint-disable @next/next/no-html-link-for-pages */
import { Download, FileBarChart, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { monthKey, monthLabel, periodOptions } from "@/lib/dates";
import { getSettings } from "@/lib/services/settings";
import { attendanceReport, programPopularity } from "@/lib/services/reports";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Laporan Absensi & Program" };
export const dynamic = "force-dynamic";

export default async function LaporanAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("admin", "owner");
  const params = await searchParams;
  const periode = typeof params.periode === "string" ? params.periode : monthKey();
  const programId = typeof params.programId === "string" ? params.programId : "";
  const classId = typeof params.classId === "string" ? params.classId : "";

  const settings = await getSettings();
  const [programs, classes, attendance, popularity] = await Promise.all([
    prisma.program.findMany({ orderBy: { nama: "asc" } }),
    prisma.courseClass.findMany({ orderBy: { kodeKelas: "asc" }, select: { id: true, kodeKelas: true, programId: true } }),
    attendanceReport({ periode, programId: programId || undefined, classId: classId || undefined }, settings.minKehadiran),
    programPopularity(),
  ]);

  const exportQuery = new URLSearchParams({ periode });
  if (programId) exportQuery.set("programId", programId);
  if (classId) exportQuery.set("classId", classId);

  const filteredClasses = programId ? classes.filter((kelas) => kelas.programId === programId) : classes;
  const low = attendance.rows.filter((row) => row.diBawahMinimum);
  const totalHadir = attendance.rows.reduce((sum, row) => sum + row.hadir, 0);
  const totalAlpa = attendance.rows.reduce((sum, row) => sum + row.alpa, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Absensi & Program"
        description={`Rekap ${monthLabel(periode)} · ${attendance.totalSesi} sesi selesai`}
      >
        <a
          href={`/api/export/absensi?${exportQuery.toString()}&format=pdf`}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <Download className="h-4 w-4" /> PDF Absensi
        </a>
        <a
          href={`/api/export/absensi?${exportQuery.toString()}&format=xlsx`}
          className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Download className="h-4 w-4" /> Excel
        </a>
      </PageHeader>

      <form method="get" action="/admin/laporan" className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-3">
        <label className="min-w-[160px] flex-1 space-y-1">
          <span className="text-xs font-medium text-slate-600">Periode</span>
          <Select name="periode" defaultValue={periode}>
            {periodOptions().map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="min-w-[180px] flex-1 space-y-1">
          <span className="text-xs font-medium text-slate-600">Program</span>
          <Select name="programId" defaultValue={programId}>
            <option value="">Semua program</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.nama}
              </option>
            ))}
          </Select>
        </label>
        <label className="min-w-[180px] flex-1 space-y-1">
          <span className="text-xs font-medium text-slate-600">Kelas</span>
          <Select name="classId" defaultValue={classId}>
            <option value="">Semua kelas</option>
            {filteredClasses.map((kelas) => (
              <option key={kelas.id} value={kelas.id}>
                {kelas.kodeKelas}
              </option>
            ))}
          </Select>
        </label>
        <Button type="submit" variant="outline">
          Terapkan
        </Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Sesi selesai" value={String(attendance.totalSesi)} />
        <Stat label="Total kehadiran" value={String(totalHadir)} />
        <Stat label="Total alpa" value={String(totalAlpa)} />
        <Stat label={`Di bawah ${settings.minKehadiran}%`} value={String(low.length)} danger={low.length > 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileBarChart className="h-4 w-4 text-primary" /> Rekap Kehadiran Siswa
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {attendance.rows.length === 0 ? (
            <EmptyState title="Belum ada data absensi" description="Pilih periode lain atau isi absensi sesi terlebih dahulu." className="m-5" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70">
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-semibold">Siswa</th>
                    <th className="px-3 py-3 font-semibold">Kelas</th>
                    <th className="px-3 py-3 text-center font-semibold">H</th>
                    <th className="px-3 py-3 text-center font-semibold">I</th>
                    <th className="px-3 py-3 text-center font-semibold">S</th>
                    <th className="px-3 py-3 text-center font-semibold">A</th>
                    <th className="px-3 py-3 text-center font-semibold">Total</th>
                    <th className="px-3 py-3 text-center font-semibold">Kehadiran</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.rows.map((row) => (
                    <tr key={`${row.classId}:${row.studentId}`} className="border-b last:border-0">
                      <td className="px-5 py-3">
                        <p className="font-medium">{row.nama}</p>
                        <p className="text-xs text-muted-foreground">{row.studentCode}</p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-sm">{row.kelas}</p>
                        <p className="text-xs text-muted-foreground">{row.program}</p>
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums">{row.hadir}</td>
                      <td className="px-3 py-3 text-center tabular-nums">{row.izin}</td>
                      <td className="px-3 py-3 text-center tabular-nums">{row.sakit}</td>
                      <td className="px-3 py-3 text-center tabular-nums">{row.alpa}</td>
                      <td className="px-3 py-3 text-center tabular-nums">{row.total}</td>
                      <td className="px-3 py-3 text-center">
                        <Badge variant={row.diBawahMinimum ? "destructive" : "success"}>
                          {row.persen.toLocaleString("id-ID")}%
                        </Badge>
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
            <TrendingUp className="h-4 w-4 text-primary" /> Program Terpopuler
          </CardTitle>
          <div className="flex gap-2">
            <a
              href="/api/export/program?format=pdf"
              className="inline-flex h-8 items-center gap-1 rounded-md border bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" /> PDF
            </a>
            <a
              href="/api/export/program?format=xlsx"
              className="inline-flex h-8 items-center gap-1 rounded-md border bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" /> Excel
            </a>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {popularity.length === 0 ? (
            <EmptyState title="Belum ada program" className="m-5" />
          ) : (
            <div className="divide-y">
              {popularity.map((row) => (
                <div key={row.programId} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{row.nama} {row.level ? `(${row.level})` : ""}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.kode} · {row.jumlahKelas} kelas · {row.jumlahSiswa} siswa aktif
                    </p>
                  </div>
                  <div className="w-40">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, row.persentase)}%` }} />
                    </div>
                    <p className="mt-1 text-right text-xs text-muted-foreground">{row.persentase}% keterisian</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-bold ${danger ? "text-red-600" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}
