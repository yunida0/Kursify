import Link from "next/link";
import { Award, BadgeCheck, CalendarDays, GraduationCap, ShieldAlert } from "lucide-react";
import { certificateByToken } from "@/lib/services/grades";
import { formatDateLong } from "@/lib/dates";
import { formatNilai } from "@/lib/rules/grading";
import { StatusBadge } from "@/components/status-badge";

export const metadata = { title: "Verifikasi Sertifikat" };

export default async function VerifikasiTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const certificate = await certificateByToken(token);

  if (!certificate) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
            <ShieldAlert className="h-8 w-8" />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Sertifikat tidak ditemukan</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Token verifikasi tidak valid atau sertifikat belum diterbitkan. Periksa kembali tautan
            QR pada sertifikat Anda.
          </p>
          <Link
            href="/verifikasi"
            className="mt-6 inline-flex h-10 items-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Coba token lain
          </Link>
        </div>
      </div>
    );
  }

  const enrollment = certificate.enrollment;
  const student = enrollment.student;
  const kelas = enrollment.class;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="bg-[#0B1F2A] px-6 py-8 text-center text-white sm:px-10">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
            <BadgeCheck className="h-7 w-7" />
          </span>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
            Sertifikat Terverifikasi
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Sertifikat ini sah dan terdaftar</h1>
          <p className="mt-1 text-sm text-slate-400">
            Diterbitkan oleh LKP Nida Course melalui sistem Kursify.
          </p>
        </div>

        <div className="grid gap-6 px-6 py-8 sm:grid-cols-2 sm:px-10">
          <Detail icon={<Award />} label="Nomor Sertifikat" value={certificate.certificateNo} strong />
          <Detail
            icon={<CalendarDays />}
            label="Tanggal Terbit"
            value={formatDateLong(certificate.issuedAt)}
          />
          <Detail icon={<GraduationCap />} label="Nama Siswa" value={student.nama} strong />
          <Detail label="Nomor Induk" value={student.studentCode ?? "-"} />
          <Detail label="Program" value={kelas.program.nama} />
          <Detail label="Tingkat" value={kelas.program.level ?? "-"} />
          <Detail label="Kelas" value={kelas.kodeKelas} />
          <Detail
            label="Periode Kursus"
            value={`${formatDateLong(kelas.tanggalMulai)} – ${formatDateLong(kelas.tanggalSelesai)}`}
          />
        </div>

        <div className="border-t bg-slate-50 px-6 py-6 sm:px-10">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Rata-rata</p>
                <p className="text-2xl font-bold tabular-nums text-slate-900">
                  {formatNilai(certificate.rataRata)}
                </p>
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Predikat</p>
                <div className="mt-1 flex items-center gap-2">
                  <StatusBadge status="lunas" className="hidden" />
                  <span className="text-lg font-bold text-slate-900">{certificate.huruf}</span>
                  <span className="text-sm text-muted-foreground">{certificate.predikat}</span>
                </div>
              </div>
            </div>
            <div className="text-center sm:text-right">
              <p className="text-xs text-muted-foreground">Token verifikasi</p>
              <p className="mt-1 max-w-[260px] break-all font-mono text-[11px] text-slate-500">
                {certificate.verifyToken}
              </p>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Keaslian sertifikat dapat dicek kapan saja melalui halaman ini atau dengan memindai QR pada
        dokumen sertifikat.
      </p>
    </div>
  );
}

function Detail({
  icon,
  label,
  value,
  strong,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
        {icon ? <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span> : null}
        {label}
      </p>
      <p
        className={
          strong
            ? "mt-1 text-lg font-bold tracking-tight text-slate-900"
            : "mt-1 text-sm font-medium text-slate-800"
        }
      >
        {value}
      </p>
    </div>
  );
}
