import { Building2, FolderPlus, Percent, Settings2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { getSettings } from "@/lib/services/settings";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { ActionForm } from "@/components/forms/action-form";
import { saveExpenseCategoryAction, updateSettingsAction } from "@/features/pengaturan/actions";

export const metadata = { title: "Pengaturan" };
export const dynamic = "force-dynamic";

export default async function PengaturanPage() {
  await requireRole("owner");
  const [settings, categories] = await Promise.all([
    getSettings(),
    prisma.expenseCategory.findMany({
      include: { parent: true, _count: { select: { expenses: true } } },
      orderBy: { nama: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengaturan Lembaga"
        description="Identitas lembaga, aturan tagihan, denda, kelulusan, dan kategori pengeluaran."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Identitas & Aturan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={updateSettingsAction} submitLabel="Simpan Pengaturan">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nama Lembaga" htmlFor="namaLembaga" required className="sm:col-span-2">
                  <Input id="namaLembaga" name="namaLembaga" defaultValue={settings.namaLembaga} required />
                </Field>
                <Field label="Alamat" htmlFor="alamat" className="sm:col-span-2">
                  <Textarea id="alamat" name="alamat" rows={2} defaultValue={settings.alamat ?? ""} />
                </Field>
                <Field label="Telepon" htmlFor="telepon">
                  <Input id="telepon" name="telepon" defaultValue={settings.telepon ?? ""} />
                </Field>
                <Field label="Email" htmlFor="email">
                  <Input id="email" name="email" type="email" defaultValue={settings.email ?? ""} />
                </Field>
                <Field label="Nama Direktur / Penanggung Jawab" htmlFor="namaDirektur">
                  <Input id="namaDirektur" name="namaDirektur" defaultValue={settings.namaDirektur} />
                </Field>
                <Field label="Kode Siswa" htmlFor="kodeSiswa" hint="Dipakai pada nomor induk, contoh KSF.">
                  <Input id="kodeSiswa" name="kodeSiswa" defaultValue={settings.kodeSiswa} />
                </Field>
                <Field label="Kode Sertifikat" htmlFor="kodeSertifikat">
                  <Input id="kodeSertifikat" name="kodeSertifikat" defaultValue={settings.kodeSertifikat} />
                </Field>
                <Field label="Minimal Kehadiran (%)" htmlFor="minKehadiran">
                  <Input id="minKehadiran" name="minKehadiran" type="number" min={0} max={100} defaultValue={settings.minKehadiran} />
                </Field>
                <Field label="Nilai Minimal Lulus" htmlFor="minLulus">
                  <Input id="minLulus" name="minLulus" type="number" min={0} max={100} defaultValue={settings.minLulus} />
                </Field>
                <Field label="Denda Keterlambatan (Rp)" htmlFor="dendaKeterlambatan">
                  <Input
                    id="dendaKeterlambatan"
                    name="dendaKeterlambatan"
                    inputMode="numeric"
                    defaultValue={settings.dendaKeterlambatan}
                  />
                </Field>
                <Field label="Batas Tangguh Penangguhan (hari)" htmlFor="batasTangguhHari">
                  <Input id="batasTangguhHari" name="batasTangguhHari" type="number" min={0} defaultValue={settings.batasTangguhHari} />
                </Field>
                <Field label="Batas Persetujuan Pengeluaran (Rp)" htmlFor="batasPersetujuan">
                  <Input
                    id="batasPersetujuan"
                    name="batasPersetujuan"
                    inputMode="numeric"
                    defaultValue={settings.batasPersetujuan}
                  />
                </Field>
                <Field label="Tanggal Tagihan" htmlFor="tanggalTagihan">
                  <Input id="tanggalTagihan" name="tanggalTagihan" type="number" min={1} max={28} defaultValue={settings.tanggalTagihan} />
                </Field>
                <Field label="Tanggal Jatuh Tempo" htmlFor="tanggalJatuhTempo">
                  <Input
                    id="tanggalJatuhTempo"
                    name="tanggalJatuhTempo"
                    type="number"
                    min={1}
                    max={28}
                    defaultValue={settings.tanggalJatuhTempo}
                  />
                </Field>
              </div>
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <Percent className="mr-1 inline h-3.5 w-3.5" />
                Perubahan aturan berlaku untuk proses berikutnya; transaksi lama tidak dihitung ulang.
              </div>
            </ActionForm>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderPlus className="h-4 w-4 text-primary" /> Kategori Pengeluaran Baru
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm action={saveExpenseCategoryAction} submitLabel="Tambah Kategori" resetOnSuccess>
                <Field label="Nama Kategori" htmlFor="nama" required>
                  <Input id="nama" name="nama" required minLength={2} />
                </Field>
                <Field label="Induk Kategori" htmlFor="parentId">
                  <Select id="parentId" name="parentId" defaultValue="">
                    <option value="">Kategori utama</option>
                    {categories
                      .filter((category) => !category.parentId)
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.nama}
                        </option>
                      ))}
                  </Select>
                </Field>
              </ActionForm>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-primary" /> Kategori Tersedia
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {categories.map((category) => (
                <div key={category.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{category.nama}</p>
                    <p className="text-xs text-muted-foreground">
                      {category.parent ? `Sub dari ${category.parent.nama}` : "Kategori utama"} ·{" "}
                      {category._count.expenses} transaksi
                    </p>
                  </div>
                </div>
              ))}
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada kategori.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
