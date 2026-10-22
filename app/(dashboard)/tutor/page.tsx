import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  MapPin,
  Users,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { addDays, formatDate, formatTime, monthKey, monthRange, todayDateOnly } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import { requireTutorProfile } from "@/lib/tutor";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { InlineAction } from "@/components/forms/inline-action";
import { openSessionAction } from "@/features/absensi/actions";

export const metadata = { title: "Sesi Hari Ini" };
export const dynamic = "force-dynamic";

export default async function TutorDashboardPage() {
  const actor = await requireRole("tutor");
  const tutor = await requireTutorProfile(actor);
  const today = todayDateOnly();
  const weekAhead = addDays(today, 7);
  const { start, endExclusive } = monthRange(monthKey());

  const mine = { OR: [{ tutorId: tutor.id }, { penggantiTutorId: tutor.id }] };

  const [todaySessions, upcoming, monthDone, classCount, payrolls, pendingSessions] = await Promise.all([
    prisma.session.findMany({
      where: { tanggal: today, status: { not: "dibatalkan" }, ...mine },
      include: {
        class: { include: { program: true, _count: { select: { enrollments: true } } } },
        room: true,
        tutorAttendance: true,
        attendances: { select: { status: true } },
      },
      orderBy: { jamMulai: "asc" },
    }),
    prisma.session.findMany({
      where: {
        tanggal: { gt: today, lte: weekAhead },
        status: "terjadwal",
        ...mine,
      },
      include: { class: { include: { program: true } }, room: true },
      orderBy: [{ tanggal: "asc" }, { jamMulai: "asc" }],
      take: 6,
    }),
    prisma.session.count({
      where: { tanggal: { gte: start, lt: endExclusive }, status: "selesai", ...mine },
    }),
    prisma.courseClass.count({ where: { tutorId: tutor.id, status: { not: "ditutup" } } }),
    prisma.tutorPayroll.findMany({
      where: { tutorId: tutor.id },
      orderBy: { periode: "desc" },
      take: 6,
    }),
    prisma.session.findMany({
      where: {
        tanggal: { gte: addDays(today, -14), lte: today },
        status: "terjadwal",
        ...mine,
      },
      include: { class: { include: { program: true } } },
      orderBy: [{ tanggal: "asc" }, { jamMulai: "asc" }],
      take: 5,
    }),
  ]);

  const unpaid = payrolls.filter((p) => p.status !== "dibayar");
  const unpaidTotal = unpaid.reduce((sum, p) => sum + p.total, 0);
  const lastPaid = payrolls.find((p) => p.status === "dibayar");

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Selamat datang, ${tutor.nama.split(" ")[0]}`}
        description={`${tutor.tutorCode} · ${tutor.keahlian} · ${formatDate(today)}`}
      >
        <Link
          href="/tutor/kelas"
          className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <BookOpen className="h-4 w-4" /> Kelas Saya
        </Link>
        <Link
          href="/tutor/honor"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <Banknote className="h-4 w-4" /> Honor Saya
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Sesi Hari Ini" value={String(todaySessions.length)} hint={`${todaySessions.filter((s) => s.status === "selesai").length} sudah selesai`} icon={<CalendarClock className="h-5 w-5" />} />
        <Stat label="Sesi Selesai Bulan Ini" value={String(monthDone)} hint={formatDate(start)} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <Stat label="Kelas Aktif" value={String(classCount)} hint="Kelas yang Anda ampu" icon={<Users className="h-5 w-5" />} />
        <Stat
          label="Honor Belum Dibayar"
          value={formatRupiah(unpaidTotal)}
          hint={lastPaid ? `Terakhir ${formatRupiah(lastPaid.total)} · ${lastPaid.slipNo}` : "Belum ada slip"}
          icon={<Banknote className="h-5 w-5" />}
          tone={unpaidTotal > 0 ? "warning" : "success"}
        />
      </div>

      {pendingSessions.length > 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">{pendingSessions.length} sesi belum diabsen</p>
            <p className="text-xs">
              {pendingSessions.map((s) => `${s.class.kodeKelas} ${formatDate(s.tanggal)}`).join(" · ")}
            </p>
            <p className="mt-1 text-[11px] text-amber-800">
              Absensi hanya dapat diisi maksimal 24 jam setelah sesi berakhir. Hubungi Admin bila sudah lewat.
            </p>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-primary" /> Jadwal Hari Ini
          </CardTitle>
          <span className="text-xs text-muted-foreground">{formatDate(today)}</span>
        </CardHeader>
        <CardContent className="p-0">
          {todaySessions.length === 0 ? (
            <EmptyState
              title="Tidak ada sesi hari ini"
              description="Jadwal mengajar berikutnya dapat dilihat di bawah."
              className="m-5"
            />
          ) : (
            <div className="divide-y">
              {todaySessions.map((session) => {
                const attendanceFilled = session.attendances.length > 0;
                const canOpen =
                  session.tutorId === tutor.id &&
                  session.status === "terjadwal" &&
                  !session.tutorAttendance;
                return (
                  <div key={session.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                    <div className="flex w-20 shrink-0 flex-col items-center rounded-lg border bg-slate-50 px-2 py-1.5">
                      <span className="text-sm font-bold tabular-nums">{formatTime(session.jamMulai)}</span>
                      <span className="text-[10px] text-muted-foreground">{formatTime(session.jamSelesai)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{session.class.kodeKelas}</p>
                      <p className="text-xs text-muted-foreground">
                        {session.class.program.nama} · {session.class._count.enrollments} siswa
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {session.room.nama}
                        {session.penggantiTutorId === tutor.id ? " · Anda tutor pengganti" : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={session.status} />
                      {session.status === "selesai" ? (
                        <Link
                          href={`/tutor/sesi/${session.id}`}
                          className="inline-flex h-8 items-center gap-1 rounded-md border bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Lihat Absensi
                        </Link>
                      ) : canOpen ? (
                        <InlineAction
                          action={openSessionAction}
                          fields={{ sessionId: session.id }}
                          label="Buka Sesi"
                          variant="success"
                        />
                      ) : (
                        <Link
                          href={`/tutor/sesi/${session.id}`}
                          className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-semibold text-white hover:bg-primary/90"
                        >
                          {attendanceFilled ? "Lengkapi Absensi" : "Isi Absensi"} <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" /> Jadwal 7 Hari ke Depan
            </CardTitle>
            <Link href="/tutor/kelas" className="text-xs font-semibold text-primary hover:underline">
              Semua kelas
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {upcoming.length === 0 ? (
              <EmptyState title="Belum ada jadwal" className="m-4" />
            ) : (
              <div className="divide-y">
                {upcoming.map((session) => (
                  <div key={session.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">{session.class.kodeKelas}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(session.tanggal)} · {session.jamMulai}–{session.jamSelesai}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">{session.room.nama}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-emerald-600" /> Riwayat Honor
            </CardTitle>
            <Link href="/tutor/honor" className="text-xs font-semibold text-primary hover:underline">
              Semua
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {payrolls.length === 0 ? (
              <EmptyState title="Belum ada rekap honor" className="m-4" />
            ) : (
              <div className="divide-y">
                {payrolls.map((payroll) => (
                  <div key={payroll.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">{payroll.periode}</p>
                      <p className="text-xs text-muted-foreground">
                        {payroll.jumlahSesi} sesi · {payroll.slipNo ?? "slip belum terbit"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold tabular-nums">{formatRupiah(payroll.total)}</p>
                      <StatusBadge status={payroll.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
        <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Buka sesi tepat waktu, isi absensi seluruh siswa, lalu simpan. Absensi yang sudah tersimpan
          dapat dikoreksi maksimal 24 jam setelah sesi berakhir.
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone?: "success" | "warning";
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <span
          className={
            tone === "warning" ? "text-amber-600" : tone === "success" ? "text-emerald-600" : "text-primary"
          }
        >
          {icon}
        </span>
      </div>
      <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
