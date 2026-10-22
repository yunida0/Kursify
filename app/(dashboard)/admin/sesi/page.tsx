import Link from "next/link";
import { CalendarClock, Search } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { addDays, dateOnly, formatDate, formatTime, todayDateOnly } from "@/lib/dates";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/data-table/pagination";
import { SearchFilters, FilterField } from "@/components/data-table/filters";

export const metadata = { title: "Kalender Sesi" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function SesiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("admin", "owner");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = typeof params.status === "string" ? params.status : "";
  const tanggal = typeof params.tanggal === "string" ? params.tanggal : "";
  const page = Math.max(1, Number(typeof params.page === "string" ? params.page : 1) || 1);

  const where = {
    ...(status ? { status } : {}),
    ...(tanggal ? { tanggal: { gte: dateOnly(tanggal), lt: addDays(dateOnly(tanggal), 1) } } : {}),
    ...(q
      ? {
          OR: [
            { class: { kodeKelas: { contains: q } } },
            { class: { program: { nama: { contains: q } } } },
            { tutor: { nama: { contains: q } } },
          ],
        }
      : {}),
  };

  const [sessions, total] = await Promise.all([
    prisma.session.findMany({
      where,
      include: {
        class: { include: { program: true } },
        tutor: true,
        room: true,
        tutorAttendance: true,
        _count: { select: { attendances: true } },
      },
      orderBy: [{ tanggal: "asc" }, { jamMulai: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.session.count({ where }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kalender Sesi"
        description="Pantau seluruh sesi, batalkan sesi, buat sesi pengganti, dan koreksi absensi."
      />

      <SearchFilters action="/admin/sesi">
        <FilterField label="Cari sesi">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={q} placeholder="Kelas, program, atau tutor" className="pl-9" />
          </div>
        </FilterField>
        <FilterField label="Tanggal">
          <Input type="date" name="tanggal" defaultValue={tanggal} />
        </FilterField>
        <FilterField label="Status">
          <Select name="status" defaultValue={status}>
            <option value="">Semua status</option>
            <option value="terjadwal">Terjadwal</option>
            <option value="selesai">Selesai</option>
            <option value="dibatalkan">Dibatalkan</option>
          </Select>
        </FilterField>
        <Button type="submit" variant="outline">
          Terapkan
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/admin/sesi?tanggal=${todayDateOnly().toISOString().slice(0, 10)}`}>Hari ini</Link>
        </Button>
      </SearchFilters>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" /> Daftar Sesi
          </CardTitle>
          <span className="text-xs text-muted-foreground">{total} sesi</span>
        </CardHeader>
        <CardContent className="p-0">
          {sessions.length === 0 ? (
            <EmptyState title="Tidak ada sesi" description="Ubah filter atau buat kelas baru untuk menjadwalkan sesi." className="m-5" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70">
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-semibold">Tanggal</th>
                    <th className="px-3 py-3 font-semibold">Kelas / Program</th>
                    <th className="px-3 py-3 font-semibold">Tutor</th>
                    <th className="px-3 py-3 font-semibold">Ruangan</th>
                    <th className="px-3 py-3 text-center font-semibold">Absensi</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.id} className="border-b last:border-0">
                      <td className="whitespace-nowrap px-5 py-3">
                        <p className="font-medium">{formatDate(session.tanggal)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(session.jamMulai)}–{formatTime(session.jamSelesai)}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium">{session.class.kodeKelas}</p>
                        <p className="text-xs text-muted-foreground">{session.class.program.nama}</p>
                      </td>
                      <td className="px-3 py-3">{session.tutor.nama}</td>
                      <td className="px-3 py-3 text-slate-600">{session.room.nama}</td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-sm font-semibold tabular-nums">{session._count.attendances}</span>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={session.status} />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Link
                          href={`/admin/sesi/${session.id}`}
                          className="inline-flex h-8 items-center rounded-md border bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Kelola
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-4">
            <Pagination
              page={page}
              totalPages={Math.ceil(total / PAGE_SIZE)}
              totalItems={total}
              pageSize={PAGE_SIZE}
              searchParams={params}
              basePath="/admin/sesi"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
