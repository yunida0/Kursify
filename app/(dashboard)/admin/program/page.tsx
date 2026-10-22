import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { formatRupiah } from "@/lib/money";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ActionForm } from "@/components/forms/action-form";
import { saveProgramAction } from "@/features/master/actions";

export const metadata = { title: "Program & Materi" };
export const dynamic = "force-dynamic";

export default async function ProgramPage() {
  await requireRole("admin", "owner");
  const programs = await prisma.program.findMany({
    include: {
      parent: true,
      _count: { select: { materials: true, classes: true, students: true } },
    },
    orderBy: { nama: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Program & Materi"
        description="Kelola program kursus, skema tagihan, tarif, dan materi penilaian."
      />

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" /> Program Baru
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProgramForm programs={programs.map((p) => ({ id: p.id, nama: p.nama }))} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" /> Daftar Program
            </CardTitle>
            <span className="text-xs text-muted-foreground">{programs.length} program</span>
          </CardHeader>
          <CardContent className="grid gap-4 p-5 md:grid-cols-2">
            {programs.map((program) => (
              <Link
                key={program.id}
                href={`/admin/program/${program.id}`}
                className="rounded-xl border p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{program.nama}</p>
                    <p className="text-xs text-muted-foreground">
                      {program.kode} {program.level ? `· ${program.level}` : ""}
                    </p>
                  </div>
                  <Badge variant={program.isActive ? "success" : "muted"}>
                    {program.isActive ? "Aktif" : "Nonaktif"}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="font-bold">{program._count.materials}</p>
                    <p className="text-muted-foreground">Materi</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="font-bold">{program._count.classes}</p>
                    <p className="text-muted-foreground">Kelas</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="font-bold">{program._count.students}</p>
                    <p className="text-muted-foreground">Siswa</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs">
                  <span className="text-muted-foreground">
                    {program.skemaTagihan === "paket"
                      ? `Paket ${program.jumlahPertemuanPaket ?? 10} pertemuan`
                      : "SPP bulanan"}
                  </span>
                  <span className="font-semibold">{formatRupiah(program.tarif)}</span>
                </div>
              </Link>
            ))}
            {programs.length === 0 ? (
              <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                Belum ada program.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProgramForm({ programs }: { programs: { id: string; nama: string }[] }) {
  return (
    <ActionForm action={saveProgramAction} submitLabel="Simpan Program" resetOnSuccess={false}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kode" htmlFor="kode" required>
          <Input id="kode" name="kode" required placeholder="CONTOH-KODE" />
        </Field>
        <Field label="Level" htmlFor="level">
          <Input id="level" name="level" placeholder="Beginner / Mahir" />
        </Field>
        <Field label="Nama Program" htmlFor="nama" required className="sm:col-span-2">
          <Input id="nama" name="nama" required minLength={3} />
        </Field>
        <Field label="Program Induk" htmlFor="parentId">
          <Select id="parentId" name="parentId" defaultValue="">
            <option value="">Tidak ada</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.nama}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Skema Tagihan" htmlFor="skemaTagihan" required>
          <Select id="skemaTagihan" name="skemaTagihan" required defaultValue="spp_bulanan">
            <option value="spp_bulanan">SPP Bulanan</option>
            <option value="paket">Paket Pertemuan</option>
          </Select>
        </Field>
        <Field label="Biaya Pendaftaran (Rp)" htmlFor="biayaPendaftaran" required>
          <Input id="biayaPendaftaran" name="biayaPendaftaran" inputMode="numeric" defaultValue={100000} required />
        </Field>
        <Field label="Tarif SPP / Paket (Rp)" htmlFor="tarif" required>
          <Input id="tarif" name="tarif" inputMode="numeric" defaultValue={300000} required />
        </Field>
        <Field label="Jumlah Pertemuan Paket" htmlFor="jumlahPertemuanPaket" hint="Wajib untuk skema paket.">
          <Input id="jumlahPertemuanPaket" name="jumlahPertemuanPaket" type="number" min={1} placeholder="10" />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" value="true" defaultChecked className="h-4 w-4 rounded border-slate-300" />
          Program aktif
        </label>
      </div>
    </ActionForm>
  );
}
