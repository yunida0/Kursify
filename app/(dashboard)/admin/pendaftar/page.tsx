import Link from "next/link";
import { FileText, UserRoundPlus, UsersRound } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { formatDate } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Field } from "@/components/forms/field";
import { Select } from "@/components/ui/select";
import { ActionForm } from "@/components/forms/action-form";
import { activateStudentAction } from "@/features/siswa/actions";

export const metadata = { title: "Pendaftar" };
export const dynamic = "force-dynamic";

export default async function PendaftarPage() {
  await requireRole("admin", "owner");
  const [students, classes] = await Promise.all([
    prisma.student.findMany({
      where: { status: "pending" },
      include: {
        program: true,
        documents: true,
        invoices: { where: { jenis: "pendaftaran" }, orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { registeredAt: "asc" },
    }),
    prisma.courseClass.findMany({
      where: { status: { in: ["dibuka", "berjalan"] } },
      include: {
        program: true,
        tutor: true,
        _count: { select: { enrollments: { where: { status: "aktif" } } } },
      },
      orderBy: { kodeKelas: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pendaftar Baru"
        description="Verifikasi pendaftar, pastikan biaya pendaftaran lunas, lalu tempatkan ke kelas untuk mengaktifkan nomor induk dan QR."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Info label="Pendaftar menunggu" value={String(students.length)} />
        <Info label="Kelas tersedia" value={String(classes.filter((c) => c._count.enrollments < c.kuota).length)} />
        <Info
          label="Tagihan pendaftaran lunas"
          value={String(students.filter((s) => s.invoices[0]?.status === "lunas").length)}
        />
      </div>

      {students.length === 0 ? (
        <Card>
          <EmptyState
            title="Tidak ada pendaftar menunggu"
            description="Pendaftar baru dari halaman publik akan muncul di sini."
            className="py-12"
          />
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {students.map((student) => {
            const candidates = classes.filter(
              (kelas) =>
                kelas.programId === student.programId &&
                kelas._count.enrollments < kelas.kuota,
            );
            const invoice = student.invoices[0];
            const paid = invoice?.status === "lunas";
            return (
              <Card key={student.id}>
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle>{student.nama}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Daftar {formatDate(student.registeredAt)} · {student.noWa}
                    </p>
                  </div>
                  <StatusBadge status={student.status} />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2 rounded-xl border bg-slate-50/60 p-3 text-sm sm:grid-cols-2">
                    <InfoRow label="Program" value={student.program?.nama ?? "-"} />
                    <InfoRow label="Jenis kelamin" value={student.jenisKelamin ?? "-"} />
                    <InfoRow label="Tempat / tgl lahir" value={`${student.tempatLahir ?? "-"}, ${formatDate(student.tanggalLahir)}`} />
                    <InfoRow label="Email" value={student.email ?? "-"} />
                    <InfoRow label="Wali" value={student.namaWali ?? "-"} />
                    <InfoRow label="WA wali" value={student.noWaWali ?? "-"} />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">Biaya Pendaftaran</p>
                      <p className="text-xs text-muted-foreground">
                        {invoice ? `${invoice.invoiceNo} · ${formatRupiah(invoice.total)}` : "Belum terbit"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {invoice ? <StatusBadge status={invoice.status} /> : null}
                      {invoice ? (
                        <Link
                          href={`/keuangan/tagihan/${invoice.id}`}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          Lihat tagihan
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Dokumen
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {student.documents.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Tidak ada dokumen terunggah.</span>
                      ) : (
                        student.documents.map((document) => (
                          <a
                            key={document.id}
                            href={`/api/files/${document.filePath}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-md border bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                          >
                            <FileText className="h-3.5 w-3.5" /> {document.jenis.replaceAll("_", " ")}
                          </a>
                        ))
                      )}
                    </div>
                  </div>

                  {paid && candidates.length > 0 ? (
                    <ActionForm action={activateStudentAction} submitLabel="Aktivasi & Tempatkan" variant="success">
                      <input type="hidden" name="studentId" value={student.id} />
                      <Field label="Kelas Tujuan" htmlFor={`class-${student.id}`} required>
                        <Select id={`class-${student.id}`} name="classId" required defaultValue="">
                          <option value="">Pilih kelas ({candidates.length} tersedia)</option>
                          {candidates.map((kelas) => (
                            <option key={kelas.id} value={kelas.id}>
                              {kelas.kodeKelas} · {kelas.tutor.nama} · {kelas._count.enrollments}/{kelas.kuota} siswa
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </ActionForm>
                  ) : (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      {!paid
                        ? "Aktivasi menunggu pelunasan biaya pendaftaran. Arahkan ke menu Tagihan untuk mencatat pembayaran."
                        : "Belum ada kelas tersedia untuk program ini. Buat kelas baru atau tambah kuota terlebih dahulu."}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    <Link
                      href={`/admin/siswa/${student.id}`}
                      className="inline-flex h-8 items-center gap-1 rounded-md border bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <UsersRound className="h-3.5 w-3.5" /> Detail siswa
                    </Link>
                    <Link
                      href={`/admin/kelas`}
                      className="inline-flex h-8 items-center gap-1 rounded-md border bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <UserRoundPlus className="h-3.5 w-3.5" /> Data kelas
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium">{value}</p>
    </div>
  );
}
