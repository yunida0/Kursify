import Link from "next/link";
import { GraduationCap } from "lucide-react";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-base font-bold tracking-tight text-slate-900">kursify</span>
              <span className="block text-[10px] uppercase tracking-[0.18em] text-slate-500">
                LKP Nida Course
              </span>
            </span>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/verifikasi"
              className="hidden rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 sm:block"
            >
              Verifikasi Sertifikat
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Masuk
            </Link>
            <Link
              href="/daftar"
              className="rounded-lg bg-emerald-600 px-3 py-2 font-semibold text-white hover:bg-emerald-700"
            >
              Daftar
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} LKP Nida Course — Kursify</p>
          <p>Sistem Informasi Absensi & Keuangan Lembaga Kursus</p>
        </div>
      </footer>
    </div>
  );
}
