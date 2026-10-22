import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Banknote, CalendarDays, Mail, Phone, UserCog } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { formatDate, formatTime, monthLabel } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ActionForm } from "@/components/forms/action-form";
import { updateTutorAction } from "@/features/master/actions";

export const metadata = { title: "Detail Tutor" };
export const dynamic = "force-dynamic";

export default async function TutorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireRole("admin", "owner");
  const { id } = await params;

  const tutor = await prisma.tutor.findUnique({
    where: { id },
    include: {
      user: true,
      feeSchemes: { orderBy: { berlakuMulai: "desc" } },
      classes: {
        include: { program: true, room: true, _count: { select: { enrollments: { where: { status: "aktif" } } } } },
        orderBy: { kodeKelas: "asc" },
      },
      sessions: {
        include: { class: { include: { program: true } }, room: true },
        orderBy: [{ tanggal: "desc" }, { jamMulai: "desc" }],
        take: 12,
      },
      _count: { select: { sessions: true } },
    },
  });

  if (!tutor) notFound();

  const completed = await prisma.session.count({
    where: { OR: [{ tutorId: id }, { penggantiTutorId: id }], status: "selesai" },
  });

  return (
    <div className="space-y-6">
      <PageHeader title={tutor.nama} description={`${tutor.tutorCode} · ${tutor.keahlian}`}>
        <Link
          href={`/admin/tutor`}
          className="inline-flex h-10 items-center rounded-lg border bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Kembali
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <Info label="Kelas diampu" value={`${tutor.classes.length} kelas`} />
        <Info label="Total sesi" value={`${tutor._count.sessions} sesi`} />
        <Info label="Sesi selesai" value={`${completed} sesi`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-4 w-4 text-primary" /> Profil & Akun
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm action={updateTutorAction} submitLabel="Simpan Perubahan">
                <input type="hidden" name="id" value={tutor.id} />
                <Field label="Nama Lengkap" htmlFor="nama" required>
                  <Input id="nama" name="nama" defaultValue={tutor.nama} required />
                </Field>
                <Field label="Email" htmlFor="email" required>
                  <Input id="email" name="email" type="email" defaultValue={tutor.email ?? ""} required />
                </Field>
                <Field label="Nomor WhatsApp" htmlFor="noWa" required>
                  <Input id="noWa" name="noWa" defaultValue={tutor.noWa} required />
                </Field>
                <Field label="Keahlian" htmlFor="keahlian" required>
                  <Input id="keahlian" name="keahlian" defaultValue={tutor.keahlian} required />
                </Field>
                <Field label="Status" htmlFor="status" required>
                  <Select id="status" name="status" defaultValue={tutor.status}>
                    <option value="aktif">Aktif</option>
                    <option value="cuti">Cuti</option>
                    <option value="nonaktif">Nonaktif</option>
                  </Select>
                </Field>
                <Field label="Password Baru" htmlFor="password" hint="Kosongkan bila tidak diubah.">
                  <Input id="password" name="password" type="password" minLength={8} />
                </Field>
              </ActionForm>
              <div className="mt-4 space-y-2 border-t pt-4 text-sm">
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" /> {tutor.email ?? "-"}
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" /> {tutor.noWa}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status akun</span>
                  <StatusBadge status={tutor.status} />
                </div>
              </div>
            </CardContent>
          </Card>

          {actor.role === "owner" ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-primary" /> Tarif Honor
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {tutor.feeSchemes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada tarif.</p>
                ) : (
                  tutor.feeSchemes.map((scheme) => (
                    <div key={scheme.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                      <span className="text-muted-foreground">
                        {monthLabel(scheme.berlakuMulai)} · {scheme.skema === "bulanan_tetap" ? "Bulanan" : "Per sesi"}
                      </span>
                      <span className="font-semibold">{formatRupiah(scheme.tarif)}</span>
                    </div>
                  ))
                )}
                <Link href="/owner/tarif-honor" className="mt-2 inline-block text-xs font-semibold text-primary hover:underline">
                  Atur tarif honor
                </Link>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" /> Kelas yang Diampu
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {tutor.classes.length === 0 ? (
                <EmptyState title="Belum ada kelas" className="m-5" />
              ) : (
                <div className="divide-y">
                  {tutor.classes.map((kelas) => (
                    <div key={kelas.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/admin/kelas/${kelas.id}`} className="font-medium hover:text-primary">
                          {kelas.kodeKelas} · {kelas.program.nama}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {kelas.room.nama} · {formatDate(kelas.tanggalMulai)}–{formatDate(kelas.tanggalSelesai)} ·{" "}
                          {kelas._count.enrollments}/{kelas.kuota} siswa
                        </p>
                      </div>
                      <StatusBadge status={kelas.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" /> Sesi Terbaru
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {tutor.sessions.length === 0 ? (
                <EmptyState title="Belum ada sesi" className="m-5" />
              ) : (
                <div className="divide-y">
                  {tutor.sessions.map((session) => (
                    <div key={session.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {session.class.kodeKelas} · {session.class.program.nama}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(session.tanggal)} · {formatTime(session.jamMulai)}–{session.jamSelesai} ·{" "}
                          {session.room.nama}
                        </p>
                      </div>
                      <StatusBadge status={session.status} />
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}
