import Link from "next/link";
import { ArrowLeft, ReceiptText } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { addDays, dateInputValue, todayDateOnly } from "@/lib/dates";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ActionForm } from "@/components/forms/action-form";
import { createManualInvoiceAction } from "@/features/tagihan/actions";

export const metadata = { title: "Buat Tagihan" };
export const dynamic = "force-dynamic";

export default async function TagihanBaruPage() {
  await requireRole("keuangan", "owner");
  const students = await prisma.student.findMany({
    where: { status: { not: "nonaktif" } },
    include: { program: true },
    orderBy: { nama: "asc" },
  });
  const defaultDue = dateInputValue(addDays(todayDateOnly(), 7));

  return (
    <div className="space-y-6">
      <PageHeader title="Buat Tagihan" description="Terbitkan tagihan manual untuk siswa.">
        <Link
          href="/keuangan/tagihan"
          className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-primary" /> Formulir Tagihan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm
              action={createManualInvoiceAction}
              submitLabel="Terbitkan Tagihan"
              pendingLabel="Menerbitkan..."
              cancelHref="/keuangan/tagihan"
            >
              <Field label="Siswa" htmlFor="studentId" required>
                <Select id="studentId" name="studentId" required defaultValue="">
                  <option value="">Pilih siswa</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.studentCode ? `${student.studentCode} · ` : ""}
                      {student.nama}
                      {student.program ? ` — ${student.program.nama}` : ""}
                    </option>
                  ))}
                </Select>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Jenis Tagihan" htmlFor="jenis" required>
                  <Select id="jenis" name="jenis" required defaultValue="lain">
                    <option value="lain">Lain-lain</option>
                    <option value="spp">SPP bulanan</option>
                    <option value="paket">Paket pertemuan</option>
                    <option value="pendaftaran">Pendaftaran</option>
                  </Select>
                </Field>
                <Field label="Nominal" htmlFor="nominal" required hint="Angka saja, contoh 350000.">
                  <Input id="nominal" name="nominal" inputMode="numeric" required min={1} placeholder="0" />
                </Field>
                <Field label="Periode" htmlFor="periode" hint="Opsional, khusus SPP. Contoh 2026-10.">
                  <Input id="periode" name="periode" type="month" />
                </Field>
                <Field label="Jatuh Tempo" htmlFor="jatuhTempo" required>
                  <Input id="jatuhTempo" name="jatuhTempo" type="date" required defaultValue={defaultDue} />
                </Field>
              </div>

              <Field label="Catatan" htmlFor="catatan" hint="Akan tampil pada detail tagihan dan dokumen terkait.">
                <Textarea id="catatan" name="catatan" rows={3} placeholder="Contoh: biaya buku modul semester ganjil" />
              </Field>

              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
                Tagihan yang diterbitkan akan mengirim notifikasi ke WhatsApp siswa/wali sesuai driver notifikasi
                yang aktif.
              </p>
            </ActionForm>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Panduan Singkat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <p>
                <span className="font-semibold text-slate-900">SPP bulanan</span> dapat dibuat massal dari halaman
                Tagihan agar tidak duplikat per periode.
              </p>
              <p>
                <span className="font-semibold text-slate-900">Paket pertemuan</span> biasanya terbit otomatis saat
                siswa ditempatkan ke kelas atau saat saldo paket habis.
              </p>
              <p>
                <span className="font-semibold text-slate-900">Potongan/beasiswa</span> hanya dapat diberikan Owner
                melalui detail tagihan.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Status Siswa</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              <p>{students.length} siswa dapat dipilih.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Siswa nonaktif tidak ditampilkan. Siswa pending tetap dapat ditagih biaya pendaftaran.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
