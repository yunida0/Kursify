import Link from "next/link";
import { ArrowLeft, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { dateInputValue, todayDateOnly } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import { getSettings } from "@/lib/services/settings";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ActionForm } from "@/components/forms/action-form";
import { createExpenseAction } from "@/features/pengeluaran/actions";

export const metadata = { title: "Catat Pengeluaran" };
export const dynamic = "force-dynamic";

export default async function PengeluaranBaruPage() {
  await requireRole("keuangan", "owner");
  const [categories, settings] = await Promise.all([
    prisma.expenseCategory.findMany({ orderBy: { nama: "asc" } }),
    getSettings(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Catat Pengeluaran" description="Masukkan pengeluaran operasional dengan bukti pendukung.">
        <Link
          href="/keuangan/pengeluaran"
          className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" /> Formulir Pengeluaran
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm
              action={createExpenseAction}
              submitLabel="Simpan Pengeluaran"
              pendingLabel="Menyimpan..."
              cancelHref="/keuangan/pengeluaran"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tanggal" htmlFor="tanggal" required>
                  <Input
                    id="tanggal"
                    name="tanggal"
                    type="date"
                    required
                    defaultValue={dateInputValue(todayDateOnly())}
                  />
                </Field>
                <Field label="Kategori" htmlFor="categoryId" required>
                  <Select id="categoryId" name="categoryId" required defaultValue="">
                    <option value="">Pilih kategori</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.nama}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Nominal" htmlFor="nominal" required hint="Angka saja, contoh 150000.">
                  <Input id="nominal" name="nominal" inputMode="numeric" required min={1} placeholder="0" />
                </Field>
                <Field label="Penerima" htmlFor="penerima" required>
                  <Input id="penerima" name="penerima" required placeholder="Nama penerima / vendor" />
                </Field>
                <Field label="Sumber Dana" htmlFor="sumberDana" required>
                  <Select id="sumberDana" name="sumberDana" required defaultValue="kas_tunai">
                    <option value="kas_tunai">Kas Tunai</option>
                    <option value="rekening_bank">Rekening Bank</option>
                  </Select>
                </Field>
                <Field label="Bukti / Nota" htmlFor="bukti" hint="Opsional. Foto atau PDF.">
                  <Input id="bukti" name="bukti" type="file" accept="image/*,application/pdf" />
                </Field>
              </div>

              <Field label="Keterangan" htmlFor="keterangan" required>
                <Textarea
                  id="keterangan"
                  name="keterangan"
                  rows={3}
                  required
                  placeholder="Contoh: pembelian kertas dan tinta printer untuk administrasi"
                />
              </Field>

              <label className="flex items-start gap-2 rounded-lg border bg-slate-50 p-3 text-sm">
                <input type="checkbox" name="langsungBayar" value="on" className="mt-1 h-4 w-4 rounded border-slate-300" />
                <span>
                  <span className="font-medium text-slate-800">Langsung tandai dibayar</span>
                  <span className="block text-xs text-muted-foreground">
                    Hanya untuk nominal sampai {formatRupiah(settings.batasPersetujuan)}. Di atas batas, simpan sebagai
                    pengajuan agar disetujui Owner terlebih dahulu.
                  </span>
                </span>
              </label>
            </ActionForm>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alur Persetujuan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="font-semibold text-emerald-800">≤ {formatRupiah(settings.batasPersetujuan)}</p>
                <p className="text-xs text-emerald-700">Staf Keuangan dapat langsung menandai dibayar.</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="font-semibold text-amber-800">&gt; {formatRupiah(settings.batasPersetujuan)}</p>
                <p className="text-xs text-amber-700">Wajib diajukan dan disetujui Owner sebelum dibayar.</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Setiap pengeluaran yang dibayar otomatis tercatat sebagai kas keluar. Pembatalan pengeluaran yang sudah
                dibayar akan membuat entri pembalik.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kategori Tersedia</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {categories.map((category) => (
                <span key={category.id} className="rounded-full border bg-white px-2 py-1 text-xs text-slate-600">
                  {category.nama}
                </span>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
