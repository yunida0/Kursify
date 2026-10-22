import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, ListChecks, Plus, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { formatRupiah } from "@/lib/money";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ActionForm } from "@/components/forms/action-form";
import { InlineAction } from "@/components/forms/inline-action";
import { deleteMaterialAction, saveMaterialAction, saveProgramAction } from "@/features/master/actions";

export const metadata = { title: "Detail Program" };
export const dynamic = "force-dynamic";

export default async function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin", "owner");
  const { id } = await params;

  const [program, parents] = await Promise.all([
    prisma.program.findUnique({
      where: { id },
      include: {
        parent: true,
        materials: { orderBy: { urutan: "asc" } },
        classes: {
          include: { tutor: true, room: true, _count: { select: { enrollments: { where: { status: "aktif" } } } } },
          orderBy: { kodeKelas: "asc" },
        },
        _count: { select: { students: true } },
      },
    }),
    prisma.program.findMany({ where: { id: { not: id } }, orderBy: { nama: "asc" } }),
  ]);

  if (!program) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={program.nama} description={`${program.kode} · ${program.skemaTagihan === "paket" ? "Paket pertemuan" : "SPP bulanan"}`}>
        <Link
          href="/admin/program"
          className="inline-flex h-10 items-center rounded-lg border bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Kembali
        </Link>
        <Link
          href="/admin/kelas/baru"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Buat Kelas
        </Link>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Pengaturan Program</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm action={saveProgramAction} submitLabel="Simpan Perubahan">
                <input type="hidden" name="id" value={program.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Kode" htmlFor="kode" required>
                    <Input id="kode" name="kode" defaultValue={program.kode} required />
                  </Field>
                  <Field label="Level" htmlFor="level">
                    <Input id="level" name="level" defaultValue={program.level ?? ""} />
                  </Field>
                  <Field label="Nama Program" htmlFor="nama" required className="sm:col-span-2">
                    <Input id="nama" name="nama" defaultValue={program.nama} required />
                  </Field>
                  <Field label="Program Induk" htmlFor="parentId" className="sm:col-span-2">
                    <Select id="parentId" name="parentId" defaultValue={program.parentId ?? ""}>
                      <option value="">Tidak ada</option>
                      {parents.map((parent) => (
                        <option key={parent.id} value={parent.id}>
                          {parent.nama}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Skema Tagihan" htmlFor="skemaTagihan">
                    <Select id="skemaTagihan" name="skemaTagihan" defaultValue={program.skemaTagihan}>
                      <option value="spp_bulanan">SPP Bulanan</option>
                      <option value="paket">Paket Pertemuan</option>
                    </Select>
                  </Field>
                  <Field label="Jumlah Pertemuan Paket" htmlFor="jumlahPertemuanPaket">
                    <Input
                      id="jumlahPertemuanPaket"
                      name="jumlahPertemuanPaket"
                      type="number"
                      min={1}
                      defaultValue={program.jumlahPertemuanPaket ?? ""}
                    />
                  </Field>
                  <Field label="Biaya Pendaftaran (Rp)" htmlFor="biayaPendaftaran">
                    <Input id="biayaPendaftaran" name="biayaPendaftaran" inputMode="numeric" defaultValue={program.biayaPendaftaran} />
                  </Field>
                  <Field label="Tarif (Rp)" htmlFor="tarif">
                    <Input id="tarif" name="tarif" inputMode="numeric" defaultValue={program.tarif} />
                  </Field>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input
                      type="checkbox"
                      name="isActive"
                      value="true"
                      defaultChecked={program.isActive}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Program aktif dan dapat dipilih siswa
                  </label>
                </div>
              </ActionForm>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-3">
            <MiniStat label="Siswa" value={program._count.students} />
            <MiniStat label="Kelas" value={program.classes.length} />
            <MiniStat label="Materi" value={program.materials.length} />
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" /> Materi Penilaian
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-slate-50/60 p-4">
                <ActionForm action={saveMaterialAction} submitLabel="Tambah Materi" variant="outline" size="sm" resetOnSuccess>
                  <input type="hidden" name="programId" value={program.id} />
                  <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                    <Field label="Nama Materi" htmlFor="nama">
                      <Input id="nama" name="nama" required minLength={2} />
                    </Field>
                    <Field label="Urutan" htmlFor="urutan">
                      <Input id="urutan" name="urutan" type="number" min={1} defaultValue={program.materials.length + 1} />
                    </Field>
                  </div>
                </ActionForm>
              </div>

              {program.materials.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada materi. Tambahkan minimal satu materi untuk penilaian.</p>
              ) : (
                <div className="space-y-2">
                  {program.materials.map((material) => (
                    <details key={material.id} className="rounded-lg border">
                      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-2.5 text-sm">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {material.urutan}
                        </span>
                        <span className="flex-1 font-medium">{material.nama}</span>
                        <Trash2 className="h-3.5 w-3.5 text-slate-400" />
                      </summary>
                      <div className="flex flex-wrap items-end gap-3 border-t bg-slate-50/50 p-4">
                        <ActionForm
                          action={saveMaterialAction}
                          submitLabel="Simpan"
                          variant="outline"
                          size="sm"
                          className="flex-1"
                        >
                          <input type="hidden" name="id" value={material.id} />
                          <input type="hidden" name="programId" value={program.id} />
                          <div className="grid gap-3 sm:grid-cols-[1fr_100px]">
                            <Field label="Nama Materi" htmlFor={`nama-${material.id}`}>
                              <Input id={`nama-${material.id}`} name="nama" defaultValue={material.nama} required />
                            </Field>
                            <Field label="Urutan" htmlFor={`urutan-${material.id}`}>
                              <Input id={`urutan-${material.id}`} name="urutan" type="number" min={1} defaultValue={material.urutan} />
                            </Field>
                          </div>
                        </ActionForm>
                        <InlineAction
                          action={deleteMaterialAction}
                          fields={{ id: material.id, programId: program.id }}
                          label="Hapus"
                          variant="destructive"
                          confirmText={`Hapus materi ${material.nama}? Materi dengan nilai tidak dapat dihapus.`}
                        />
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" /> Kelas Program Ini
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {program.classes.length === 0 ? (
                <p className="p-5 text-sm text-muted-foreground">Belum ada kelas.</p>
              ) : (
                <div className="divide-y">
                  {program.classes.map((kelas) => (
                    <div key={kelas.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/admin/kelas/${kelas.id}`} className="text-sm font-semibold hover:text-primary">
                          {kelas.kodeKelas}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {kelas.tutor.nama} · {kelas.room.nama} · {kelas._count.enrollments}/{kelas.kuota} siswa
                        </p>
                      </div>
                      <Badge variant="outline">{formatRupiah(program.tarif)}</Badge>
                      <StatusBadge status={kelas.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-white p-3 text-center">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
