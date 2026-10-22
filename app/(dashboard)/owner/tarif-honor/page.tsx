import { Banknote, CalendarClock, UsersRound } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { formatRupiah } from "@/lib/money";
import { monthKey, monthLabel } from "@/lib/dates";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ActionForm } from "@/components/forms/action-form";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { setTutorFeeAction } from "@/features/master/actions";

export const metadata = { title: "Tarif Honor" };
export const dynamic = "force-dynamic";

export default async function TarifHonorPage() {
  await requireRole("owner");
  const periode = monthKey();
  const tutors = await prisma.tutor.findMany({
    include: {
      feeSchemes: { orderBy: { berlakuMulai: "desc" } },
      _count: { select: { sessions: { where: { status: "selesai" } } } },
    },
    orderBy: { nama: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Skema & Tarif Honor Tutor"
        description={`Tetapkan tarif per periode. Tarif aktif untuk ${monthLabel(periode)} dipakai saat rekap honor dibuat.`}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Info label="Tutor terdaftar" value={`${tutors.length} tutor`} icon={<UsersRound className="h-4 w-4" />} />
        <Info
          label="Tarif per pertemuan"
          value={`${tutors.filter((t) => t.feeSchemes[0]?.skema === "per_pertemuan").length} tutor`}
          icon={<Banknote className="h-4 w-4" />}
        />
        <Info label="Periode aktif" value={monthLabel(periode)} icon={<CalendarClock className="h-4 w-4" />} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {tutors.map((tutor) => {
          const active = tutor.feeSchemes.find((scheme) => scheme.berlakuMulai <= periode) ?? tutor.feeSchemes[0];
          return (
            <Card key={tutor.id}>
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle>{tutor.nama}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tutor.tutorCode} · {tutor.keahlian} · {tutor._count.sessions} sesi selesai
                  </p>
                </div>
                <StatusBadge status={tutor.status} />
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-xl border bg-slate-50/70 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Tarif aktif {monthLabel(periode)}
                  </p>
                  {active ? (
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-bold">{formatRupiah(active.tarif)}</p>
                        <p className="text-xs text-muted-foreground">
                          {active.skema === "bulanan_tetap" ? "Bulanan tetap" : "Per pertemuan"} · mulai {active.berlakuMulai}
                        </p>
                      </div>
                      <Badge variant={active.skema === "bulanan_tetap" ? "info" : "success"}>
                        {active.skema === "bulanan_tetap" ? "Bulanan" : "Per Sesi"}
                      </Badge>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-amber-700">Belum ada tarif. Honor tidak dapat direkap.</p>
                  )}
                </div>

                <ActionForm
                  action={setTutorFeeAction}
                  submitLabel="Simpan Tarif"
                  variant="outline"
                  size="sm"
                  footerClassName="pt-0"
                >
                  <input type="hidden" name="tutorId" value={tutor.id} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Skema" htmlFor={`skema-${tutor.id}`}>
                      <Select id={`skema-${tutor.id}`} name="skema" defaultValue={active?.skema ?? "per_pertemuan"}>
                        <option value="per_pertemuan">Per pertemuan</option>
                        <option value="bulanan_tetap">Bulanan tetap</option>
                      </Select>
                    </Field>
                    <Field label="Tarif (Rp)" htmlFor={`tarif-${tutor.id}`}>
                      <Input
                        id={`tarif-${tutor.id}`}
                        name="tarif"
                        inputMode="numeric"
                        required
                        min={1}
                        defaultValue={active?.tarif ?? 50000}
                      />
                    </Field>
                    <Field label="Berlaku Mulai" htmlFor={`mulai-${tutor.id}`}>
                      <Input
                        id={`mulai-${tutor.id}`}
                        name="berlakuMulai"
                        type="month"
                        required
                        defaultValue={periode}
                      />
                    </Field>
                  </div>
                </ActionForm>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Riwayat Tarif
                  </p>
                  {tutor.feeSchemes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada riwayat.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {tutor.feeSchemes.map((scheme) => (
                        <div
                          key={scheme.id}
                          className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                        >
                          <span className="text-muted-foreground">
                            {monthLabel(scheme.berlakuMulai)} ·{" "}
                            {scheme.skema === "bulanan_tetap" ? "Bulanan" : "Per sesi"}
                          </span>
                          <span className="font-medium tabular-nums">{formatRupiah(scheme.tarif)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {tutors.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Belum ada tutor. Tambahkan tutor melalui menu Tutor terlebih dahulu.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function Info({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-white p-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
