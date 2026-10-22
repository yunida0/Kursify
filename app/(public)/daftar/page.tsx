import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/services/settings";
import { RegisterForm } from "@/features/siswa/register-form";

export const metadata = { title: "Pendaftaran Siswa Baru" };

export default async function DaftarPage() {
  const [programs, settings] = await Promise.all([
    prisma.program.findMany({
      where: { isActive: true, parentId: null },
      orderBy: { nama: "asc" },
      select: {
        id: true,
        kode: true,
        nama: true,
        level: true,
        biayaPendaftaran: true,
        tarif: true,
        skemaTagihan: true,
        jumlahPertemuanPaket: true,
      },
    }),
    getSettings(),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Pendaftaran Online
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Bergabung dengan {settings.namaLembaga}
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          Isi formulir di bawah ini. Tim admin akan memverifikasi berkas dan menghubungi Anda
          melalui WhatsApp.
        </p>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
        {programs.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Belum ada program yang dibuka. Silakan hubungi admin.
          </p>
        ) : (
          <RegisterForm programs={programs} />
        )}
      </div>

      <div className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
        {[
          { title: "Daftar online", desc: "Isi data diri dan unggah berkas dari rumah." },
          { title: "Bayar pendaftaran", desc: "Lakukan pembayaran biaya pendaftaran ke kasir." },
          { title: "Aktivasi & kelas", desc: "Admin menerbitkan nomor induk dan menempatkan kelas." },
        ].map((item, index) => (
          <div key={item.title} className="rounded-xl border bg-white p-4">
            <p className="text-xs font-semibold text-emerald-700">Langkah {index + 1}</p>
            <p className="mt-1 font-semibold text-slate-800">{item.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
