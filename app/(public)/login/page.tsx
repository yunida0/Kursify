import { Suspense } from "react";
import { redirect } from "next/navigation";
import { GraduationCap, ShieldCheck, Wallet, CalendarCheck2 } from "lucide-react";
import { auth } from "@/auth";
import { homeFor } from "@/lib/guard";
import { LoginForm } from "@/components/forms/login-form";

export const metadata = { title: "Masuk" };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.role) redirect(homeFor(session.user.role));

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-16">
      <div className="hidden overflow-hidden rounded-2xl bg-[#0B1F2A] p-10 text-slate-200 lg:block">
        <span className="mb-6 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-white">
          <GraduationCap className="h-6 w-6" />
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Satu sistem untuk seluruh administrasi kursus.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          Kelola pendaftaran, absensi, tagihan, honor tutor, sertifikat, dan laporan keuangan
          dalam satu tempat.
        </p>
        <ul className="mt-8 space-y-4 text-sm">
          <li className="flex items-start gap-3">
            <CalendarCheck2 className="mt-0.5 h-5 w-5 text-emerald-400" />
            <span>Absensi per sesi dengan QR dan rekap otomatis.</span>
          </li>
          <li className="flex items-start gap-3">
            <Wallet className="mt-0.5 h-5 w-5 text-emerald-400" />
            <span>Tagihan, kuitansi, honor, dan buku kas yang saling terhubung.</span>
          </li>
          <li className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-400" />
            <span>Hak akses per peran dengan audit trail menyeluruh.</span>
          </li>
        </ul>
      </div>

      <div className="mx-auto w-full max-w-md">
        <div className="rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Panel Internal
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Masuk ke Kursify</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Gunakan akun yang diberikan oleh Owner atau Admin.
            </p>
          </div>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <div className="mt-4 rounded-xl border border-dashed bg-white p-4 text-xs text-slate-500">
          <p className="font-semibold text-slate-700">Akun demo</p>
          <p className="mt-1">owner@kursify.id · admin@kursify.id · keuangan@kursify.id · tutor@kursify.id</p>
          <p>Password: Kursify123!</p>
        </div>
      </div>
    </div>
  );
}
