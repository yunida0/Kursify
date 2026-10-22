import Link from "next/link";
import {
  CalendarClock,
  ClipboardList,
  DoorOpen,
  GraduationCap,
  Plus,
  Users,
  Wallet,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { addDays, formatDate, todayDateOnly } from "@/lib/dates";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Dashboard Admin" };
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireRole("admin", "owner");
  const today = todayDateOnly();
  const tomorrow = addDays(today, 1);

  const [pending, activeStudents, todaySessions, unfilled, activeClasses, pendingInvoices] =
    await Promise.all([
      prisma.student.count({ where: { status: "pending" } }),
      prisma.student.count({ where: { status: "aktif" } }),
      prisma.session.findMany({
        where: { tanggal: { gte: today, lt: tomorrow }, status: { not: "dibatalkan" } },
        include: {
          class: { include: { program: true } },
          tutor: true,
          room: true,
          _count: { select: { attendances: true } },
        },
        orderBy: { jamMulai: "asc" },
      }),
      prisma.session.count({
        where: { tanggal: { gte: today, lt: tomorrow }, status: "terjadwal" },
      }),
      prisma.courseClass.count({ where: { status: { in: ["dibuka", "berjalan"] } } }),
      prisma.invoice.count({
        where: { status: { in: ["belum_dibayar", "dibayar_sebagian", "menunggak"] } },
      }),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Admin"
        description={`Operasional pendaftaran, kelas, dan absensi — ${formatDate(today)}`}
      >
        <Link
          href="/admin/siswa/baru"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Tambah Siswa
        </Link>
        <Link
          href="/admin/kelas/baru"
          className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <CalendarClock className="h-4 w-4" /> Buat Kelas
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pendaftar Pending"
          value={pending}
          hint="Menunggu verifikasi & aktivasi"
          icon={<ClipboardList className="h-5 w-5" />}
          tone={pending > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Siswa Aktif"
          value={activeStudents}
          hint={`${activeClasses} kelas berjalan/dibuka`}
          icon={<Users className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="Sesi Hari Ini"
          value={todaySessions.length}
          hint={`${unfilled} sesi absensi belum diisi`}
          icon={<CalendarClock className="h-5 w-5" />}
          tone={unfilled > 0 ? "warning" : "info"}
        />
        <StatCard
          label="Tagihan Belum Lunas"
          value={pendingInvoices}
          hint="Termasuk menunggak"
          icon={<Wallet className="h-5 w-5" />}
          tone="danger"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" /> Kelas Hari Ini
            </CardTitle>
            <Link href="/admin/sesi" className="text-xs font-semibold text-primary hover:underline">
              Kalender sesi
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {todaySessions.length === 0 ? (
              <EmptyState
                title="Tidak ada sesi hari ini"
                description="Jadwal kelas berikutnya akan muncul di kalender sesi."
                className="m-5"
              />
            ) : (
              <div className="divide-y">
                {todaySessions.map((session) => (
                  <div key={session.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <div className="flex h-11 w-16 flex-col items-center justify-center rounded-lg bg-primary/5 text-primary">
                      <span className="text-sm font-bold">{session.jamMulai}</span>
                      <span className="text-[10px]">{session.jamSelesai}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/sesi/${session.id}`}
                        className="truncate text-sm font-semibold hover:text-primary"
                      >
                        {session.class.kodeKelas} · {session.class.program.nama}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {session.tutor.nama} · {session.room.nama} · {session._count.attendances} absensi
                      </p>
                    </div>
                    <StatusBadge status={session.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Akses Cepat</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {[
                { href: "/admin/pendaftar", label: "Pendaftar", icon: ClipboardList },
                { href: "/admin/siswa", label: "Data Siswa", icon: GraduationCap },
                { href: "/admin/kelas", label: "Kelas", icon: CalendarClock },
                { href: "/admin/ruangan", label: "Ruangan", icon: DoorOpen },
                { href: "/admin/sertifikat", label: "Sertifikat", icon: GraduationCap },
                { href: "/admin/laporan", label: "Laporan", icon: ClipboardList },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col gap-2 rounded-xl border p-3 text-xs font-medium text-slate-600 transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <item.icon className="h-4 w-4 text-primary" />
                  {item.label}
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Perlu Tindakan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Link
                href="/admin/pendaftar"
                className="flex items-center justify-between rounded-lg border px-3 py-2.5 hover:bg-slate-50"
              >
                <span>Pendaftar menunggu</span>
                <span className="font-bold text-amber-600">{pending}</span>
              </Link>
              <Link
                href="/admin/sesi?status=terjadwal"
                className="flex items-center justify-between rounded-lg border px-3 py-2.5 hover:bg-slate-50"
              >
                <span>Absensi belum diisi</span>
                <span className="font-bold text-sky-600">{unfilled}</span>
              </Link>
              <Link
                href="/admin/siswa?status=ditangguhkan"
                className="flex items-center justify-between rounded-lg border px-3 py-2.5 hover:bg-slate-50"
              >
                <span>Siswa ditangguhkan</span>
                <span className="font-bold text-red-600">
                  {activeStudents > 0 ? await prisma.student.count({ where: { status: "ditangguhkan" } }) : 0}
                </span>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
