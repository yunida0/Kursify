import Link from "next/link";
import { CheckCircle2, MessageCircle, ReceiptText } from "lucide-react";
import { getSettings } from "@/lib/services/settings";

export const metadata = { title: "Pendaftaran Terkirim" };

export default async function DaftarSuksesPage({
  searchParams,
}: {
  searchParams: Promise<{ invoice?: string; nama?: string }>;
}) {
  const params = await searchParams;
  const settings = await getSettings();

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6">
      <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-8 w-8" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
          Pendaftaran berhasil dikirim
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Terima kasih{params.nama ? `, ${params.nama}` : ""}. Data Anda telah kami terima dan akan
          diverifikasi oleh Admin.
        </p>

        {params.invoice ? (
          <div className="mt-6 rounded-xl border border-dashed bg-slate-50 p-4 text-left">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <ReceiptText className="h-4 w-4" /> Tagihan Pendaftaran
            </p>
            <p className="mt-2 text-lg font-bold tracking-tight text-slate-900">{params.invoice}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Silakan lakukan pembayaran biaya pendaftaran di kantor {settings.namaLembaga}.
              Nomor tagihan ini digunakan untuk proses verifikasi.
            </p>
          </div>
        ) : null}

        <div className="mt-6 space-y-2 text-left text-sm">
          <p className="font-semibold text-slate-800">Langkah berikutnya</p>
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Bayar biaya pendaftaran di kasir atau melalui transfer resmi.</li>
            <li>Admin memverifikasi pembayaran dan berkas pendaftaran.</li>
            <li>Siswa diaktivasi, menerima nomor induk dan Kartu Siswa QR.</li>
          </ol>
        </div>

        {settings.telepon ? (
          <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <MessageCircle className="h-4 w-4" /> Informasi: {settings.telepon}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Link
            href="/daftar"
            className="inline-flex h-10 items-center rounded-lg border bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Daftar lagi
          </Link>
          <Link
            href="/login"
            className="inline-flex h-10 items-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Masuk ke panel
          </Link>
        </div>
      </div>
    </div>
  );
}
