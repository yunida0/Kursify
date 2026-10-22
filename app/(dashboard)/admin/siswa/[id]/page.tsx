import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  CreditCard,
  FileText,
  GraduationCap,

  Phone,
  Printer,
  UserRound,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { formatDate, formatDateTime, formatTime } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import { hitungUmur, initials } from "@/lib/utils";
import { studentAttendanceSummary } from "@/lib/services/students";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Field } from "@/components/forms/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ActionForm } from "@/components/forms/action-form";
import { InlineAction } from "@/components/forms/inline-action";
import { StudentForm } from "@/features/siswa/student-form";
import {
  activateStudentAction,
  enrollStudentAction,
  removeEnrollmentAction,
  updateStudentStatusAction,
} from "@/features/siswa/actions";

export const metadata = { title: "Detail Siswa" };
export const dynamic = "force-dynamic";

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin", "owner");
  const { id } = await params;

  const [student, programs, availableClasses, attendance] = await Promise.all([
    prisma.student.findUnique({
      where: { id },
      include: {
        program: true,
        documents: { orderBy: { createdAt: "desc" } },
        enrollments: {
          include: { class: { include: { program: true, tutor: true } }, certificate: true },
          orderBy: { createdAt: "desc" },
        },
        invoices: {
          include: { payments: { include: { receipt: true }, orderBy: { tanggal: "asc" } } },
          orderBy: { createdAt: "desc" },
        },
        attendances: {
          include: { session: { include: { class: true } } },
          orderBy: { session: { tanggal: "desc" } },
          take: 20,
        },
      },
    }),
    prisma.program.findMany({ where: { isActive: true }, orderBy: { nama: "asc" } }),
    prisma.courseClass.findMany({
      where: { status: { in: ["dibuka", "berjalan"] } },
      include: {
        program: true,
        tutor: true,
        _count: { select: { enrollments: { where: { status: "aktif" } } } },
      },
      orderBy: { kodeKelas: "asc" },
    }),
    studentAttendanceSummary(id),
  ]);

  if (!student) notFound();

  const umur = hitungUmur(student.tanggalLahir);
  const totalTagihan = student.invoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const totalDibayar = student.invoices.reduce(
    (sum, invoice) =>
      sum + invoice.payments.filter((payment) => payment.status === "valid").reduce((s, p) => s + p.nominal, 0),
    0,
  );
  const tunggakan = student.invoices.reduce(
    (sum, invoice) =>
      sum +
      Math.max(
        0,
        invoice.total -
          invoice.payments.filter((payment) => payment.status === "valid").reduce((s, p) => s + p.nominal, 0),
      ),
    0,
  );
  const enrolmentClassIds = new Set(
    student.enrollments.filter((enrollment) => enrollment.status === "aktif").map((enrollment) => enrollment.classId),
  );
  const eligibleClasses = availableClasses.filter(
    (kelas) =>
      kelas.programId === student.programId &&
      !enrolmentClassIds.has(kelas.id) &&
      kelas._count.enrollments < kelas.kuota,
  );
  const registrationInvoice = student.invoices.find((invoice) => invoice.jenis === "pendaftaran");

  return (
    <div className="space-y-6">
      <PageHeader title={student.nama} description={`${student.studentCode ?? "Belum diaktivasi"} · ${student.program?.nama ?? "Program belum dipilih"}`}>
        {student.studentCode && student.qrToken ? (
          <a
            href={`/api/pdf/kartu/${student.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
          >
            <Printer className="h-4 w-4" /> Cetak Kartu Siswa
          </a>
        ) : null}
        <Link
          href="/admin/siswa"
          className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Kembali
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="Status Siswa" value={student.status.replaceAll("_", " ")} badge={<StatusBadge status={student.status} />} />
        <Summary label="Total Tagihan" value={formatRupiah(totalTagihan)} hint={`Dibayar ${formatRupiah(totalDibayar)}`} />
        <Summary label="Tunggakan" value={formatRupiah(tunggakan)} danger={tunggakan > 0} />
        <Summary
          label="Kehadiran"
          value={`${attendance.persen.toLocaleString("id-ID")}%`}
          hint={`${attendance["hadir"] ?? 0} hadir dari ${attendance.total} catatan`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="h-4 w-4 text-primary" /> Profil Siswa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-3 rounded-xl border bg-slate-50 p-3">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                  {initials(student.nama)}
                </span>
                <div>
                  <p className="font-semibold">{student.nama}</p>
                  <p className="text-xs text-muted-foreground">{student.studentCode ?? "Nomor induk belum terbit"}</p>
                  <Badge variant="outline" className="mt-1">
                    {student.program?.nama ?? "Program belum dipilih"}
                  </Badge>
                </div>
              </div>
              <Row label="NIK / Identitas" value={student.noIdentitas ?? "-"} />
              <Row label="Jenis Kelamin" value={student.jenisKelamin === "L" ? "Laki-laki" : student.jenisKelamin === "P" ? "Perempuan" : "-"} />
              <Row label="Tempat / Tanggal Lahir" value={`${student.tempatLahir ?? "-"}${student.tanggalLahir ? `, ${formatDate(student.tanggalLahir)}` : ""}`} />
              <Row label="Umur" value={umur !== null ? `${umur} tahun` : "-"} />
              <Row label="Agama" value={student.agama ?? "-"} />
              <Row label="Asal Instansi" value={student.asalInstansi ?? "-"} />
              <Row label="Alamat" value={student.alamat ?? "-"} />
              <div className="flex items-center gap-2 border-t pt-3">
                <Phone className="h-4 w-4 text-primary" />
                <div>
                  <p className="font-medium">{student.noWa}</p>
                  <p className="text-xs text-muted-foreground">{student.email ?? "Tanpa email"}</p>
                </div>
              </div>
              <div className="rounded-lg border bg-white p-2 text-xs">
                <p className="mb-1 font-semibold text-slate-600">Wali / Orang Tua</p>
                <p>{student.namaWali ?? student.namaIbu ?? student.namaAyah ?? "-"}</p>
                <p className="text-muted-foreground">{student.noWaWali ?? "-"}</p>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Dokumen</p>
                <div className="flex flex-wrap gap-1.5">
                  {student.documents.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Tidak ada dokumen.</p>
                  ) : (
                    student.documents.map((document) => (
                      <a
                        key={document.id}
                        href={`/api/files/${document.filePath}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        <FileText className="h-3 w-3" /> {document.jenis.replaceAll("_", " ")}
                      </a>
                    ))
                  )}
                </div>
              </div>
              <details className="pt-1">
                <summary className="cursor-pointer text-xs font-semibold text-primary">Ubah Data Profil</summary>
                <div className="mt-3 border-t pt-4">
                  <StudentForm
                    programs={programs.map((program) => ({ id: program.id, nama: program.nama, level: program.level }))}
                    student={{
                      ...student,
                      tanggalLahir: student.tanggalLahir ? student.tanggalLahir.toISOString() : null,
                    }}
                    mode="edit"
                  />
                </div>
              </details>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-primary" /> Status & Aktivasi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!student.studentCode ? (
                <div className="rounded-lg border bg-amber-50/60 p-3 text-sm">
                  <p className="font-medium text-amber-900">Aktivasi siswa</p>
                  <p className="mt-1 text-xs text-amber-800">
                    {registrationInvoice?.status === "lunas"
                      ? "Biaya pendaftaran lunas. Pilih kelas untuk menerbitkan nomor induk dan QR."
                      : "Aktivasi membutuhkan pelunasan biaya pendaftaran."}
                  </p>
                  {registrationInvoice?.status === "lunas" && eligibleClasses.length > 0 ? (
                    <div className="mt-3">
                      <ActionForm action={activateStudentAction} submitLabel="Aktivasi" variant="success">
                        <input type="hidden" name="studentId" value={student.id} />
                        <Field label="Kelas Tujuan" htmlFor="activationClass" required>
                          <Select id="activationClass" name="classId" required defaultValue="">
                            <option value="">Pilih kelas</option>
                            {eligibleClasses.map((kelas) => (
                              <option key={kelas.id} value={kelas.id}>
                                {kelas.kodeKelas} · {kelas.tutor.nama} · {kelas._count.enrollments}/{kelas.kuota}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      </ActionForm>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <ActionForm action={updateStudentStatusAction} submitLabel="Ubah Status" variant="outline" size="sm">
                <input type="hidden" name="studentId" value={student.id} />
                <Field label="Status Baru" htmlFor="status" required>
                  <Select id="status" name="status" required defaultValue={student.status === "pending" ? "aktif" : student.status}>
                    <option value="aktif">Aktif</option>
                    <option value="ditangguhkan">Ditangguhkan</option>
                    <option value="nonaktif">Nonaktif</option>
                  </Select>
                </Field>
                <Field label="Alasan" htmlFor="reason" hint="Wajib untuk nonaktif dan tercatat di audit log.">
                  <Textarea id="reason" name="reason" rows={2} />
                </Field>
              </ActionForm>

              {student.status === "aktif" && eligibleClasses.length > 0 ? (
                <div className="border-t pt-4">
                  <ActionForm action={enrollStudentAction} submitLabel="Tempatkan ke Kelas" variant="outline" size="sm">
                    <input type="hidden" name="studentId" value={student.id} />
                    <Field label="Kelas Tambahan" htmlFor="newClass" required>
                      <Select id="newClass" name="classId" required defaultValue="">
                        <option value="">Pilih kelas</option>
                        {eligibleClasses.map((kelas) => (
                          <option key={kelas.id} value={kelas.id}>
                            {kelas.kodeKelas} · {kelas.program.nama}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </ActionForm>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" /> Kelas & Sertifikat
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {student.enrollments.length === 0 ? (
                <EmptyState title="Belum mengikuti kelas" className="m-5" />
              ) : (
                <div className="divide-y">
                  {student.enrollments.map((enrollment) => (
                    <div key={enrollment.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/admin/kelas/${enrollment.classId}`} className="text-sm font-semibold hover:text-primary">
                          {enrollment.class.kodeKelas} · {enrollment.class.program.nama}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {enrollment.class.tutor.nama} · masuk {formatDate(enrollment.tanggalMasuk)}
                          {enrollment.saldoPertemuan !== null ? ` · saldo ${enrollment.saldoPertemuan} pertemuan` : ""}
                        </p>
                      </div>
                      <StatusBadge status={enrollment.status} />
                      {enrollment.certificate ? (
                        <a
                          href={`/api/pdf/sertifikat/${enrollment.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          Sertifikat
                        </a>
                      ) : null}
                      {enrollment.status === "aktif" ? (
                        <InlineAction
                          action={removeEnrollmentAction}
                          fields={{ enrollmentId: enrollment.id, classId: enrollment.classId }}
                          label="Keluarkan"
                          confirmText={`Keluarkan ${student.nama} dari kelas ${enrollment.class.kodeKelas}?`}
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" /> Tagihan & Pembayaran
              </CardTitle>
              <Link href="/keuangan/tagihan" className="text-xs font-semibold text-primary hover:underline">
                Semua tagihan
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {student.invoices.length === 0 ? (
                <EmptyState title="Belum ada tagihan" className="m-5" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/60">
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-5 py-2.5 font-semibold">Tagihan</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Total</th>
                        <th className="px-3 py-2.5 font-semibold">Status</th>
                        <th className="px-3 py-2.5 font-semibold">Pembayaran</th>
                      </tr>
                    </thead>
                    <tbody>
                      {student.invoices.map((invoice) => (
                        <tr key={invoice.id} className="border-b align-top last:border-0">
                          <td className="px-5 py-3">
                            <Link href={`/keuangan/tagihan/${invoice.id}`} className="font-medium text-primary hover:underline">
                              {invoice.invoiceNo}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {invoice.jenis} {invoice.periode ? `· ${invoice.periode}` : ""} · tempo {formatDate(invoice.jatuhTempo)}
                            </p>
                          </td>
                          <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatRupiah(invoice.total)}</td>
                          <td className="px-3 py-3">
                            <StatusBadge status={invoice.status} />
                          </td>
                          <td className="px-3 py-3 text-xs">
                            {invoice.payments.length === 0 ? (
                              <span className="text-muted-foreground">Belum ada</span>
                            ) : (
                              invoice.payments.map((payment) => (
                                <div key={payment.id}>
                                  <span className={payment.status === "void" ? "text-muted-foreground line-through" : ""}>
                                    {formatRupiah(payment.nominal)} · {payment.metode}
                                  </span>
                                  {payment.receipt && payment.status === "valid" ? (
                                    <a
                                      href={`/api/pdf/kuitansi/${payment.id}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="ml-1 text-primary hover:underline"
                                    >
                                      kuitansi
                                    </a>
                                  ) : null}
                                </div>
                              ))
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" /> Absensi Terakhir
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {student.attendances.length === 0 ? (
                <EmptyState title="Belum ada absensi" className="m-5" />
              ) : (
                <div className="max-h-[360px] divide-y overflow-y-auto">
                  {student.attendances.map((record) => (
                    <div key={record.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{record.session.class.kodeKelas}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(record.session.tanggal)} · {formatTime(record.session.jamMulai)}–{record.session.jamSelesai}
                        </p>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{formatDateTime(record.recordedAt)}</span>
                      <StatusBadge status={record.status} />
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

function Summary({
  label,
  value,
  hint,
  danger,
  badge,
}: {
  label: string;
  value: string;
  hint?: string;
  danger?: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {badge}
      </div>
      <p className={`mt-1 text-lg font-bold ${danger ? "text-red-600" : "text-slate-900"}`}>{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b pb-2 last:border-0 last:pb-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="max-w-[210px] text-right text-sm">{value}</span>
    </div>
  );
}
