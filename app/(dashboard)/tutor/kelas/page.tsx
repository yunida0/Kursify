import Link from "next/link";
import type { Prisma } from "@prisma/client";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  Clock3,
  GraduationCap,
  MapPin,
  Search,
  Users,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { formatDate, formatDayName, formatTime } from "@/lib/dates";
import { requireTutorProfile } from "@/lib/tutor";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { SearchFilters, FilterField } from "@/components/data-table/filters";

export const metadata = { title: "Kelas Saya" };
export const dynamic = "force-dynamic";

export default async function TutorClassesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireRole("tutor");
  const tutor = await requireTutorProfile(actor);
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = typeof params.status === "string" ? params.status : "";

  const where: Prisma.CourseClassWhereInput = {
    tutorId: tutor.id,
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { kodeKelas: { contains: q } },
            { program: { nama: { contains: q } } },
          ],
        }
      : {}),
  };

  const now = new Date();
  const classes = await prisma.courseClass.findMany({
    where,
    include: {
      program: true,
      room: true,
      schedules: { orderBy: [{ hari: "asc" }, { jamMulai: "asc" }] },
      enrollments: { where: { status: "aktif" }, select: { id: true } },
      sessions: {
        where: { tanggal: { gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) }, status: "terjadwal" },
        orderBy: [{ tanggal: "asc" }, { jamMulai: "asc" }],
        take: 1,
      },
      _count: { select: { sessions: true } },
    },
    orderBy: [{ status: "asc" }, { kodeKelas: "asc" }],
  });

  const totalStudents = classes.reduce((sum, kelas) => sum + kelas.enrollments.length, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kelas Saya"
        description={`${classes.length} kelas · ${totalStudents} siswa aktif · ${tutor.nama}`}
      />

      <SearchFilters action="/tutor/kelas">
        <FilterField label="Cari kelas / program" className="sm:max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={q} placeholder="Kode kelas atau nama program" className="pl-9" />
          </div>
        </FilterField>
        <FilterField label="Status">
          <Select name="status" defaultValue={status}>
            <option value="">Semua status</option>
            <option value="dibuka">Dibuka</option>
            <option value="berjalan">Berjalan</option>
            <option value="ditutup">Ditutup</option>
          </Select>
        </FilterField>
        <Button type="submit" variant="outline">
          Cari
        </Button>
      </SearchFilters>

      {classes.length === 0 ? (
        <EmptyState
          title="Belum ada kelas"
          description="Anda belum ditugaskan pada kelas yang sesuai filter."
          className="rounded-xl border bg-white py-16"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((kelas) => {
            const next = kelas.sessions[0];
            return (
              <Card key={kelas.id} className="flex flex-col transition-shadow hover:shadow-md">
                <CardContent className="flex flex-1 flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold tracking-tight text-slate-900">{kelas.kodeKelas}</p>
                      <p className="text-sm text-slate-600">{kelas.program.nama}</p>
                      {kelas.program.level ? (
                        <p className="text-xs text-muted-foreground">Level {kelas.program.level}</p>
                      ) : null}
                    </div>
                    <StatusBadge status={kelas.status} />
                  </div>

                  <div className="grid gap-1.5 text-xs text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-slate-400" /> {kelas.enrollments.length}/{kelas.kuota} siswa
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" /> {kelas.room.nama}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                      {kelas.schedules.length > 0
                        ? kelas.schedules
                            .map((s) => `${formatDayName(s.hari)} ${formatTime(s.jamMulai)}`)
                            .join(" · ")
                        : "Jadwal belum diatur"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                      {formatDate(kelas.tanggalMulai)} – {formatDate(kelas.tanggalSelesai)}
                    </span>
                  </div>

                  <div className="rounded-lg border bg-slate-50/70 px-3 py-2 text-xs">
                    {next ? (
                      <>
                        <p className="font-semibold text-slate-700">Sesi berikutnya</p>
                        <p className="text-muted-foreground">
                          {formatDate(next.tanggal)} · {next.jamMulai}–{next.jamSelesai}
                        </p>
                      </>
                    ) : (
                      <p className="text-muted-foreground">Tidak ada sesi terjadwal.</p>
                    )}
                  </div>

                  <div className="mt-auto flex flex-wrap gap-2">
                    <Link
                      href={`/tutor/kelas/${kelas.id}`}
                      className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md bg-primary px-3 text-xs font-semibold text-white hover:bg-primary/90"
                    >
                      Buka Kelas <ChevronRight className="h-3 w-3" />
                    </Link>
                    <Link
                      href={`/tutor/nilai/${kelas.id}`}
                      className="inline-flex h-8 items-center justify-center gap-1 rounded-md border bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <GraduationCap className="h-3 w-3" /> Nilai
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        <BookOpen className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Hanya kelas dengan Anda sebagai tutor utama yang tampil di sini. Bila Anda mengajar sebagai
          tutor pengganti, sesi tetap muncul pada dashboard sesuai penugasan Admin.
        </p>
      </div>
    </div>
  );
}
