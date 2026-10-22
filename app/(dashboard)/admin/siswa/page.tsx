import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { formatDate } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/data-table/pagination";
import { SearchFilters, FilterField } from "@/components/data-table/filters";

export const metadata = { title: "Data Siswa" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

export default async function SiswaPage({
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
            { nama: { contains: q } },
            { studentCode: { contains: q } },
            { noWa: { contains: q } },
            { noIdentitas: { contains: q } },
          ],
        }
      : {}),
  };

  const [students, total, programs] = await Promise.all([
    prisma.student.findMany({
      where,
      include: {
        program: true,
        enrollments: { where: { status: "aktif" }, include: { class: true } },
        invoices: {
          where: { status: { in: ["belum_dibayar", "dibayar_sebagian", "menunggak"] } },
          include: { payments: { where: { status: "valid" }, select: { nominal: true } } },
        },
      },
      orderBy: { registeredAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.student.count({ where }),
    prisma.program.findMany({ orderBy: { nama: "asc" }, select: { id: true, nama: true } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Data Siswa" description="Cari, filter, dan kelola seluruh siswa terdaftar.">
        <Link
          href="/admin/siswa/baru"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Tambah Siswa
        </Link>
      </PageHeader>

      <SearchFilters action="/admin/siswa">
        <FilterField label="Cari siswa" className="sm:max-w-xs">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input name="q" defaultValue={q} placeholder="Nama, nomor induk, WA, identitas" className="pl-9" />
          </div>
        </FilterField>
        <FilterField label="Status">
          <Select name="status" defaultValue={status}>
            <option value="">Semua status</option>
            <option value="pending">Pending</option>
            <option value="aktif">Aktif</option>
            <option value="ditangguhkan">Ditangguhkan</option>
            <option value="nonaktif">Nonaktif</option>
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

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Daftar Siswa
          </CardTitle>
          <span className="text-xs text-muted-foreground">{total} siswa</span>
        </CardHeader>
        <CardContent className="p-0">
          {students.length === 0 ? (
            <EmptyState title="Siswa tidak ditemukan" description="Ubah kata kunci atau filter pencarian." className="m-5" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70">
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-semibold">Siswa</th>
                    <th className="px-3 py-3 font-semibold">Program / Kelas</th>
                    <th className="px-3 py-3 font-semibold">Kontak</th>
                    <th className="px-3 py-3 font-semibold">Terdaftar</th>
                    <th className="px-3 py-3 text-right font-semibold">Tunggakan</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const tunggakan = student.invoices.reduce(
                      (sum, invoice) =>
                        sum +
                        Math.max(0, invoice.total - invoice.payments.reduce((s, p) => s + p.nominal, 0)),
                      0,
                    );
                    return (
                      <tr key={student.id} className="border-b last:border-0">
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-900">{student.nama}</p>
                          <p className="text-xs text-muted-foreground">{student.studentCode ?? "Belum ada nomor induk"}</p>
                        </td>
                        <td className="px-3 py-3">
                          <p className="text-sm">{student.program?.nama ?? "-"}</p>
                          <p className="text-xs text-muted-foreground">
                            {student.enrollments.map((enrollment) => enrollment.class.kodeKelas).join(", ") || "Belum di kelas"}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <p className="text-sm">{student.noWa}</p>
                          <p className="text-xs text-muted-foreground">{student.email ?? "-"}</p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">
                          {formatDate(student.registeredAt)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {tunggakan > 0 ? (
                            <span className="font-semibold text-red-600">{formatRupiah(tunggakan)}</span>
                          ) : (
                            <span className="text-emerald-600">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge status={student.status} />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end">
                            <Link
                              href={`/admin/siswa/${student.id}`}
                              className="inline-flex h-8 items-center rounded-md border bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Detail
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
              basePath="/admin/siswa"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
