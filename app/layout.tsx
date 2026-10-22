import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Kursify — Sistem Informasi Lembaga Kursus",
    template: "%s | Kursify",
  },
  description:
    "Sistem informasi absensi dan keuangan lembaga kursus: siswa, kelas, absensi, tagihan, honor, sertifikat, dan laporan.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="min-h-screen font-sans" suppressHydrationWarning>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
