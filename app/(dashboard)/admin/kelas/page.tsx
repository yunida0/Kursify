import Link from "next/link";
import { CalendarDays, Plus, Search } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { formatDate, formatDayName } from "@/lib/dates";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/data-table/pagination";
import { SearchFilters, FilterField } from "@/components/data-table/filters";

export const metadata = { title: "Kelas & Jadwal" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

export default async function KelasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("admin", "owner");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = typeof params.status === "string" ? params.status : "";
  const programId = typeof params.programId === "string" ? params.programId : "";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : 1) || 1);

  const where = {
    ...(status ? { status } : {}),
    ...(programId ? { programId } : {}),
    ...(q
      ? {
          OR: [
            { kodeKelas: { contains: q } },
            { tutor: { nama: { contains: q } } },
            { program: { nama: { contains: q } } },
          ],
        }
      : {}),
  };

  const [classes, total, programs] = await Promise.all([
    prisma.courseClass.findMany({
      where,
      include: {
        program: true,
        tutor: true,
        room: true,
        schedules: { orderBy: { hari: "asc" } },
        _count: {
          select: {
            enrollments: { where: { status: "aktif" } },
            sessions: true,
          },
        },
      },
      orderBy: [{ status: "asc" }, { kodeKelas: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.courseClass.count({ where }),
    prisma.program.findMany({ orderBy: { nama: "asc" }, select: { id: true, nama: true } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Kelas & Jadwal" description="Atur kelas, jadwal rutin, tutor, ruangan, dan penempatan siswa.">
        <Link
          href="/admin/kelas/baru"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Buat Kelas
        </Link>
      </PageHeader>

      <SearchFilters action="/admin/kelas">
        <FilterField label="Cari kelas">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={q} placeholder="Kode kelas, tutor, program" className="pl-9" />
          </div>
        </FilterField>
        <FilterField label="Status">
          <Select name="status" defaultValue={status}>
            <option value="">Semua status</option>
            <option value="dibuka">Dibuka</option>
            <option value="berjalan">Berjalan</option>
            <option value="selesai">Selesai</option>
            <option value="ditutup">Ditutup</option>
          </Select>
        </FilterField>
        <FilterField label="Program">
          <Select name="programId" defaultValue={programId}>
            <option value="">Semua program</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.nama}
              </option>
            ))}
          </Select>
        </FilterField>
        <Button type="submit" variant="outline">
          Terapkan
        </Button>
      </SearchFilters>

      {classes.length === 0 ? (
        <Card>
          <EmptyState title="Belum ada kelas" description="Buat kelas pertama untuk mulai menjadwalkan sesi." className="py-12" />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((kelas) => (
            <Link
              key={kelas.id}
              href={`/admin/kelas/${kelas.id}`}
              className="rounded-xl border bg-white p-5 shadow-sm transition-colors hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{kelas.kodeKelas}</p>
                  <p className="text-xs text-muted-foreground">{kelas.program.nama}</p>
                </div>
                <StatusBadge status={kelas.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge variant="outline">{kelas.jenis}</Badge>
                <Badge variant={kelas._count.enrollments >= kelas.kuota ? "destructive" : "info"}>
                  {kelas._count.enrollments}/{kelas.kuota} siswa
                </Badge>
                <Badge variant="muted">{kelas._count.sessions} sesi</Badge>
              </div>
              <div className="mt-4 space-y-1.5 border-t pt-3 text-xs text-slate-600">
                <p className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-primary" />
                  {formatDate(kelas.tanggalMulai)} – {formatDate(kelas.tanggalSelesai)}
                </p>
                <p>Tutor: {kelas.tutor.nama}</p>
                <p>Ruangan: {kelas.room.nama}</p>
                <p className="line-clamp-2">
                  {kelas.schedules.map((s) => `${formatDayName(s.hari)} ${s.jamMulai}–${s.jamSelesai}`).join(" · ")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="pt-4">
          <Pagination
            page={page}
            totalPages={Math.ceil(total / PAGE_SIZE)}
            totalItems={total}
            pageSize={PAGE_SIZE}
            searchParams={params}
            basePath="/admin/kelas"
          />
        </CardContent>
      </Card>
    </div>
  );
}
