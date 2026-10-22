import { QrCode, ShieldCheck } from "lucide-react";
import { VerifyTokenForm } from "@/features/sertifikat/verify-form";

export const metadata = { title: "Verifikasi Sertifikat" };

export default function VerifikasiPage() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6">
      <div className="rounded-2xl border bg-white p-8 shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <QrCode className="h-8 w-8" />
        </span>
        <h1 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900">
          Verifikasi Sertifikat
        </h1>
        <p className="mx-auto mt-2 max-w-md text-center text-sm text-muted-foreground">
          Pindai QR pada sertifikat Kursify, atau tempel token verifikasi di bawah ini untuk
          memeriksa keaslian dokumen.
        </p>
        <div className="mt-6">
          <VerifyTokenForm />
        </div>
        <div className="mt-6 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <p>
            Setiap sertifikat memiliki token unik yang hanya diterbitkan sekali oleh sistem. Data
            yang ditampilkan berasal langsung dari basis data lembaga.
          </p>
        </div>
      </div>
    </div>
  );
}
