import { CalendarClock, ListChecks, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { formatDate } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ActionForm } from "@/components/forms/action-form";
import { InlineAction } from "@/components/forms/inline-action";
import {
  generateRecurringAction,
  saveRecurringAction,
  toggleRecurringAction,
} from "@/features/pengeluaran/actions";

export const metadata = { title: "Pengeluaran Rutin" };
export const dynamic = "force-dynamic";

export default async function PengeluaranRutinPage() {
  await requireRole("keuangan", "owner");
  const [recurring, categories] = await Promise.all([
    prisma.recurringExpense.findMany({
      include: { category: true, _count: { select: { expenses: true } } },
      orderBy: [{ isActive: "desc" }, { tanggalBayar: "asc" }],
    }),
    prisma.expenseCategory.findMany({ orderBy: { nama: "asc" } }),
  ]);

  const active = recurring.filter((item) => item.isActive);
  const monthlyTotal = active.reduce((sum, item) => sum + item.nominal, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengeluaran Rutin"
        description="Template pengeluaran bulanan. Draft dibuat otomatis 3 hari sebelum tanggal bayar."
      >
        <ActionForm action={generateRecurringAction} submitLabel="Buat Draft Sekarang" variant="outline">
          <input type="hidden" name="manual" value="1" />
        </ActionForm>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <Summary label="Template aktif" value={String(active.length)} hint={`${recurring.length} total template`} />
        <Summary label="Estimasi per bulan" value={formatRupiah(monthlyTotal)} hint="Dari template aktif" />
        <Summary
          label="Draft terakhir dibuat"
          value={recurring.find((item) => item.lastDraftAt)?.lastDraftAt ? formatDate(recurring.find((item) => item.lastDraftAt)!.lastDraftAt!) : "-"}
          hint="Draft masuk ke daftar pengeluaran berstatus diajukan"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" /> Daftar Template
            </CardTitle>
            <Badge variant="outline">{recurring.length} template</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {recurring.length === 0 ? (
              <EmptyState
                title="Belum ada pengeluaran rutin"
                description="Tambahkan template sewa, internet, atau gaji staf melalui formulir di samping."
                className="m-5"
              />
            ) : (
              <div className="divide-y">
                {recurring.map((item) => (
                  <div key={item.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{item.keterangan}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.category.nama} · tanggal bayar {item.tanggalBayar} · {item.penerima}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {item._count.expenses} draft terhubung
                          {item.lastDraftAt ? ` · terakhir ${formatDate(item.lastDraftAt)}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold tabular-nums">{formatRupiah(item.nominal)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {item.sumberDana === "kas_tunai" ? "Kas Tunai" : "Rekening Bank"}
                        </p>
                      </div>
                      <Badge variant={item.isActive ? "success" : "muted"}>
                        {item.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                      <InlineAction
                        action={toggleRecurringAction}
                        fields={{ id: item.id }}
                        label={item.isActive ? "Nonaktifkan" : "Aktifkan"}
                        variant="outline"
                      />
                    </div>

                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-semibold text-primary">Ubah template</summary>
                      <div className="mt-3 rounded-lg border bg-slate-50/50 p-3">
                        <ActionForm action={saveRecurringAction} submitLabel="Simpan Perubahan" variant="outline" size="sm">
                          <input type="hidden" name="id" value={item.id} />
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="Kategori" htmlFor={`category-${item.id}`} required>
                              <Select id={`category-${item.id}`} name="categoryId" defaultValue={item.categoryId} required>
                                {categories.map((category) => (
                                  <option key={category.id} value={category.id}>
                                    {category.nama}
                                  </option>
                                ))}
                              </Select>
                            </Field>
                            <Field label="Nominal" htmlFor={`nominal-${item.id}`} required>
                              <Input id={`nominal-${item.id}`} name="nominal" inputMode="numeric" defaultValue={item.nominal} required />
                            </Field>
                            <Field label="Penerima" htmlFor={`penerima-${item.id}`} required>
                              <Input id={`penerima-${item.id}`} name="penerima" defaultValue={item.penerima} required />
                            </Field>
                            <Field label="Tanggal Bayar" htmlFor={`tanggal-${item.id}`} required hint="1–28">
                              <Input id={`tanggal-${item.id}`} name="tanggalBayar" type="number" min={1} max={28} defaultValue={item.tanggalBayar} required />
                            </Field>
                            <Field label="Sumber Dana" htmlFor={`sumber-${item.id}`}>
                              <Select id={`sumber-${item.id}`} name="sumberDana" defaultValue={item.sumberDana}>
                                <option value="kas_tunai">Kas Tunai</option>
                                <option value="rekening_bank">Rekening Bank</option>
                              </Select>
                            </Field>
                            <Field label="Status" htmlFor={`aktif-${item.id}`}>
                              <label className="flex h-10 items-center gap-2 rounded-lg border bg-white px-3 text-sm">
                                <input
                                  id={`aktif-${item.id}`}
                                  type="checkbox"
                                  name="isActive"
                                  defaultChecked={item.isActive}
                                  className="h-4 w-4 rounded border-slate-300"
                                />
                                Template aktif
                              </label>
                            </Field>
                          </div>
                          <Field label="Keterangan" htmlFor={`keterangan-${item.id}`} required>
                            <Textarea id={`keterangan-${item.id}`} name="keterangan" rows={2} defaultValue={item.keterangan} required />
                          </Field>
                        </ActionForm>
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" /> Tambah Template
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={saveRecurringAction} submitLabel="Simpan Template" variant="outline" size="sm">
              <Field label="Kategori" htmlFor="newCategory" required>
                <Select id="newCategory" name="categoryId" required defaultValue="">
                  <option value="">Pilih kategori</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.nama}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nominal" htmlFor="newNominal" required>
                  <Input id="newNominal" name="nominal" inputMode="numeric" required placeholder="0" />
                </Field>
                <Field label="Tanggal Bayar" htmlFor="newTanggal" required hint="1–28">
                  <Input id="newTanggal" name="tanggalBayar" type="number" min={1} max={28} required defaultValue={1} />
                </Field>
              </div>
              <Field label="Penerima" htmlFor="newPenerima" required>
                <Input id="newPenerima" name="penerima" required placeholder="Nama penerima / vendor" />
              </Field>
              <Field label="Sumber Dana" htmlFor="newSumber">
                <Select id="newSumber" name="sumberDana" defaultValue="rekening_bank">
                  <option value="kas_tunai">Kas Tunai</option>
                  <option value="rekening_bank">Rekening Bank</option>
                </Select>
              </Field>
              <Field label="Keterangan" htmlFor="newKeterangan" required>
                <Textarea id="newKeterangan" name="keterangan" rows={2} required placeholder="Contoh: sewa ruang bulanan" />
              </Field>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4 rounded border-slate-300" />
                Aktifkan template
              </label>
            </ActionForm>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-start gap-2 rounded-xl border bg-white p-4 text-xs text-muted-foreground">
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          Job harian membuat draft pada H-3 tanggal bayar. Draft tidak dibuat ulang pada bulan yang sama, dan pengingat
          dikirim ke email pengguna Keuangan/Owner aktif.
        </p>
      </div>
    </div>
  );
}

function Summary({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
