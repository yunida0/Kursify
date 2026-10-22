import Link from "next/link";
import { Search, UserPlus, UsersRound } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { ActionForm } from "@/components/forms/action-form";
import { SearchFilters, FilterField } from "@/components/data-table/filters";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { createTutorAction } from "@/features/master/actions";

export const metadata = { title: "Tutor" };
export const dynamic = "force-dynamic";

export default async function TutorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("admin", "owner");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";

  const tutors = await prisma.tutor.findMany({
    where: q
      ? {
          OR: [
            { nama: { contains: q } },
            { tutorCode: { contains: q } },
            { keahlian: { contains: q } },
            { email: { contains: q } },
          ],
        }
      : undefined,
    include: {
      _count: { select: { classes: true, sessions: true } },
    },
    orderBy: { nama: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tutor"
        description="Kelola profil dan akun tutor. Tarif honor diatur terpisah oleh Owner."
      />

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" /> Tambah Tutor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={createTutorAction} submitLabel="Buat Akun Tutor" resetOnSuccess>
              <Field label="Nama Lengkap" htmlFor="nama" required>
                <Input id="nama" name="nama" required minLength={3} />
              </Field>
              <Field label="Email Akun" htmlFor="email" required>
                <Input id="email" name="email" type="email" required />
              </Field>
              <Field label="Nomor WhatsApp" htmlFor="noWa" required>
                <Input id="noWa" name="noWa" required minLength={9} inputMode="tel" />
              </Field>
              <Field label="Keahlian / Bidang" htmlFor="keahlian" required>
                <Input id="keahlian" name="keahlian" required minLength={2} placeholder="Contoh: Komputer, Bahasa Inggris" />
              </Field>
              <Field label="Password Awal" htmlFor="password" required hint="Minimal 8 karakter. Berikan kepada tutor untuk login.">
                <Input id="password" name="password" type="password" required minLength={8} />
              </Field>
            </ActionForm>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <SearchFilters action="/admin/tutor">
            <FilterField label="Cari tutor">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input name="q" defaultValue={q} placeholder="Nama, kode, keahlian, atau email" className="pl-9" />
              </div>
            </FilterField>
            <Button type="submit" variant="outline">
              Cari
            </Button>
          </SearchFilters>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <UsersRound className="h-4 w-4 text-primary" /> Daftar Tutor
              </CardTitle>
              <span className="text-xs text-muted-foreground">{tutors.length} tutor</span>
            </CardHeader>
            <CardContent className="p-0">
              {tutors.length === 0 ? (
                <EmptyState title="Belum ada tutor" description="Tambahkan tutor melalui formulir di samping." className="m-5" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/70">
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-5 py-3 font-semibold">Tutor</th>
                        <th className="px-3 py-3 font-semibold">Kontak</th>
                        <th className="px-3 py-3 font-semibold">Keahlian</th>
                        <th className="px-3 py-3 text-center font-semibold">Kelas</th>
                        <th className="px-3 py-3 text-center font-semibold">Sesi</th>
                        <th className="px-3 py-3 font-semibold">Status</th>
                        <th className="px-3 py-3 text-right font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tutors.map((tutor) => (
                        <tr key={tutor.id} className="border-b last:border-0">
                          <td className="px-5 py-3">
                            <p className="font-medium">{tutor.nama}</p>
                            <p className="text-xs text-muted-foreground">{tutor.tutorCode}</p>
                          </td>
                          <td className="px-3 py-3">
                            <p>{tutor.noWa}</p>
                            <p className="text-xs text-muted-foreground">{tutor.email ?? "-"}</p>
                          </td>
                          <td className="px-3 py-3 text-slate-600">{tutor.keahlian}</td>
                          <td className="px-3 py-3 text-center tabular-nums">{tutor._count.classes}</td>
                          <td className="px-3 py-3 text-center tabular-nums">{tutor._count.sessions}</td>
                          <td className="px-3 py-3">
                            <StatusBadge status={tutor.status} />
                          </td>
                          <td className="px-3 py-3 text-right">
                            <Link
                              href={`/admin/tutor/${tutor.id}`}
                              className="inline-flex h-8 items-center rounded-md border bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Detail
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
